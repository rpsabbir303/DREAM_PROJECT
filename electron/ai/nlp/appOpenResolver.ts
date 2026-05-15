/**
 * Canonical app-open target resolution — shared by NLP, Gemini, and appPlugin.
 * Prevents "what's app" / "what s app" from matching Windows "What is new…" shortcuts.
 */

import { normalizeAppTokens } from './normalize.js'
import { resolveAppKey } from './aliases.js'

const JUNK_DISCOVERY_RE =
  /\b(what\s+is\s+new|what'?s\s+new|latest\s+version|release\s+notes|getting\s+started)\b/i

/** True when the phrase is a WhatsApp typo variant (any apostrophe / spacing). */
export function isWhatsAppTypos(phrase: string): boolean {
  if (!phrase?.trim()) return false
  const raw = phrase.trim().toLowerCase()
  const p = normalizeAppTokens(raw)
  const spaced = raw.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  return (
    /^(what'?s?\s*app|what'?app|whats?\s*app|whatsapp|wa)$/i.test(p) ||
    /^what\s+s\s+app$/i.test(spaced) ||
    /^what\s+app$/i.test(spaced) ||
    spaced.replace(/\s/g, '') === 'whatsapp'
  )
}

export function isJunkDiscoveryName(name: string): boolean {
  const n = name.toLowerCase()
  if (JUNK_DISCOVERY_RE.test(n)) return true
  if (/\b(is|are|was|will|can)\b/.test(n) && n.split(/\s+/).length >= 4) return true
  return false
}

export function sanitizeAppOpenParams(params: {
  app?: string
  appKey?: string
  discoveryName?: string
}): { app: string; appKey?: string; discoveryName?: string } {
  const app = (params.app ?? '').trim()
  let discoveryName = params.discoveryName?.trim() || undefined
  const appKey = params.appKey?.trim() || undefined

  if (isWhatsAppTypos(app) || (discoveryName && isWhatsAppTypos(discoveryName))) {
    return { app: 'whatsapp', appKey: 'whatsapp', discoveryName: undefined }
  }

  if (discoveryName && isJunkDiscoveryName(discoveryName)) {
    discoveryName = undefined
  }

  const norm = normalizeAppTokens(app)
  const key = appKey ?? resolveAppKey(norm) ?? resolveAppKey(app.toLowerCase())
  if (key) {
    return { app: norm || key, appKey: key, discoveryName: undefined }
  }

  return { app: norm || app, appKey, discoveryName }
}
