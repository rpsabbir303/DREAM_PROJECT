/**
 * Parses desktop app automation intents from natural chat text.
 * Extend alias maps and PHRASE_TO_APP as more actions are added.
 */

export type DesktopAppKey = 'chrome' | 'whatsapp' | 'vscode' | 'spotify' | 'notepad' | 'calculator'

export type ParsedDesktopAutomation =
  | { kind: 'open'; app: DesktopAppKey }
  | { kind: 'close'; app: DesktopAppKey }

const OPEN_VERBS = /^(open|launch|start|run)\s+(?:the\s+|my\s+)?/i
const CLOSE_VERBS = /^(close|stop|exit|quit|kill|end)\s+(?:the\s+|my\s+)?/i

/**
 * Longest-first alias list — multi-word aliases must appear before their sub-phrases.
 * Normalised by the caller to lowercase before comparison.
 */
const PHRASE_TO_APP: Array<{ phrase: string; app: DesktopAppKey }> = [
  // Chrome
  { phrase: 'google chrome', app: 'chrome' },
  { phrase: 'chrome browser', app: 'chrome' },
  { phrase: 'chrome', app: 'chrome' },

  // WhatsApp  — all common misspellings / spacing variants
  { phrase: "what's app", app: 'whatsapp' },
  { phrase: 'whats app', app: 'whatsapp' },
  { phrase: 'whatsapp', app: 'whatsapp' },
  { phrase: 'whats', app: 'whatsapp' }, // "open whats" edge-case alias

  // VS Code
  { phrase: 'visual studio code', app: 'vscode' },
  { phrase: 'vs code', app: 'vscode' },
  { phrase: 'vscode', app: 'vscode' },
  { phrase: 'vs-code', app: 'vscode' },
  { phrase: 'code', app: 'vscode' },

  // Spotify
  { phrase: 'spotify', app: 'spotify' },

  // Notepad
  { phrase: 'notepad', app: 'notepad' },
  { phrase: 'note pad', app: 'notepad' },
  { phrase: 'text editor', app: 'notepad' },

  // Calculator
  { phrase: 'calculator', app: 'calculator' },
  { phrase: 'calc', app: 'calculator' },
]

/** Normalise input: collapse whitespace, strip punctuation that isn't alphabetic. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'") // smart quotes → straight apostrophe
    .replace(/\s+/g, ' ')
    .trim()
}

function matchAppName(rest: string): DesktopAppKey | null {
  const n = normalise(rest)
  if (!n) return null
  for (const { phrase, app } of PHRASE_TO_APP) {
    if (n === phrase || n.startsWith(`${phrase} `)) return app
  }
  return null
}

/**
 * Try to match a single app phrase exactly (no trailing text beyond optional punctuation).
 * Returns the app key, or null if unrecognised or has trailing garbage.
 */
function matchExactApp(rest: string): DesktopAppKey | null {
  const app = matchAppName(rest)
  if (!app) return null

  const allowedPhrases = PHRASE_TO_APP.filter((p) => p.app === app).map((p) => p.phrase)
  const matchedPhrase = allowedPhrases.find(
    (phrase) => normalise(rest) === phrase || normalise(rest).startsWith(`${phrase} `),
  )
  if (!matchedPhrase) return null

  const suffix = normalise(rest).slice(matchedPhrase.length).trim()
  if (suffix.length > 0 && !/^[.!?]$/.test(suffix)) return null

  return app
}

/** Returns a parsed command or null if this is not a desktop automation line. */
export function parseDesktopAutomationIntent(raw: string): ParsedDesktopAutomation | null {
  const trimmed = normalise(raw)
  if (trimmed.length < 3) return null

  let rest: string | null = null
  let kind: 'open' | 'close' | null = null

  if (OPEN_VERBS.test(trimmed)) {
    kind = 'open'
    rest = trimmed.replace(OPEN_VERBS, '').trim()
  } else if (CLOSE_VERBS.test(trimmed)) {
    kind = 'close'
    rest = trimmed.replace(CLOSE_VERBS, '').trim()
  }

  if (!kind || !rest) return null

  const app = matchExactApp(rest)
  if (!app) return null

  return kind === 'open' ? { kind: 'open', app } : { kind: 'close', app }
}

/**
 * Handles compound commands like "close WhatsApp and Notepad" or "open Chrome and Spotify".
 * Returns an ordered list of intents, or null if the input is not a valid compound command.
 */
export function parseMultiIntent(raw: string): ParsedDesktopAutomation[] | null {
  const trimmed = normalise(raw)
  if (trimmed.length < 3) return null

  let kind: 'open' | 'close' | null = null
  let rest = ''

  if (OPEN_VERBS.test(trimmed)) {
    kind = 'open'
    rest = trimmed.replace(OPEN_VERBS, '').trim()
  } else if (CLOSE_VERBS.test(trimmed)) {
    kind = 'close'
    rest = trimmed.replace(CLOSE_VERBS, '').trim()
  }

  if (!kind || !rest) return null

  // Must contain at least one " and " to be a compound command
  if (!/\s+and\s+/i.test(rest)) return null

  const parts = rest.split(/\s+and\s+/i).map((p) => p.trim())
  const intents: ParsedDesktopAutomation[] = []

  for (const part of parts) {
    const app = matchAppName(part)
    if (!app) return null // any unrecognised app aborts the whole compound command
    intents.push(kind === 'open' ? { kind: 'open', app } : { kind: 'close', app })
  }

  return intents.length >= 2 ? intents : null
}

export function displayNameForApp(app: DesktopAppKey): string {
  const labels: Record<DesktopAppKey, string> = {
    chrome: 'Chrome',
    whatsapp: 'WhatsApp',
    vscode: 'VS Code',
    spotify: 'Spotify',
    notepad: 'Notepad',
    calculator: 'Calculator',
  }
  return labels[app]
}
