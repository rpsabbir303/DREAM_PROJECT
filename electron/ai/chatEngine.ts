import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'
import type { ChatMessage, ChatStartStreamInput } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { ExecutionManager } from '../system/executionManager.js'
import { parseChatUnderstanding } from './chatIntentParser.js'
import { getProviderStatus, routeProvider, streamWithProvider } from './providerRouter.js'
import { createTaskFromUnderstanding } from './taskGenerator.js'
import { parseIntent } from './intentParser.js'

type Sender = WebContents

export class ChatEngine {
  private activeStreams = new Map<string, AbortController>()
  private readonly executionManager: ExecutionManager

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly capabilityPromptProvider?: () => string,
  ) {
    this.executionManager = new ExecutionManager(memoryRepository)
  }

  async startStream(input: ChatStartStreamInput, sender: Sender) {
    const controller = new AbortController()
    this.activeStreams.set(input.streamId, controller)
    sender.send(IPC_CHANNELS.aiChatStreamEvent, { streamId: input.streamId, type: 'start' })

    const userMessage = this.memoryRepository.addChatMessage({ role: 'user', content: input.input })
    const understanding = parseChatUnderstanding(input.input)
    sender.send(IPC_CHANNELS.aiChatStreamEvent, {
      streamId: input.streamId,
      type: 'intent',
      data: understanding,
    })

    const task = createTaskFromUnderstanding(understanding, this.memoryRepository)
    if (task) {
      sender.send(IPC_CHANNELS.aiChatStreamEvent, {
        streamId: input.streamId,
        type: 'task',
        data: task,
      })
    }

    if (task && understanding.actionRequired) {
      const intent = parseIntent(input.input)
      const result = await this.executionManager.runIntent(intent, {
        taskId: task.id,
        onTaskStatus: (status) => {
          sender.send(IPC_CHANNELS.aiChatStreamEvent, {
            streamId: input.streamId,
            type: 'task-status',
            data: { taskId: task.id, status },
          })
        },
      })
      sender.send(IPC_CHANNELS.aiChatStreamEvent, {
        streamId: input.streamId,
        type: 'execution',
        data: result,
      })
    }

    const assistantSeed = this.buildSystemPrompt(understanding)
    const screenContext = this.getScreenContextForInput(input.input)
    const messages: ChatMessage[] = [
      {
        id: randomUUID(),
        role: 'system',
        content: screenContext ? `${assistantSeed}\n${screenContext}` : assistantSeed,
        createdAt: new Date().toISOString(),
      },
      ...input.history.slice(-12),
      userMessage,
    ]
    const semanticHits = this.memoryRepository.semanticSearch(input.input, 4)
    if (semanticHits.length > 0) {
      messages.splice(1, 0, {
        id: randomUUID(),
        role: 'system',
        content: `Relevant memory context:\n${semanticHits.map((hit) => `- ${hit.content}`).join('\n')}`,
        createdAt: new Date().toISOString(),
      })
    }
    const contextualHits = this.memoryRepository.semanticKnowledgeSearch(input.input, 4)
    if (contextualHits.length > 0) {
      messages.splice(1, 0, {
        id: randomUUID(),
        role: 'system',
        content: `Indexed knowledge context:\n${contextualHits
          .map((hit) => `- (${hit.chunk.sourceType}) ${hit.chunk.content.slice(0, 180)}`)
          .join('\n')}`,
        createdAt: new Date().toISOString(),
      })
    }

    let finalText = ''
    try {
      const settings = this.memoryRepository.getAiSettings()
      const providerStatus = await getProviderStatus()
      const decision = routeProvider(input.input, settings, providerStatus.ollamaReachable)
      sender.send(IPC_CHANNELS.aiChatStreamEvent, {
        streamId: input.streamId,
        type: 'provider',
        data: decision,
      })
      const startedAt = Date.now()
      finalText = await streamWithProvider({
        decision,
        messages,
        signal: controller.signal,
        onDelta: (chunk) => {
          sender.send(IPC_CHANNELS.aiChatStreamEvent, {
            streamId: input.streamId,
            type: 'delta',
            data: { chunk },
          })
        },
      })
      this.memoryRepository.addAiProviderMetric({
        provider: decision.provider,
        model: decision.model,
        latencyMs: Date.now() - startedAt,
        inputChars: input.input.length,
        outputChars: finalText.length,
        createdAt: new Date().toISOString(),
      })

      this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText })
      sender.send(IPC_CHANNELS.aiChatStreamEvent, {
        streamId: input.streamId,
        type: 'complete',
        data: { finalText },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown chat error'
      sender.send(IPC_CHANNELS.aiChatStreamEvent, {
        streamId: input.streamId,
        type: 'error',
        data: { message },
      })
    } finally {
      this.activeStreams.delete(input.streamId)
    }
  }

  cancelStream(streamId: string) {
    const controller = this.activeStreams.get(streamId)
    if (!controller) return false
    controller.abort()
    this.activeStreams.delete(streamId)
    return true
  }

  private buildSystemPrompt(intent: ReturnType<typeof parseChatUnderstanding>) {
    return [
      'You are JARVIS, a concise desktop AI assistant.',
      `Detected intent: ${intent.intent}.`,
      `Action required: ${intent.actionRequired ? 'yes' : 'no'}.`,
      'Respond clearly, include execution-safe guidance, and avoid dangerous commands.',
      this.capabilityPromptProvider ? `Enabled skills and tools:\n${this.capabilityPromptProvider()}` : '',
    ].join(' ')
  }

  private getScreenContextForInput(input: string) {
    const needsVisionContext = /(screen|visible|ui|dashboard|terminal output|error on my screen|what.*screen)/i.test(
      input,
    )
    if (!needsVisionContext) return null
    const latest = this.memoryRepository.getRecentScreenAnalyses(1)[0]
    if (!latest) return 'No recent screen analysis available. Ask user to capture and analyze the screen first.'
    return [
      'Recent screen analysis context:',
      `Summary: ${latest.summary}`,
      `OCR snippet: ${latest.ocrText.slice(0, 600)}`,
      latest.activeWindow ? `Active app: ${latest.activeWindow.app} (${latest.activeWindow.title})` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
}
