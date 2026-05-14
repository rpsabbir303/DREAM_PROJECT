import OpenAI from 'openai'
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from 'openai/error'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { ChatMessage } from '../../../shared/interfaces/ipc.js'
import { getEffectiveOpenAiApiKey, readProcessEnv } from '../openAiEnv.js'
import { fetchWithDeadline, readStreamChunkWithTimeout } from '../utils/network.js'

const OPENAI_FETCH_DEADLINE_MS = Math.min(
  Math.max(30_000, Number(process.env.OPENAI_FETCH_TIMEOUT_MS ?? 120_000)),
  600_000,
)

/** Max wait per `read()` on the SSE body (stall / hung proxy). */
const STREAM_CHUNK_READ_MS = Math.min(
  Math.max(45_000, Number(process.env.JARVIS_STREAM_CHUNK_READ_MS ?? 120_000)),
  600_000,
)

/** OpenAI Chat Completions message shapes (tools + streaming). */
export type OpenAiToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type OpenAiChatCompletionMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

interface StreamOptions {
  messages: ChatMessage[]
  model?: string
  onDelta: (chunk: string) => void
  signal?: AbortSignal
}

interface StreamRawOptions {
  messages: OpenAiChatCompletionMessage[]
  model?: string
  onDelta: (chunk: string) => void
  signal?: AbortSignal
}

interface CompleteOptions {
  messages: OpenAiChatCompletionMessage[]
  model?: string
  tools?: unknown[]
  toolChoice?: 'auto' | 'none' | 'required'
  signal?: AbortSignal
}

function getApiKey() {
  const apiKey = getEffectiveOpenAiApiKey()
  if (!apiKey) {
    const raw = readProcessEnv('OPENAI_API_KEY')
    if (!raw) {
      throw new Error(
        'OPENAI_API_KEY is missing. Add a real key to the project root `.env` (Electron loads it via dotenv — not `.env.example`).',
      )
    }
    throw new Error(
      'OPENAI_API_KEY is set but does not look like a valid OpenAI secret key (expected `sk-…`). Replace template values in `.env` with your key from https://platform.openai.com/api-keys',
    )
  }
  return apiKey
}

function resolveModel(model?: string) {
  return model ?? readProcessEnv('OPENAI_MODEL') ?? 'gpt-4o-mini'
}

function toSdkMessages(messages: OpenAiChatCompletionMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === 'system') {
      return { role: 'system', content: m.content }
    }
    if (m.role === 'user') {
      return { role: 'user', content: m.content }
    }
    if (m.role === 'assistant') {
      if (m.tool_calls?.length) {
        return {
          role: 'assistant',
          content: m.content,
          tool_calls: m.tool_calls,
        }
      }
      return { role: 'assistant', content: m.content ?? '' }
    }
    return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content }
  })
}

function mapSdkFailure(error: unknown): never {
  if (error instanceof APIUserAbortError) {
    throw new Error('The request was cancelled.')
  }
  if (error instanceof APIConnectionTimeoutError) {
    throw new Error('OpenAI request timed out. Check your network or increase OPENAI_FETCH_TIMEOUT_MS.')
  }
  if (error instanceof APIConnectionError) {
    throw new Error(`Could not reach OpenAI (network): ${error.message}`)
  }
  if (error instanceof APIError) {
    const status = error.status
    const body = error.error
    const detail =
      body && typeof body === 'object' && 'message' in body ? String((body as { message?: unknown }).message) : error.message

    if (status === 401) {
      throw new Error('Invalid or revoked OpenAI API key (HTTP 401). Check OPENAI_API_KEY in `.env`.')
    }
    if (status === 403) {
      throw new Error(`OpenAI access denied (HTTP 403): ${detail}`)
    }
    if (status === 429) {
      throw new Error(`OpenAI rate limit or quota exceeded (HTTP 429): ${detail}`)
    }
    if (status === 503 || status === 502) {
      throw new Error(`OpenAI service temporarily unavailable (HTTP ${status}): ${detail}`)
    }

    throw new Error(`OpenAI error${status != null ? ` (HTTP ${status})` : ''}: ${detail}`)
  }
  if (error instanceof Error) {
    throw error
  }
  throw new Error(String(error))
}

/** Maps persisted chat rows to OpenAI user/assistant/system messages (plain text only). */
export function chatMessagesToOpenAi(messages: ChatMessage[]): OpenAiChatCompletionMessage[] {
  return messages
    .filter((m) => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content })) as OpenAiChatCompletionMessage[]
}

/**
 * Non-streaming chat completion via the official OpenAI SDK (basic MVP).
 */
export async function completeOpenAiChat({
  messages,
  model,
  tools,
  toolChoice = 'auto',
  signal,
}: CompleteOptions): Promise<{
  role: 'assistant'
  content: string | null
  tool_calls?: OpenAiToolCall[]
}> {
  const rawKey = readProcessEnv('OPENAI_API_KEY')
  const effectiveKey = getEffectiveOpenAiApiKey()
  console.info('[JARVIS_OPENAI] env check', {
    OPENAI_API_KEY_set: Boolean(rawKey),
    OPENAI_API_KEY_usable: Boolean(effectiveKey),
    keySuffix: effectiveKey ? `…${effectiveKey.slice(-4)}` : rawKey ? '(set but not sk- / template?)' : '(unset)',
    OPENAI_MODEL: readProcessEnv('OPENAI_MODEL') ?? '(unset → gpt-4o-mini)',
  })

  const apiKey = getApiKey()
  const targetModel = resolveModel(model)

  const client = new OpenAI({
    apiKey,
    maxRetries: 1,
    timeout: OPENAI_FETCH_DEADLINE_MS,
  })

  const createParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: targetModel,
    messages: toSdkMessages(messages),
    stream: false,
  }
  if (tools?.length) {
    createParams.tools = tools as OpenAI.Chat.ChatCompletionTool[]
    createParams.tool_choice = toolChoice
  }

  console.info('[JARVIS_OPENAI] SDK chat.completions.create start', {
    model: targetModel,
    stream: false,
    messageCount: messages.length,
    hasTools: Boolean(tools?.length),
  })

  let completion: OpenAI.Chat.ChatCompletion
  try {
    completion = await client.chat.completions.create(createParams, { signal })
  } catch (error) {
    console.error('[JARVIS_OPENAI] SDK request failed (full error)', error)
    mapSdkFailure(error)
  }

  console.info('[JARVIS_OPENAI] SDK response id=', completion.id, 'choices=', completion.choices?.length ?? 0)

  const message = completion.choices[0]?.message
  if (!message || message.role !== 'assistant') {
    console.error('[JARVIS_OPENAI] unexpected completion shape', JSON.stringify(completion).slice(0, 400))
    throw new Error('OpenAI returned an unexpected completion shape.')
  }

  console.info('[JARVIS_OPENAI] assistant text length=', (message.content ?? '').trim().length, 'tool_calls=', message.tool_calls?.length ?? 0)

  return {
    role: 'assistant',
    content: message.content ?? null,
    tool_calls: message.tool_calls as OpenAiToolCall[] | undefined,
  }
}

/**
 * Streaming completion using native OpenAI message objects (legacy; not used by basic chat MVP).
 */
export async function streamOpenAiChatRaw({
  messages,
  model,
  onDelta,
  signal,
}: StreamRawOptions): Promise<string> {
  const apiKey = getApiKey()
  const targetModel = resolveModel(model)

  const response = await fetchWithDeadline(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        stream: true,
        messages,
      }),
      signal,
    },
    OPENAI_FETCH_DEADLINE_MS,
    'OpenAI stream',
  )

  if (!response.ok || !response.body) {
    const errorBody = await response.text().catch(() => 'Unknown API error')
    throw new Error(`OpenAI request failed: ${response.status} ${errorBody}`)
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let pending = ''
  let finalText = ''

  while (true) {
    const { done, value } = await readStreamChunkWithTimeout(reader, STREAM_CHUNK_READ_MS)
    if (done) break

    pending += decoder.decode(value, { stream: true })
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
        const chunk = parsed.choices?.[0]?.delta?.content ?? ''
        if (!chunk) continue
        finalText += chunk
        onDelta(chunk)
      } catch {
        /* ignore malformed SSE JSON lines */
      }
    }
  }

  return finalText
}

export async function streamOpenAiResponse({
  messages,
  model,
  onDelta,
  signal,
}: StreamOptions): Promise<string> {
  return streamOpenAiChatRaw({
    messages: chatMessagesToOpenAi(messages),
    model,
    onDelta,
    signal,
  })
}

/**
 * One short non-streaming completion after startup to verify key + network (optional diagnostic).
 */
export async function probeOpenAiConnectivity(): Promise<void> {
  const key = getEffectiveOpenAiApiKey()
  if (!key) {
    console.info('[JARVIS_OPENAI] probe skipped — no usable OPENAI_API_KEY (set a real `sk-…` key in `.env`)')
    return
  }
  const model = resolveModel(undefined)
  try {
    console.info('[JARVIS_OPENAI] probe: test chat completion starting', { model })
    const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 25_000 })
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 16,
      stream: false,
    })
    const text = res.choices[0]?.message?.content?.trim() ?? ''
    console.info('[JARVIS_OPENAI] test request successful', {
      model,
      responseId: res.id,
      replyLen: text.length,
      replyPreview: text.slice(0, 80),
    })
  } catch (err) {
    console.error('[JARVIS_OPENAI] test request failed (raw)', err)
    try {
      mapSdkFailure(err)
    } catch (mapped) {
      console.error('[JARVIS_OPENAI] test request failed:', mapped instanceof Error ? mapped.message : mapped)
    }
  }
}
