/**
 * AI Health Service
 *
 * Tracks live Gemini provider status, records successes/failures,
 * and exposes a status snapshot the renderer can display.
 */

import { safeLogger } from '../main/safeLogger.js'
import { canUseConfiguredGemini, getEffectiveGeminiApiKey, resolveGeminiModel } from './geminiEnv.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIProviderStatus = 'online' | 'offline' | 'degraded' | 'unknown'

export interface AIHealthSnapshot {
  status:           AIProviderStatus
  provider:         string
  model:            string
  apiKeyConfigured: boolean
  lastSuccessAt:    string | null   // ISO timestamp
  lastFailureAt:    string | null
  lastError:        string | null
  successCount:     number
  failureCount:     number
  avgLatencyMs:     number | null
  retryCount:       number
}

// ─── Internal state ───────────────────────────────────────────────────────────

let _status:        AIProviderStatus = 'unknown'
let _lastSuccessAt: Date | null      = null
let _lastFailureAt: Date | null      = null
let _lastError:     string | null    = null
let _successCount   = 0
let _failureCount   = 0
let _retryCount     = 0
const _latencies: number[] = []

// ─── State updates (called by geminiProvider) ─────────────────────────────────

export function recordSuccess(latencyMs: number): void {
  _status        = 'online'
  _lastSuccessAt = new Date()
  _lastError     = null
  _successCount++
  _latencies.push(latencyMs)
  if (_latencies.length > 20) _latencies.shift()
  safeLogger.info(`[JARVIS_AI] provider online — latency=${latencyMs}ms success#${_successCount}`)
}

export function recordFailure(error: string): void {
  _lastFailureAt = new Date()
  _lastError     = error.slice(0, 300)
  _failureCount++
  // If we had a recent success, mark as degraded instead of fully offline
  const recentSuccess = _lastSuccessAt && (Date.now() - _lastSuccessAt.getTime()) < 5 * 60_000
  _status = recentSuccess ? 'degraded' : 'offline'
  safeLogger.warn(`[JARVIS_AI] provider ${_status} — ${_lastError}`)
}

export function recordRetry(): void {
  _retryCount++
  safeLogger.info(`[JARVIS_AI] retry attempt #${_retryCount}`)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAIStatus(): AIHealthSnapshot {
  const keyOk = canUseConfiguredGemini()

  // If key is not configured, status is always offline regardless of ping results
  const effectiveStatus: AIProviderStatus = !keyOk ? 'offline' : _status

  const avgLatencyMs = _latencies.length
    ? Math.round(_latencies.reduce((a, b) => a + b, 0) / _latencies.length)
    : null

  return {
    status:           effectiveStatus,
    provider:         'gemini',
    model:            resolveGeminiModel(),
    apiKeyConfigured: keyOk,
    lastSuccessAt:    _lastSuccessAt?.toISOString() ?? null,
    lastFailureAt:    _lastFailureAt?.toISOString() ?? null,
    lastError:        keyOk ? _lastError : 'GEMINI_API_KEY not set in .env',
    successCount:     _successCount,
    failureCount:     _failureCount,
    avgLatencyMs,
    retryCount:       _retryCount,
  }
}

/** Force a live ping and update health status. Returns the new snapshot. */
export async function pingProvider(): Promise<AIHealthSnapshot> {
  const key = getEffectiveGeminiApiKey()
  if (!key) {
    _status    = 'offline'
    _lastError = 'GEMINI_API_KEY not set in .env — get a free key at https://aistudio.google.com/apikey'
    safeLogger.warn('[JARVIS_AI] ping skipped — no API key')
    return getAIStatus()
  }

  const t0 = Date.now()
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: resolveGeminiModel() })
    const result = await model.generateContent('ping', { timeout: 12_000 })
    void result.response.text()
    recordSuccess(Date.now() - t0)
    safeLogger.info('[JARVIS_AI] ping ok')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    recordFailure(msg)
  }

  return getAIStatus()
}
