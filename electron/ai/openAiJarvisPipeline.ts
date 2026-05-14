import type { ChatMessage } from '../../shared/interfaces/ipc.js'
import { chatMessagesToOpenAi, completeOpenAiChat } from './providers/openAiProvider.js'

/**
 * Basic OpenAI chat: one non-streaming SDK completion (no tools, no SSE).
 * Errors propagate to {@link ChatEngine} so the renderer gets a structured `error` event with a clear message.
 */
export async function runJarvisOpenAiWithTools(params: {
  messages: ChatMessage[]
  model: string
  streamId: string
  signal: AbortSignal
  onDelta: (chunk: string) => void
}): Promise<string> {
  console.info('[JARVIS_OPENAI] basic chat (SDK, non-stream)', {
    streamId: params.streamId,
    model: params.model,
    messageCount: params.messages.length,
  })

  const messages = chatMessagesToOpenAi(params.messages)
  const assistant = await completeOpenAiChat({
    messages,
    model: params.model,
    signal: params.signal,
  })
  const text = (assistant.content ?? '').trim()
  if (!text) {
    throw new Error('OpenAI returned an empty reply (no assistant text). Check model and account limits.')
  }
  params.onDelta(text)
  console.info('[JARVIS_OPENAI] basic chat success, chars=', text.length)
  return text
}
