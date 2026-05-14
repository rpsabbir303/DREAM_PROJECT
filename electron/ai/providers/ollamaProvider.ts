import type { ChatMessage } from '../../../shared/interfaces/ipc.js'
import { fetchWithDeadline, readStreamChunkWithTimeout } from '../utils/network.js'

const OLLAMA_FETCH_DEADLINE_MS = Math.min(
  Math.max(15_000, Number(process.env.OLLAMA_FETCH_TIMEOUT_MS ?? 90_000)),
  300_000,
)

const OLLAMA_STREAM_CHUNK_READ_MS = Math.min(
  Math.max(45_000, Number(process.env.JARVIS_STREAM_CHUNK_READ_MS ?? 120_000)),
  600_000,
)

interface StreamOptions {
  messages: ChatMessage[]
  model: string
  onDelta: (chunk: string) => void
  signal?: AbortSignal
}

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

export async function listOllamaModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    if (!response.ok) return []
    const payload = (await response.json()) as { models?: Array<{ name: string }> }
    return (payload.models ?? []).map((model) => model.name)
  } catch {
    return []
  }
}

/** Single-shot chat (non-streaming) for basic MVP parity with OpenAI path. */
export async function completeOllamaChat({
  messages,
  model,
  signal,
}: Omit<StreamOptions, 'onDelta'>): Promise<string> {
  const response = await fetchWithDeadline(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      }),
      signal,
    },
    OLLAMA_FETCH_DEADLINE_MS,
    'Ollama chat',
  )

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown_error')
    throw new Error(`Ollama request failed: ${response.status} ${body}`)
  }

  const json = (await response.json()) as { message?: { content?: string } }
  return (json.message?.content ?? '').trim()
}

export async function streamOllamaResponse({
  messages,
  model,
  onDelta,
  signal,
}: StreamOptions): Promise<string> {
  const response = await fetchWithDeadline(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      }),
      signal,
    },
    OLLAMA_FETCH_DEADLINE_MS,
    'Ollama stream',
  )

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => 'unknown_error')
    throw new Error(`Ollama request failed: ${response.status} ${body}`)
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let pending = ''
  let finalText = ''
  while (true) {
    const { done, value } = await readStreamChunkWithTimeout(reader, OLLAMA_STREAM_CHUNK_READ_MS)
    if (done) break
    pending += decoder.decode(value, { stream: true })
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed) as { message?: { content?: string } }
        const chunk = parsed.message?.content ?? ''
        if (!chunk) continue
        finalText += chunk
        onDelta(chunk)
      } catch {
        /* ignore malformed NDJSON */
      }
    }
  }
  return finalText
}
