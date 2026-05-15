import { safeLogger } from '../main/safeLogger.js'
import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { BASIC_CHAT_SYSTEM_PROMPT } from '../../shared/ai/basicChatMvp.js'
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'
import type { ChatMessage, ChatStartStreamInput, ChatStreamEvent } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { routeProvider } from './providerRouter.js'
import { resolveGeminiModel } from './geminiEnv.js'
import {
  runJarvisGeminiBasic,
  extractStructuredIntent,
  type GeminiExtractedIntent,
} from './geminiJarvisPipeline.js'
import {
  DESKTOP_INTENT_AUTO_EXECUTE,
  DESKTOP_INTENT_CONFIDENCE_FLOOR,
  routeIntent,
  type ResolvedIntent,
} from './nlpRouter.js'
import { getOfflineChatReply, isChatOnly } from './nlp/intentClassifier.js'
import { readProcessEnv } from './openAiEnv.js'
import { canUseConfiguredGemini } from './geminiEnv.js'
import { guard } from '../security/actionGuard.js'
import { executeIntent } from '../plugins/pluginRegistry.js'
import { executePlan } from '../agent/taskPlanner.js'
import {
  pushCommand,
  getSessionContext,
  runtimeState,
} from '../system/runtimeState.js'

// ─── Confidence thresholds ────────────────────────────────────────────────────
//
// ≥ 0.90  → execute immediately
// 0.70–0.89 → ask clarification before executing
// < 0.70  → treat as conversation (Gemini), never automation

type Sender = WebContents

export class ChatEngine {
  private activeStreams = new Map<string, AbortController>()

  constructor(private readonly memoryRepository: MemoryRepository) {}

  async startStream(input: ChatStartStreamInput, sender: Sender) {
    const controller = new AbortController()
    this.activeStreams.set(input.streamId, controller)

    const emit = (event: ChatStreamEvent) => {
      try {
        if (sender.isDestroyed()) return
        sender.send(IPC_CHANNELS.aiChatStreamEvent, event)
      } catch { /* sender gone */ }
    }

    try {
      emit({ streamId: input.streamId, type: 'start' })

      safeLogger.info('[JARVIS_PIPELINE] ────────────────────────────────────────')
      safeLogger.info(`[JARVIS_PIPELINE] input="${input.input.slice(0, 120)}"`)

      const userMessage = this.memoryRepository.addChatMessage({ role: 'user', content: input.input })
      try { pushCommand(input.input) } catch { /* non-critical */ }

      // ── CHAT-FIRST: greetings / small talk never touch automation ─────────
      if (isChatOnly(input.input)) {
        safeLogger.info('[JARVIS_PIPELINE] CHAT-only phrase — skipping automation')
        if (canUseConfiguredGemini()) {
          await this.runGeminiChat(input, userMessage, emit, controller)
          return
        }
        const localReply = getOfflineChatReply(input.input)
          ?? "Hey! I'm here. Desktop commands work — try \"open notepad\" or \"take a screenshot\"."
        this.memoryRepository.addChatMessage({ role: 'assistant', content: localReply })
        emitLocal(emit, input.streamId, localReply)
        return
      }

      // ══════════════════════════════════════════════════════════════════════
      // LAYER 1A — Fast local NLP (no network, instant)
      // ══════════════════════════════════════════════════════════════════════
      let nlpResult: ResolvedIntent | null = null
      try {
        nlpResult = routeIntent(input.input)
      } catch (e) {
        safeLogger.error('[JARVIS_PIPELINE] routeIntent threw:', e instanceof Error ? e.message : String(e))
      }

      if (nlpResult) {
        safeLogger.info(`[JARVIS_PIPELINE] NLP → type=${nlpResult.type} confidence=${nlpResult.confidence}`)
      } else {
        safeLogger.info('[JARVIS_PIPELINE] NLP → no match')
      }

      // ── HIGH-CONFIDENCE (≥0.90): execute immediately ─────────────────────
      if (nlpResult && nlpResult.confidence >= DESKTOP_INTENT_AUTO_EXECUTE) {
        safeLogger.info(`[JARVIS_PIPELINE] AUTO execute (${nlpResult.confidence})`)
        const result = await this.executeLocalIntent(nlpResult, emit, input.streamId)
        this.memoryRepository.addChatMessage({ role: 'assistant', content: result.message })
        emitLocal(emit, input.streamId, result.message)
        return
      }

      // ── MEDIUM (0.70–0.89): ask clarification — do NOT auto-execute ─────
      if (nlpResult && nlpResult.confidence >= DESKTOP_INTENT_CONFIDENCE_FLOOR) {
        const target = nlpResult.params.app ?? nlpResult.displayLabel ?? 'that'
        const clarifyMsg =
          `Did you want me to **${nlpResult.displayLabel}**? ` +
          `Say "yes" or be more specific (e.g. "open ${target}").`
        safeLogger.info(`[JARVIS_PIPELINE] clarify (${nlpResult.confidence}) — not auto-executing`)
        this.memoryRepository.addChatMessage({ role: 'assistant', content: clarifyMsg })
        emitLocal(emit, input.streamId, clarifyMsg)
        return
      }

      // ══════════════════════════════════════════════════════════════════════
      // LAYER 1B — No NLP match → Gemini AI Brain
      // ══════════════════════════════════════════════════════════════════════
      safeLogger.info('[JARVIS_PIPELINE] NLP miss → routing to Gemini AI brain')

      const settings = this.memoryRepository.getAiSettings()
      const geminiDec = routeProvider(input.input, settings)
      emit({ streamId: input.streamId, type: 'provider', data: geminiDec })

      if (geminiDec.isOffline || !canUseConfiguredGemini()) {
        const keyMissing = !canUseConfiguredGemini()
        const keyLineEmpty =
          typeof process.env.GEMINI_API_KEY === 'string' &&
          process.env.GEMINI_API_KEY.trim() === '' &&
          !readProcessEnv('GEMINI_API_KEY')
        const offlineMsg = keyMissing
          ? [
              keyLineEmpty
                ? "I see `GEMINI_API_KEY=` in your `.env` but the value is **empty on disk** — the key may only be in the editor buffer."
                : "I'm missing my AI key right now, so I can't hold a full conversation — but desktop automation is fully operational.",
              '',
              'To restore AI conversation:',
              '1. Get a free key at **https://aistudio.google.com/apikey**',
              '2. Open `.env` in the project root and set `GEMINI_API_KEY=AIza...your-key`',
              keyLineEmpty
                ? '3. **Save the file (Ctrl+S)** — unsaved changes are not loaded by the app'
                : '3. Paste your key (or use **Ctrl+Shift+D** → AI tab)',
              '4. **Restart JARVIS** (close Electron completely, then `npm run dev`)',
              '',
              'Until then, I can still control your desktop — try:',
              '• "open chrome" / "close notepad" / "take a screenshot"',
              '• "minimize this" / "switch to explorer" / "press ctrl+s"',
            ].join('\n')
          : [
              "I'm having trouble reaching the AI service right now, but I can still help with desktop actions.",
              '',
              'Desktop commands still work — try:',
              '• "open chrome" / "close notepad"',
              '• "take a screenshot" / "press ctrl+s"',
              '',
              "I'll automatically reconnect to the AI service when it's available.",
            ].join('\n')

        safeLogger.info('[JARVIS_PIPELINE] Gemini offline — keyMissing=', keyMissing)
        this.memoryRepository.addChatMessage({ role: 'assistant', content: offlineMsg })
        emitLocal(emit, input.streamId, offlineMsg)
        return
      }

      // ── GEMINI BRAIN: try intent extraction first ──────────────────────────
      safeLogger.info('[JARVIS_PIPELINE] calling Gemini intent extractor')
      const ctx = getSessionContext()
      const extracted = await extractStructuredIntent(
        input.input,
        { activeApp: runtimeState.activeWindow?.appName, recentCommands: ctx.recentCommands },
        controller.signal,
      )

      if (extracted) {
        const routed = await this.routeExtractedIntent(extracted, null, emit, input)
        if (routed) return
      }

      // ── GEMINI CONVERSATION FALLBACK ────────────────────────────────────────
      // extractStructuredIntent returned null (parse failure) — do regular chat
      safeLogger.info('[JARVIS_PIPELINE] intent extraction failed → Gemini conversation')
      await this.runGeminiChat(input, userMessage, emit, controller)

    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Chat pipeline failed'
      safeLogger.error('[JARVIS_PIPELINE] unhandled error:', raw)
      const msg = toUserFacingError(raw)
      this.memoryRepository.addChatMessage({ role: 'assistant', content: msg })
      emitLocal(emit, input.streamId, msg)
    } finally {
      this.activeStreams.delete(input.streamId)
    }
  }

  // ─── Route a Gemini-extracted intent ────────────────────────────────────────

  private async routeExtractedIntent(
    extracted: GeminiExtractedIntent,
    _nlpFallback: ResolvedIntent | null,
    emit: (e: ChatStreamEvent) => void,
    input: ChatStartStreamInput,
  ): Promise<boolean> {
    // Clarification request — just ask
    if (extracted.type === 'CLARIFY') {
      safeLogger.info(`[JARVIS_PIPELINE] Gemini says CLARIFY: "${extracted.question}"`)
      this.memoryRepository.addChatMessage({ role: 'assistant', content: extracted.question })
      emitLocal(emit, input.streamId, extracted.question)
      return true
    }

    // Pure chat reply
    if (extracted.type === 'CHAT') {
      safeLogger.info('[JARVIS_PIPELINE] Gemini says CHAT')
      this.memoryRepository.addChatMessage({ role: 'assistant', content: extracted.reply })
      emitLocal(emit, input.streamId, extracted.reply)
      return true
    }

    // Multi-step plan
    if (extracted.type === 'MULTI_STEP') {
      safeLogger.info(`[JARVIS_PIPELINE] Gemini says MULTI_STEP: goal="${extracted.goal}" steps=${extracted.steps.length}`)
      const goal = extracted.steps.join('\n')
      try {
        const finalText = await executePlan(goal, (progress) => {
          emit({ streamId: input.streamId, type: 'delta', data: { chunk: `\n${progress.message}` } })
        })
        this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText })
        emit({ streamId: input.streamId, type: 'complete', data: { finalText } })
      } catch (e) {
        const msg = `Plan failed: ${e instanceof Error ? e.message : String(e)}`
        this.memoryRepository.addChatMessage({ role: 'assistant', content: msg })
        emitLocal(emit, input.streamId, msg)
      }
      return true
    }

    // Single desktop action
    if (extracted.type === 'DESKTOP_ACTION') {
      safeLogger.info(`[JARVIS_PIPELINE] Gemini says DESKTOP_ACTION: ${extracted.intent} confidence=${extracted.confidence}`)

      // Build a ResolvedIntent from the Gemini response
      const resolved: ResolvedIntent = {
        type:         extracted.intent as ResolvedIntent['type'],
        params:       extracted.params ?? {},
        rawInput:     input.input,
        confidence:   extracted.confidence ?? 0.85,
        riskLevel:    'low',
        displayLabel: extracted.displayLabel ?? extracted.intent,
      }

      // Confirmation required (risky actions or Gemini flagged it)
      if (extracted.requiresConfirmation) {
        const confirmMsg = `I'm about to **${extracted.displayLabel}**. Are you sure? (Say "yes" or "confirm" to proceed.)`
        this.memoryRepository.addChatMessage({ role: 'assistant', content: confirmMsg })
        emitLocal(emit, input.streamId, confirmMsg)
        return true
      }

      const result = await this.executeLocalIntent(resolved, emit, input.streamId)
      this.memoryRepository.addChatMessage({ role: 'assistant', content: result.message })
      emitLocal(emit, input.streamId, result.message)
      return true
    }

    return false
  }

  // ─── Execute a local resolved intent ────────────────────────────────────────

  private async executeLocalIntent(
    resolved: ResolvedIntent,
    emit: (e: ChatStreamEvent) => void,
    streamId: string,
  ): Promise<{ ok: boolean; message: string }> {
    emit({
      streamId,
      type: 'provider',
      data: {
        provider: 'gemini',
        model: resolveGeminiModel(),
        reason: `Desktop automation — ${resolved.type}`,
        isOffline: true,
      },
    })

    // Safety guard
    const decision = await guard(resolved.type, resolved.displayLabel)
    if (!decision.proceed) {
      const msg = `Action cancelled: ${decision.reason}`
      safeLogger.info('[JARVIS_PIPELINE] blocked by guard:', decision.reason)
      return { ok: false, message: msg }
    }

    // agent.plan → multi-step executor
    if (resolved.type === 'agent.plan') {
      const goal = resolved.params.goal ?? resolved.rawInput
      safeLogger.info(`[JARVIS_PIPELINE] agent.plan — "${goal}"`)
      try {
        const finalText = await executePlan(goal, (progress) => {
          emit({ streamId, type: 'delta', data: { chunk: `\n${progress.message}` } })
        })
        return { ok: true, message: finalText }
      } catch (e) {
        return { ok: false, message: `Plan failed: ${e instanceof Error ? e.message : String(e)}` }
      }
    }

    // All other intents
    try {
      safeLogger.info(`[JARVIS_PIPELINE] executeIntent(${resolved.type})`)
      const result = await executeIntent(resolved)
      safeLogger.info(`[JARVIS_PIPELINE] result: ok=${result.ok} "${result.message.slice(0, 100)}"`)

      emit({
        streamId,
        type: 'execution',
        data: {
          ok:         result.ok,
          actionType: 'open_application',
          message:    result.message,
          output:     `intent=${resolved.type} ok=${result.ok}`,
          error:      result.ok ? undefined : result.message,
        },
      })

      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      safeLogger.error('[JARVIS_PIPELINE] executeIntent threw:', msg)
      return { ok: false, message: `Command failed: ${msg.slice(0, 200)}` }
    }
  }

  // ─── Gemini conversation ─────────────────────────────────────────────────────

  private async runGeminiChat(
    input: ChatStartStreamInput,
    userMessage: ChatMessage,
    emit: (e: ChatStreamEvent) => void,
    controller: AbortController,
  ) {
    const ctx       = getSessionContext()
    const activeApp = runtimeState.activeWindow?.appName ?? 'unknown'
    const prevApp   = ctx.previousWindow?.appName ?? 'none'
    const lastOpened = ctx.lastOpenedApp ?? 'none'
    const recentCmds = ctx.recentCommands.slice(-5).join(', ') || 'none'

    const contextBlock = [
      `[DESKTOP CONTEXT]`,
      `Currently focused: ${activeApp}`,
      `Previous app: ${prevApp}`,
      `Last opened: ${lastOpened}`,
      `Recent commands: ${recentCmds}`,
      `[/DESKTOP CONTEXT]`,
    ].join('\n')

    const messages: ChatMessage[] = [
      {
        id: randomUUID(),
        role: 'system',
        content: `${BASIC_CHAT_SYSTEM_PROMPT}\n\n${contextBlock}`,
        createdAt: new Date().toISOString(),
      },
      ...input.history.slice(-10),
      userMessage,
    ]

    const startedAt = Date.now()
    try {
      const finalText = await runJarvisGeminiBasic({
        messages,
        streamId: input.streamId,
        signal: controller.signal,
        onDelta: (chunk) => {
          emit({ streamId: input.streamId, type: 'delta', data: { chunk } })
        },
      })

      if (!finalText.trim()) {
        throw new Error('Gemini returned an empty reply. Check GEMINI_MODEL and API quotas.')
      }

      this.memoryRepository.addAiProviderMetric({
        provider:   'gemini',
        model:      resolveGeminiModel(),
        latencyMs:  Date.now() - startedAt,
        inputChars:  input.input.length,
        outputChars: finalText.length,
        createdAt: new Date().toISOString(),
      })

      this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText })
      emit({ streamId: input.streamId, type: 'complete', data: { finalText } })
      safeLogger.info(`[JARVIS_PIPELINE] Gemini chat done, ms=${Date.now() - startedAt}`)

    } catch (err) {
      const raw  = err instanceof Error ? err.message : 'Unknown error'
      safeLogger.error('[JARVIS_PIPELINE] Gemini error:', raw)
      const msg  = toUserFacingError(raw)
      this.memoryRepository.addChatMessage({ role: 'assistant', content: msg })
      emitLocal(emit, input.streamId, msg)
    }
  }

  cancelStream(streamId: string) {
    const controller = this.activeStreams.get(streamId)
    if (!controller) return false
    controller.abort()
    this.activeStreams.delete(streamId)
    return true
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emitLocal(emit: (e: ChatStreamEvent) => void, streamId: string, text: string) {
  emit({ streamId, type: 'delta',    data: { chunk: text } })
  emit({ streamId, type: 'complete', data: { finalText: text } })
}

function toUserFacingError(raw: string): string {
  if (/GEMINI_API_KEY|api\s*key|aistudio|google ai studio/i.test(raw)) {
    return 'AI provider unavailable. Desktop commands like "open WhatsApp" or "take a screenshot" still work without an API key.'
  }
  if (/\n\s*at\s+|\bstack\b|\.ts:\d+|\.js:\d+/i.test(raw)) {
    return 'Something went wrong. Try a desktop command, or check Settings for AI configuration.'
  }
  if (raw.length > 160) {
    return 'Something went wrong. Try a desktop command like "open notepad".'
  }
  return raw
}
