/**
 * NLP Normalize — Phase 7
 *
 * Multi-stage input normalization pipeline.
 * Runs BEFORE the regex verb matchers in nlpRouter so that natural,
 * conversational phrasing is reduced to a canonical command form.
 *
 * Stages:
 *  1. Basic cleanup   — lowercase, collapse spaces, normalize punctuation
 *  2. Filler removal  — drop noise words that carry no semantic weight
 *  3. Desire mapping  — "i want X" / "i need X" → "open X"
 *  4. App token fix   — normalize multi-word app name variants
 */

// ─── Stage 1: Basic text cleanup ──────────────────────────────────────────────
import { safeLogger } from '../../main/safeLogger.js'

export function basicClean(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[''`´ʼ]/g, "'")   // normalize apostrophes
    .replace(/["""]/g, '"')
    .replace(/[-–—]/g, ' ')     // dashes → spaces
    .replace(/[.!?,;:]+$/g, '') // strip trailing punctuation
    .replace(/\s{2,}/g, ' ')    // collapse whitespace
    .trim()
}

// ─── Stage 2: Filler word removal ─────────────────────────────────────────────
//
// These words carry no intent — they are conversational glue.
// We remove them after the basic clean so patterns match reliably.

/** Inline filler words/phrases that can appear mid-sentence. */
const FILLER_INLINE: RegExp[] = [
  /\bfor\s+me\b/g,
  /\bplease\b/g,
  /\bkindly\b/g,
  /\bactually\b/g,
  /\bmaybe\b/g,
  /\bliterally\b/g,
  /\bbasically\b/g,
  /\bquickly\b/g,
  /\bright\s+now\b/g,
  /\bimmediately\b/g,
  /\bnow\b/g,
  /\bplz\b/g,
  /\bpls\b/g,
  /\bum+\b/g,
  /\buh+\b/g,
  /\bhmm+\b/g,
  /\blike\b/g,      // "like, open chrome" → "open chrome"
  /\byou\s+know\b/g,
  /\bthough\b/g,
]

export function removeFillerWords(s: string): string {
  let result = s
  for (const re of FILLER_INLINE) {
    result = result.replace(re, ' ')
  }
  return result.replace(/\s{2,}/g, ' ').trim()
}

// ─── Stage 3: Desire-verb → open intent mapping ───────────────────────────────
//
// Phrases like "i want chrome", "i need spotify", "give me notepad"
// express an *intent to open* an application.  We normalize them to
// "open <target>" so the downstream verb matchers can handle them uniformly.
//
// Each pattern strips itself + an optional action verb, leaving only
// the target name.  We then prepend "open ".

interface DesirePattern {
  /** Matches the desire phrase (anchored at start, case-insensitive). */
  re: RegExp
  /** Replacement — usually '' because we prepend "open " ourselves. */
  strip: string
}

const DESIRE_PATTERNS: DesirePattern[] = [
  // ── "i want [to …] X" ───────────────────────────────────────────────
  { re: /^i\s+want\s+to\s+(?:open|use|run|start|launch|have|get|access|see)\s+/,  strip: '' },
  { re: /^i\s+want\s+(?:to\s+)?/,                                                   strip: '' },

  // ── "i need [to …] X" ───────────────────────────────────────────────
  { re: /^i\s+need\s+to\s+(?:open|use|run|start|launch|have|get|access)\s+/,       strip: '' },
  { re: /^i\s+need\s+(?:to\s+)?/,                                                   strip: '' },

  // ── "i'd like [to …] X" / "i would like …" ──────────────────────────
  { re: /^i(?:'d|'\s*d| would)\s+like\s+to\s+(?:open|use|run|start|launch)\s+/,   strip: '' },
  { re: /^i(?:'d|'\s*d| would)\s+like\s+(?:to\s+)?/,                              strip: '' },

  // ── "i wanna X" ─────────────────────────────────────────────────────
  { re: /^i\s+wanna\s+(?:open|use|start|launch|have|get)?\s*/,                     strip: '' },

  // ── "give me / get me / show me / bring me" ──────────────────────────
  { re: /^give\s+me\s+(?:the\s+|a\s+|my\s+)?/,                                     strip: '' },
  { re: /^get\s+me\s+(?:the\s+|a\s+|my\s+)?/,                                      strip: '' },
  { re: /^show\s+me\s+(?:the\s+|a\s+|my\s+)?/,                                     strip: '' },
  { re: /^bring\s+me\s+(?:the\s+|a\s+|my\s+)?/,                                    strip: '' },
  { re: /^fetch\s+me\s+(?:the\s+|a\s+|my\s+)?/,                                    strip: '' },

  // ── "can i / could i / may i …" ─────────────────────────────────────
  { re: /^can\s+i\s+(?:get|have|use|open|see)\s+(?:the\s+|a\s+|my\s+)?/,           strip: '' },
  { re: /^could\s+i\s+(?:get|have|use|open|see)\s+(?:the\s+|a\s+|my\s+)?/,         strip: '' },
  { re: /^may\s+i\s+(?:get|have|use|open|see)\s+(?:the\s+|a\s+|my\s+)?/,           strip: '' },

  // ── "let me / let's …" ──────────────────────────────────────────────
  { re: /^let\s+me\s+(?:open|use|start|launch|have|get|access|see)\s+/,             strip: '' },
  { re: /^let\s+me\s+/,                                                              strip: '' },
  { re: /^let\s*'?s\s+(?:open|start|launch|use|go\s+(?:to|with)|try)\s+/,          strip: '' },
  { re: /^let\s*'?s\s+/,                                                             strip: '' },

  // ── "i'm going to / i'm about to …" ────────────────────────────────
  { re: /^i(?:'m| am)\s+going\s+to\s+(?:open|use|start|launch|run)\s+/,             strip: '' },
  { re: /^i(?:'m| am)\s+about\s+to\s+(?:open|use|start|launch|run)\s+/,             strip: '' },
  { re: /^i(?:'m| am)\s+trying\s+to\s+(?:open|use|start|launch|run)\s+/,            strip: '' },

  // ── "i'm looking for …" → open intent ───────────────────────────────
  { re: /^i(?:'m| am)\s+looking\s+for\s+/,                                           strip: '' },
]

/**
 * Convert desire phrases to "open <target>" so the verb matchers fire correctly.
 * Only applies when the input does NOT already start with a known action verb.
 */
const ALREADY_HAS_VERB =
  /^(open|launch|start|run|close|quit|exit|stop|kill|focus|switch|minimize|maximise|maximize|minimise|restart|relaunch|reload)\b/i

export function applyDesirePatterns(s: string): string {
  if (ALREADY_HAS_VERB.test(s)) return s  // already a direct command

  for (const { re } of DESIRE_PATTERNS) {
    const cleaned = s.replace(re, '').trim()
    if (cleaned && cleaned !== s && cleaned.length >= 2) {
      // Only apply if the result looks like it could be an app name / command
      const result = `open ${cleaned}`
      safeLogger.info(`[JARVIS_NLP] desire-pattern: "${s}" → "${result}"`)
      return result
    }
  }

  return s
}

// ─── Stage 4: App phrase token normalization ──────────────────────────────────
//
// Handles multi-word app name variants before alias lookup.

const APP_TOKEN_FIXES: Array<[RegExp, string]> = [
  [/\bwhat'?s\s+app\b/g,         'whatsapp'],
  [/\bwhat\s+s\s+app\b/g,        'whatsapp'],  // apostrophe stripped → "what s app"
  [/\bwhat'?app\b/g,            'whatsapp'],
  [/\bwhats\s+app\b/g,           'whatsapp'],
  [/\bwhats?app\b/gi,            'whatsapp'],
  [/\bwhatsapp\s+desktop\b/g,    'whatsapp'],
  [/\bvs\s+code\b/g,             'vscode'],
  [/\bvisual\s+studio\s+code\b/g, 'vscode'],
  [/\bgoogle\s+chrome\b/g,       'chrome'],
  [/\bms\s+paint\b/g,            'paint'],
  [/\bmicrosoft\s+paint\b/g,     'paint'],
  [/\bms\s+word\b/g,             'word'],
  [/\bms\s+excel\b/g,            'excel'],
  [/\bms\s+teams\b/g,            'teams'],
  [/\badobes?\s+photoshop\b/g,   'photoshop'],
  [/\badobes?\s+illustrator\b/g, 'illustrator'],
  [/\bnotepad\s*\+\+\b/g,        'notepadpp'],
]

export function normalizeAppTokens(s: string): string {
  let result = s
  for (const [re, replacement] of APP_TOKEN_FIXES) {
    result = result.replace(re, replacement)
  }
  return result
}

// ─── Full pipeline ────────────────────────────────────────────────────────────

/**
 * Run all normalization stages in order.
 * Input: raw user text.
 * Output: canonical command string ready for intent matching.
 */
export function normalizeInput(raw: string): string {
  let s = basicClean(raw)
  s = removeFillerWords(s)
  s = applyDesirePatterns(s)
  s = normalizeAppTokens(s)
  return s
}
