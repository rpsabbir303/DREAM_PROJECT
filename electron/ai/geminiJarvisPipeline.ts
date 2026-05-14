import type { ChatMessage } from '../../shared/interfaces/ipc.js'
import { completeGeminiChat } from './providers/geminiProvider.js'

/**
 * Basic Gemini chat: one non-streaming completion; one `onDelta` with full text (same contract as OpenAI MVP path).
 */
export async function runJarvisGeminiBasic(params: {
  messages: ChatMessage[]
  model: string
  streamId: string
  signal: AbortSignal
  onDelta: (chunk: string) => void
}): Promise<string> {
  console.info('[JARVIS_GEMINI] basic chat (SDK, non-stream)', {
    streamId: params.streamId,
    model: params.model,
    messageCount: params.messages.length,
  })

  const text = await completeGeminiChat({
    messages: params.messages,
    model: params.model,
    signal: params.signal,
  })
  if (!text.trim()) {
    throw new Error('Gemini returned an empty reply.')
  }
  params.onDelta(text)
  console.info('[JARVIS_GEMINI] basic chat success, chars=', text.length)
  return text
}
