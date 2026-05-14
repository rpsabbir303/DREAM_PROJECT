import type { Content } from '@google/generative-ai'
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
} from '@google/generative-ai'
import type { ChatMessage } from '../../../shared/interfaces/ipc.js'
import { getEffectiveGeminiApiKey, resolveGeminiModel } from '../geminiEnv.js'
import { readProcessEnv } from '../openAiEnv.js'

const GEMINI_TIMEOUT_MS = Math.min(
  Math.max(30_000, Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? process.env.OPENAI_FETCH_TIMEOUT_MS ?? 120_000)),
  600_000,
)

function mapGeminiFailure(error: unknown): never {
  if (error instanceof GoogleGenerativeAIAbortError) {
    throw new Error('Gemini request was cancelled or timed out. Check GEMINI_FETCH_TIMEOUT_MS / network.')
  }
  if (error instanceof GoogleGenerativeAIFetchError) {
    const s = error.status
    if (s === 400) throw new Error(`Gemini bad request (HTTP 400): ${error.message}`)
    if (s === 401 || s === 403) {
      throw new Error(`Invalid or unauthorized Gemini API key (HTTP ${s}). Verify GEMINI_API_KEY in .env (Google AI Studio).`)
    }
    if (s === 429) {
      throw new Error(`Gemini quota or rate limit exceeded (HTTP 429): ${error.message}`)
    }
    if (s != null && s >= 500) {
      throw new Error(`Gemini server error (HTTP ${s}): ${error.message}`)
    }
    throw new Error(`Gemini HTTP error${s != null ? ` (${s})` : ''}: ${error.message}`)
  }
  if (error instanceof GoogleGenerativeAIRequestInputError) {
    throw new Error(`Gemini request invalid: ${error.message}`)
  }
  if (error instanceof GoogleGenerativeAIResponseError) {
    throw new Error(`Gemini response error: ${error.message}`)
  }
  if (error instanceof GoogleGenerativeAIError) {
    throw new Error(`Gemini error: ${error.message}`)
  }
  if (error instanceof Error) {
    throw error
  }
  throw new Error(String(error))
}

function buildSystemInstruction(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
    .trim()
}

function buildGeminiContents(messages: ChatMessage[]): Content[] {
  const contents: Content[] = []
  for (const m of messages) {
    if (m.role === 'system') continue
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] })
    } else if (m.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: m.content }] })
    }
  }
  return contents
}

/**
 * Single non-streaming completion (MVP parity with OpenAI basic chat).
 */
export async function completeGeminiChat(params: {
  messages: ChatMessage[]
  model?: string
  signal?: AbortSignal
}): Promise<string> {
  const apiKey = getEffectiveGeminiApiKey()
  const targetModel = params.model?.trim() || resolveGeminiModel()

  console.info('[JARVIS_GEMINI] env check', {
    GEMINI_API_KEY_usable: Boolean(apiKey),
    GEMINI_MODEL_env: readProcessEnv('GEMINI_MODEL') ?? '(unset → default)',
    targetModel,
    messageCount: params.messages.length,
  })

  if (!apiKey) {
    const raw = readProcessEnv('GEMINI_API_KEY')
    if (!raw) {
      throw new Error(
        'GEMINI_API_KEY is missing. Add it to the project root `.env` (see https://aistudio.google.com/apikey).',
      )
    }
    throw new Error('GEMINI_API_KEY is set but looks like a placeholder — use a real key from Google AI Studio.')
  }

  const systemInstruction = buildSystemInstruction(params.messages)
  const contents = buildGeminiContents(params.messages)
  if (contents.length === 0) {
    throw new Error('Gemini: no user/model messages to send.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: targetModel,
    systemInstruction: systemInstruction.length > 0 ? systemInstruction : undefined,
  })

  console.info('[JARVIS_GEMINI] generateContent start', { model: targetModel, contents: contents.length })

  let result: Awaited<ReturnType<typeof model.generateContent>>
  try {
    result = await model.generateContent({ contents }, { signal: params.signal, timeout: GEMINI_TIMEOUT_MS })
  } catch (error) {
    console.error('[JARVIS_GEMINI] generateContent failed (raw)', error)
    mapGeminiFailure(error)
  }

  const usage = result.response.usageMetadata
  if (usage) {
    console.info('[JARVIS_GEMINI] usageMetadata', {
      promptTokenCount: usage.promptTokenCount,
      candidatesTokenCount: usage.candidatesTokenCount,
      totalTokenCount: usage.totalTokenCount,
    })
  }

  try {
    const text = result.response.text().trim()
    console.info('[JARVIS_GEMINI] generateContent success', { model: targetModel, outChars: text.length })
    return text
  } catch (err) {
    console.error('[JARVIS_GEMINI] response.text() failed (blocked or empty candidates?)', err)
    mapGeminiFailure(err)
  }
}
