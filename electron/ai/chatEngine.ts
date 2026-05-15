import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { BASIC_CHAT_SYSTEM_PROMPT } from '../../shared/ai/basicChatMvp.js'
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'
import type { ChatMessage, ChatStartStreamInput, ChatStreamEvent } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { routeProvider } from './providerRouter.js'
import { resolveGeminiModel } from './geminiEnv.js'
import { runJarvisGeminiBasic } from './geminiJarvisPipeline.js'
import { routeIntent } from './nlpRouter.js'
import { guard } from '../security/actionGuard.js'
import { executeIntent } from '../plugins/pluginRegistry.js'
import { executePlan } from '../agent/taskPlanner.js'
import {
  pushCommand,
  getSessionContext,
  runtimeState,
} from '../system/runtimeState.js'

type Sender = WebContents

/**
 * Chat Engine — full desktop agent pipeline
 *
 * Priority order (AUTOMATION ALWAYS FIRST):
 *  1. NLP Router   → deterministic intent detection (Phase 6)
 *  2. Action Guard → risk level + optional confirmation dialog (Phase 7)
 *  3. Plugin exec  → executes via appPlugin / fileAgent / systemAgent / browser (Phase 8)
 *  4. Gemini       → ONLY if NLP router returns null (general chat / unknown)
 *
 * Desktop commands NEVER reach Gemini.
 * Gemini ONLY handles genuine conversation and planning requests.
 */
export class ChatEngine {
  private activeStreams = new Map<string, AbortController>()

  constructor(private readonly memoryRepository: MemoryRepository) {}

  async startStream(input: ChatStartStreamInput, sender: Sender) {
    const controller = new AbortController()
    this.activeStreams.set(input.streamId, controller)

    const emit = (event: ChatStreamEvent) => {
      try {
        if (sender.isDestroyed()) {
          console.warn('[JARVIS_AI] skip emit — sender destroyed:', event.type)
          return
        }
        sender.send(IPC_CHANNELS.aiChatStreamEvent, event)
      } catch (err) {
        console.warn('[JARVIS_AI] emit failed:', event.type, err)
      }
    }

    try {
      emit({ streamId: input.streamId, type: 'start' })

      // ─── ROUTER ENTRY POINT ──────────────────────────────────────────────
      console.info('[JARVIS_ROUTER] ─────────────────────────────────────────')
      console.info(`[JARVIS_ROUTER] incoming="${input.input.slice(0, 120)}"`)

      const userMessage = this.memoryRepository.addChatMessage({ role: 'user', content: input.input })

      // Session memory — safe, non-blocking
      try { pushCommand(input.input) } catch { /* non-critical */ }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 1 — NLP Router  (ALWAYS runs BEFORE Gemini — NO exceptions)
      // ══════════════════════════════════════════════════════════════════════
      let resolved: ReturnType<typeof routeIntent> = null
      try {
        resolved = routeIntent(input.input)
      } catch (routerErr) {
        const msg = routerErr instanceof Error ? routerErr.message : String(routerErr)
        console.error(`[JARVIS_ROUTER] routeIntent threw — ${msg}`)
        resolved = null
      }

      if (resolved) {
        console.info(`[JARVIS_ROUTER] matchedIntent=true`)
        console.info(`[JARVIS_ROUTER] type=${resolved.type}`)
        console.info(`[JARVIS_ROUTER] app=${resolved.params.app ?? resolved.params.folder ?? resolved.params.query ?? '—'}`)
        console.info(`[JARVIS_ROUTER] risk=${resolved.riskLevel}`)
        console.info(`[JARVIS_ROUTER] executing local automation`)

        // ── STEP 2: Safety Guard ────────────────────────────────────────────
        const decision = await guard(resolved.type, resolved.displayLabel)

        if (!decision.proceed) {
          const cancelMsg = `Action cancelled: ${decision.reason}`
          console.info(`[JARVIS_ROUTER] action blocked by guard — ${decision.reason}`)
          this.memoryRepository.addChatMessage({ role: 'assistant', content: cancelMsg })
          emitLocal(emit, input.streamId, cancelMsg)
          return
        }

        // ── STEP 3: Plugin Execution ────────────────────────────────────────
        const t0 = Date.now()
        emit({
          streamId: input.streamId,
          type: 'provider',
          data: {
            provider: 'gemini',
            model: resolveGeminiModel(),
            reason: `Desktop agent — ${resolved.type} (local, no LLM).`,
            isOffline: true,
          },
        })

        let finalText: string

        // agent.plan → execute multi-step plan with live progress (Phase 5)
        if (resolved.type === 'agent.plan') {
          const goal = resolved.params.goal ?? resolved.rawInput
          console.info(`[JARVIS_ROUTER] agent.plan — executing multi-step plan for "${goal}"`)
          try {
            finalText = await executePlan(goal, (progress) => {
              emit({ streamId: input.streamId, type: 'delta', data: { chunk: `\n${progress.message}` } })
            })
          } catch (planErr) {
            const errMsg = planErr instanceof Error ? planErr.message : String(planErr)
            finalText = `Plan execution failed: ${errMsg.slice(0, 200)}`
          }
          this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText })
          emit({ streamId: input.streamId, type: 'complete', data: { finalText } })
          console.info(`[JARVIS_ROUTER] ─── automation complete (plan) ms=${Date.now() - t0}`)
          return
        }

        // All other desktop intents
        let result: { ok: boolean; message: string }
        try {
          result = await executeIntent(resolved)
          console.info(`[JARVIS_ROUTER] ✓ execution complete ok=${result.ok} ms=${Date.now() - t0}`)
          console.info(`[JARVIS_ROUTER] response="${result.message.slice(0, 100)}"`)
        } catch (execErr) {
          const errMsg = execErr instanceof Error ? execErr.message : String(execErr)
          console.error(`[JARVIS_ROUTER] ✗ execution error — ${errMsg}`)
          result = { ok: false, message: `I couldn't complete that: ${errMsg.slice(0, 180)}` }
        }

        finalText = result.message
        this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText })
        emitLocal(emit, input.streamId, finalText)

        console.info('[JARVIS_ROUTER] ─── automation complete (handled=true) STOP — Gemini NOT called')
        return
        // ← HARD STOP: Gemini never runs for automation intents
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 4 — No automation intent matched → Gemini handles it
      // ══════════════════════════════════════════════════════════════════════
      console.info('[JARVIS_ROUTER] no automation match')
      console.info('[JARVIS_ROUTER] forwarding to Gemini')

      const settings  = this.memoryRepository.getAiSettings()
      const geminiDec = routeProvider(input.input, settings)
      console.info(`[JARVIS_AI] provider: ${geminiDec.provider} / ${geminiDec.model}`)
      emit({ streamId: input.streamId, type: 'provider', data: geminiDec })

      // Build context-enriched system prompt (Phase 4 + 6)
      const ctx        = getSessionContext()
      const activeApp  = runtimeState.activeWindow?.appName ?? 'unknown'
      const prevApp    = ctx.previousWindow?.appName ?? 'none'
      const lastOpened = ctx.lastOpenedApp ?? 'none'
      const recentCmds = ctx.recentCommands.slice(-5).join(', ') || 'none'

      const contextBlock = [
        `[DESKTOP CONTEXT]`,
        `Currently focused app: ${activeApp}`,
        `Previous app: ${prevApp}`,
        `Last app opened by Jarvis: ${lastOpened}`,
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
      let finalText: string

      try {
        finalText = await runJarvisGeminiBasic({
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
          provider: geminiDec.provider,
          model: geminiDec.model,
          latencyMs: Date.now() - startedAt,
          inputChars: input.input.length,
          outputChars: finalText.length,
          createdAt: new Date().toISOString(),
        })

        this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText })
        emit({ streamId: input.streamId, type: 'complete', data: { finalText } })
        console.info(`[JARVIS_AI] ─── turn end (gemini) ms=${Date.now() - startedAt} ───`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown chat error'
        console.error('[JARVIS_AI] ✗ Gemini error:', message)
        emit({ streamId: input.streamId, type: 'error', data: { message } })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat pipeline failed'
      console.error('[JARVIS_AI] ✗ pipeline error:', message)
      emit({ streamId: input.streamId, type: 'error', data: { message } })
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
}

/** Emit a non-streaming (local automation) response as delta + complete. */
function emitLocal(emit: (e: ChatStreamEvent) => void, streamId: string, text: string) {
  emit({ streamId, type: 'delta', data: { chunk: text } })
  emit({ streamId, type: 'complete', data: { finalText: text } })
}
