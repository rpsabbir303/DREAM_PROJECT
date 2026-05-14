import { randomUUID } from 'node:crypto'
import type { MemoryRepository } from '../database/memoryRepository.js'
import type { ChatMessage, CommandUnderstanding } from '../../shared/interfaces/ipc.js'
import type {
  MultimodalFusionPreferences,
  MultimodalStreamPayload,
  MultimodalTracePayload,
} from '../../shared/multimodal/types.js'
import { DEFAULT_MULTIMODAL_FUSION_PREFERENCES } from '../../shared/multimodal/types.js'
import { buildContextSyncSnapshot } from './contextSyncCoordinator.js'
import { fuseMultimodalContext } from './contextFusionEngine.js'
import { prioritizeContextChunks, charsBudgetFromTokens } from './contextPrioritizer.js'
import { buildCrossModalReasoningHints } from './crossModalReasoning.js'
import { buildUnifiedPromptMessages } from './unifiedPromptBuilder.js'
import { toMultimodalErrorMessage } from './multimodalErrors.js'

function mergePreferences(payload?: MultimodalStreamPayload): MultimodalFusionPreferences {
  return {
    ...DEFAULT_MULTIMODAL_FUSION_PREFERENCES,
    ...(payload?.preferences ?? {}),
  }
}

/**
 * End-to-end multimodal orchestration for chat: fuse → prioritize → cross-link → assemble messages.
 */
export async function orchestrateMultimodalChatContext(params: {
  memory: MemoryRepository
  userInput: string
  understanding: CommandUnderstanding
  baseSystemPrompt: string
  history: ChatMessage[]
  userMessage: ChatMessage
  multimodal?: MultimodalStreamPayload
  cwd: string
}): Promise<{
  messages: ChatMessage[]
  trace: MultimodalTracePayload
  syncSnapshot: ReturnType<typeof buildContextSyncSnapshot>
  preferences: MultimodalFusionPreferences
}> {
  const preferences = mergePreferences(params.multimodal)
  const syncSnapshot = buildContextSyncSnapshot(params.memory)

  try {
    const { chunks, privacyNotes } = await fuseMultimodalContext({
      memory: params.memory,
      userInput: params.userInput,
      preferences,
      clientTerminalSnippet: params.multimodal?.clientTerminalSnippet,
      cwd: params.cwd,
    })

    const prioritized = prioritizeContextChunks(chunks, params.userInput, preferences)
    const crossHints = buildCrossModalReasoningHints(prioritized, params.userInput)
    const messages = buildUnifiedPromptMessages({
      baseSystemPrompt: params.baseSystemPrompt,
      prioritizedSlices: prioritized,
      crossModalHints: crossHints,
      history: params.history,
      userMessage: params.userMessage,
      understanding: params.understanding,
    })

    const approxTokensUsed = Math.round(
      messages.reduce((acc, m) => acc + m.content.length, 0) / 4,
    )

    const trace: MultimodalTracePayload = {
      modalitiesIncluded: [...new Set(prioritized.map((p) => p.chunk.kind))],
      chunkCount: chunks.length,
      keptAfterPrioritization: prioritized.length,
      trimmedCount: Math.max(0, chunks.length - prioritized.length),
      approxTokensBudget: preferences.maxApproxTokens,
      approxTokensUsed,
      crossModalHintCount: crossHints.length,
      crossModalSummaries: crossHints.map((h) => h.summary),
      privacyNotes: [...privacyNotes, `Char budget ≈ ${charsBudgetFromTokens(preferences.maxApproxTokens)}`],
    }

    return { messages, trace, syncSnapshot, preferences }
  } catch (error) {
    const fallbackMessages: ChatMessage[] = [
      {
        id: randomUUID(),
        role: 'system',
        content: `${params.baseSystemPrompt}\n\n[Multimodal orchestration fallback: ${toMultimodalErrorMessage(error)}]`,
        createdAt: new Date().toISOString(),
      },
      ...params.history.slice(-12),
      params.userMessage,
    ]
    return {
      messages: fallbackMessages,
      trace: {
        modalitiesIncluded: [],
        chunkCount: 0,
        keptAfterPrioritization: 0,
        trimmedCount: 0,
        approxTokensBudget: preferences.maxApproxTokens,
        approxTokensUsed: Math.round(fallbackMessages.reduce((a, m) => a + m.content.length, 0) / 4),
        crossModalHintCount: 0,
        crossModalSummaries: [],
        privacyNotes: ['Fusion pipeline failed — minimal context sent.', toMultimodalErrorMessage(error)],
      },
      syncSnapshot,
      preferences,
    }
  }
}
