/**
 * Primary intent classifier — runs BEFORE app matching or automation.
 *
 * Separates conversational chat from desktop automation so casual phrases
 * like "hi" never launch apps.
 */

import { safeLogger } from '../../main/safeLogger.js'

// ─── Intent categories ────────────────────────────────────────────────────────

export type PrimaryIntent =
  | 'CHAT'
  | 'APP_OPEN'
  | 'APP_CLOSE'
  | 'WINDOW_CONTROL'
  | 'KEYBOARD'
  | 'MOUSE'
  | 'MULTI_STEP'
  | 'QUESTION'
  | 'SEARCH'
  | 'SYSTEM'
  | 'UNKNOWN'

export interface ClassifiedInput {
  primary:      PrimaryIntent
  /** Normalised text after stripping greetings (for downstream matchers). */
  normalized:   string
  /** True only when an explicit desktop action verb is present. */
  hasActionVerb: boolean
  /** Extracted target after the verb, if any. */
  target:         string | null
  /** 0–1 — how confident we are this is automation (not chat). */
  automationScore: number
}

// ─── Protected chat phrases (NEVER automation) ────────────────────────────────

const CHAT_PHRASES_EXACT = new Set([
  'hi', 'hii', 'hiii', 'hey', 'heya', 'hello', 'hallo', 'hola',
  'yo', 'sup', 'wassup', "what's up", 'whats up', 'what up',
  'how are you', 'how r u', 'how are u', 'hows it going', "how's it going",
  'good morning', 'good afternoon', 'good evening', 'good night',
  'gm', 'gn', 'morning', 'evening',
  'thanks', 'thank you', 'thx', 'ty', 'cheers',
  'ok', 'okay', 'k', 'kk', 'sure', 'yep', 'yeah', 'yes', 'no', 'nope', 'nah',
  'nice', 'cool', 'great', 'awesome', 'perfect', 'got it', 'understood',
  'bye', 'goodbye', 'see you', 'see ya', 'later', 'cya',
  'lol', 'haha', 'hehe',
  'help', 'what can you do', 'who are you',
])

/** Greeting / small-talk patterns (anchored full-string). */
const CHAT_PATTERNS: RegExp[] = [
  /^(hi|hey|hello|yo|sup)[\s!.?]*$/i,
  /^(hi|hey|hello)\s+(jarvis|jervis|buddy|there|friend)[\s!.?]*$/i,
  /^good\s+(morning|afternoon|evening|night)[\s!.?]*$/i,
  /^how\s+(are\s+you|is\s+it\s+going|r\s+u|are\s+u)[\s!.?]*$/i,
  /^what'?s\s+up[\s!.?]*$/i,
  /^thank(s|\s+you)[\s!.?]*$/i,
  /^(ok|okay|sure|yes|no|yep|nope|nah)[\s!.?]*$/i,
  /^(nice|cool|great|awesome|perfect)[\s!.?]*$/i,
  /^(bye|goodbye|see\s+ya)[\s!.?]*$/i,
]

// ─── Action verbs (required for automation) ───────────────────────────────────

const ACTION_VERB_RE = new RegExp(
  '^(' +
  [
    'open', 'launch', 'start', 'run', 'fire up', 'bring up', 'pull up', 'load', 'boot',
    'close', 'quit', 'exit', 'stop', 'kill', 'end', 'terminate', 'shut',
    'focus', 'switch to', 'switch', 'activate', 'bring', 'show', 'go to', 'jump to',
    'minimize', 'minimise', 'hide', 'maximize', 'maximise', 'restore', 'fullscreen',
    'restart', 'relaunch', 'reload', 'reopen',
    'press', 'hit', 'tap', 'type', 'write', 'enter',
    'click', 'double click', 'right click', 'scroll',
    'screenshot', 'mute', 'unmute', 'lock', 'shutdown', 'shut down', 'sleep', 'restart',
    'search', 'find', 'look up', 'google',
    'prepare', 'set up', 'setup',
  ].join('|') +
  ')\\b',
  'i',
)

function extractVerbTarget(s: string): { verb: string; target: string | null } | null {
  const m = s.match(ACTION_VERB_RE)
  if (!m) return null
  const verb = m[1].toLowerCase()
  const rest = s.slice(m[0].length).replace(/^(the|my|a|an)\s+/i, '').trim()
  return { verb, target: rest.length > 0 ? rest : null }
}

function isProtectedChat(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/[!.?,;:]+$/g, '').trim()
  if (!t) return true
  if (CHAT_PHRASES_EXACT.has(t)) return true
  if (t.length <= 3 && !ACTION_VERB_RE.test(t)) return true   // "hi", "ok", "yo"
  for (const re of CHAT_PATTERNS) {
    if (re.test(t)) return true
  }
  return false
}

function mapVerbToPrimary(verb: string, target: string | null): PrimaryIntent {
  const v = verb.toLowerCase()
  if (/^(open|launch|start|run|fire|bring|pull|load|boot|use|access)/.test(v)) return 'APP_OPEN'
  if (/^(close|quit|exit|stop|kill|end|terminate|shut)/.test(v)) return 'APP_CLOSE'
  if (/^(focus|switch|activate|bring|show|go|jump)/.test(v)) return 'WINDOW_CONTROL'
  if (/^(minimize|minimise|hide|maximize|maximise|restore|fullscreen)/.test(v)) return 'WINDOW_CONTROL'
  if (/^(press|hit|tap|type|write|enter)/.test(v)) return 'KEYBOARD'
  if (/^(click|double|right|scroll)/.test(v)) return 'MOUSE'
  if (/^(prepare|set)/.test(v)) return 'MULTI_STEP'
  if (/^(search|find|look|google)/.test(v)) return 'SEARCH'
  if (/^(screenshot|mute|unmute|lock|shutdown|sleep|restart)/.test(v)) return 'SYSTEM'
  if (target) return 'APP_OPEN'
  return 'UNKNOWN'
}

/**
 * Classify user input BEFORE any app alias / fuzzy matching.
 * Returns CHAT for greetings and phrases with no action verb.
 */
export function classifyPrimaryIntent(raw: string): ClassifiedInput {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, ' ')

  if (!normalized || normalized.length < 1) {
    return { primary: 'CHAT', normalized, hasActionVerb: false, target: null, automationScore: 0 }
  }

  // ── Protected chat (highest priority) ─────────────────────────────────────
  if (isProtectedChat(normalized)) {
    safeLogger.info(`[JARVIS_CLASSIFIER] CHAT (protected phrase) — "${normalized}"`)
    return { primary: 'CHAT', normalized, hasActionVerb: false, target: null, automationScore: 0 }
  }

  // ── Questions without action verbs → CHAT / QUESTION ────────────────────
  if (/^(what|who|why|how|when|where|can you|could you|would you|tell me|explain)\b/i.test(normalized)
      && !ACTION_VERB_RE.test(normalized)) {
    const primary: PrimaryIntent = /^(what|who|why|how|when|where)\b/i.test(normalized) ? 'QUESTION' : 'CHAT'
    safeLogger.info(`[JARVIS_CLASSIFIER] ${primary} (question, no verb) — "${normalized}"`)
    return { primary, normalized, hasActionVerb: false, target: null, automationScore: 0.1 }
  }

  // ── Explicit action verb required for automation ──────────────────────────
  const verbInfo = extractVerbTarget(normalized)
  if (!verbInfo) {
    // No verb — short inputs are chat; longer might be bare app names (handled cautiously downstream)
    if (normalized.length < 4 || normalized.split(' ').length === 1) {
      safeLogger.info(`[JARVIS_CLASSIFIER] CHAT (no verb, short) — "${normalized}"`)
      return { primary: 'CHAT', normalized, hasActionVerb: false, target: null, automationScore: 0 }
    }
    safeLogger.info(`[JARVIS_CLASSIFIER] UNKNOWN (no verb) — "${normalized}"`)
    return { primary: 'UNKNOWN', normalized, hasActionVerb: false, target: null, automationScore: 0.2 }
  }

  const primary = mapVerbToPrimary(verbInfo.verb, verbInfo.target)
  const automationScore = verbInfo.target && verbInfo.target.length >= 2 ? 0.92 : 0.5

  safeLogger.info(
    `[JARVIS_CLASSIFIER] ${primary} verb="${verbInfo.verb}" target="${verbInfo.target ?? '—'}" score=${automationScore}`,
  )

  return {
    primary,
    normalized,
    hasActionVerb: true,
    target: verbInfo.target,
    automationScore,
  }
}

/** True if this input must never trigger desktop automation. */
export function isChatOnly(raw: string): boolean {
  return classifyPrimaryIntent(raw).primary === 'CHAT'
}

/** Minimum target length for fuzzy app resolution (prevents "hi" → "history"). */
export const MIN_FUZZY_TARGET_LEN = 4

/** Minimum query length for discovery registry fuzzy match. */
export const MIN_DISCOVERY_QUERY_LEN = 4

/** Short friendly replies when AI is offline but user sends chat. */
const OFFLINE_CHAT_REPLIES: Record<string, string> = {
  hi:      "Hey! What can I help you with today?",
  hey:     "Hey! What can I help you with?",
  hello:   "Hello! I'm here — ask me anything or tell me to open an app.",
  yo:      "Yo! What do you need?",
  sup:     "Hey! What can I do for you?",
  thanks:  "You're welcome!",
  'thank you': "You're welcome!",
  ok:      "Got it.",
  okay:    "Got it.",
}

export function getOfflineChatReply(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/[!.?,;:]+$/g, '').trim()
  if (OFFLINE_CHAT_REPLIES[t]) return OFFLINE_CHAT_REPLIES[t]
  if (isProtectedChat(t)) {
    return "Hey! I'm having trouble reaching the AI service right now, but I can still help with desktop actions — try \"open chrome\" or \"take a screenshot\"."
  }
  return null
}
