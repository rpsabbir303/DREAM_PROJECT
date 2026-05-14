import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { BASIC_CHAT_SYSTEM_PROMPT } from '../../shared/ai/basicChatMvp.js'
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'
import type { ChatMessage, ChatStartStreamInput, ChatStreamEvent } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { getProviderStatus, routeProvider, streamWithProvider } from './providerRouter.js'
import { runJarvisOpenAiWithTools } from './openAiJarvisPipeline.js'
import { runJarvisGeminiBasic } from './geminiJarvisPipeline.js'

type Sender = WebContents

/**
 * Basic MVP chat: one assistant reply per user turn via Gemini, OpenAI SDK, or Ollama (non-streaming).
 * No tool execution, no voice, no agent orchestration in this path.
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
      console.info('[JARVIS_AI] chat turn start', input.streamId, 'chars=', input.input.length)

      const userMessage = this.memoryRepository.addChatMessage({ role: 'user', content: input.input })

      const settings = this.memoryRepository.getAiSettings()
      const providerStatus = await getProviderStatus()
      const decision = routeProvider(input.input, settings, providerStatus.ollamaReachable)
      console.info('[JARVIS_AI] provider', decision.provider, decision.model, decision.reason)
      emit({
        streamId: input.streamId,
        type: 'provider',
        data: decision,
      })

      const messages: ChatMessage[] = [
        {
          id: randomUUID(),
          role: 'system',
          content: BASIC_CHAT_SYSTEM_PROMPT,
          createdAt: new Date().toISOString(),
        },
        ...input.history.slice(-10),
        userMessage,
      ]

      const startedAt = Date.now()
      let finalText: string

      try {
        if (decision.provider === 'gemini') {
          finalText = await runJarvisGeminiBasic({
            messages,
            model: decision.model,
            streamId: input.streamId,
            signal: controller.signal,
            onDelta: (chunk) => {
              emit({
                streamId: input.streamId,
                type: 'delta',
                data: { chunk },
              })
            },
          })
        } else if (decision.provider === 'openai') {
          finalText = await runJarvisOpenAiWithTools({
            messages,
            model: decision.model,
            streamId: input.streamId,
            signal: controller.signal,
            onDelta: (chunk) => {
              emit({
                streamId: input.streamId,
                type: 'delta',
                data: { chunk },
              })
            },
          })
        } else {
          finalText = await streamWithProvider({
            decision,
            messages,
            signal: controller.signal,
            onDelta: (chunk) => {
              emit({
                streamId: input.streamId,
                type: 'delta',
                data: { chunk },
              })
            },
          })
        }

        if (!finalText.trim()) {
          throw new Error(
            decision.provider === 'ollama' ?
              'The local model returned an empty reply. Check that Ollama is running and the model name is valid.'
            : decision.provider === 'gemini' ?
              'Gemini returned an empty reply. Check GEMINI_MODEL and API quotas.'
            : 'The model returned an empty reply.',
          )
        }

        this.memoryRepository.addAiProviderMetric({
          provider: decision.provider,
          model: decision.model,
          latencyMs: Date.now() - startedAt,
          inputChars: input.input.length,
          outputChars: finalText.length,
          createdAt: new Date().toISOString(),
        })

        this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText })
        emit({
          streamId: input.streamId,
          type: 'complete',
          data: { finalText },
        })
        console.info('[JARVIS_AI] chat turn complete', input.streamId, 'outChars=', finalText.length)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown chat error'
        console.error('[JARVIS_AI] chat LLM error', input.streamId, message, error)
        emit({
          streamId: input.streamId,
          type: 'error',
          data: { message },
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat pipeline failed before LLM'
      console.error('[JARVIS_AI] chat pipeline error', input.streamId, message, error)
      emit({
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
}
