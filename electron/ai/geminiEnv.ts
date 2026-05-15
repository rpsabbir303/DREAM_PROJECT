import { readProcessEnv } from './openAiEnv.js'

const GEMINI_PLACEHOLDER_MARKERS = [
  'your_gemini',
  'your-api-key',
  'changeme',
  'placeholder',
  'example_key',
  'replace_me',
  'replace-with-your',
]

/** True when the key is non-empty and not an obvious template. */
export function looksLikeGeminiApiKey(key: string): boolean {
  const t = key.trim()
  if (t.length < 12) return false
  const lower = t.toLowerCase()
  if (GEMINI_PLACEHOLDER_MARKERS.some((m) => lower.includes(m))) return false
  return true
}

export function getEffectiveGeminiApiKey(): string | null {
  const k = readProcessEnv('GEMINI_API_KEY')
  if (!k) return null
  return looksLikeGeminiApiKey(k) ? k : null
}

export function canUseConfiguredGemini(): boolean {
  return getEffectiveGeminiApiKey() !== null
}

/**
 * Model for `getGenerativeModel({ model })`.
 * Default `gemini-2.5-flash` — verified on Google AI Studio keys (v1beta).
 * Legacy ids like `gemini-1.5-flash` / `gemini-2.0-flash` often 404 on current API.
 */
const DEFAULT_MODEL = 'gemini-2.5-flash'

const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
])

export function resolveGeminiModel(): string {
  let id = (process.env.GEMINI_MODEL ?? '').trim()
  if (id.toLowerCase().startsWith('models/')) {
    id = id.slice('models/'.length).trim()
  }
  if (!id || DEPRECATED_MODELS.has(id)) {
    return DEFAULT_MODEL
  }
  return id
}
