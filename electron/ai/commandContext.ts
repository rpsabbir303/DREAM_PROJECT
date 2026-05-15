import type { AssistantIntentType, ChatMessage, CommandLogRecord, ParsedIntent } from '../../shared/interfaces/ipc.js'
import type { CommandAmbiguity } from '../../shared/ai/jarvisCommandIntel.js'

const WIN_PATH_RE = /\b[A-Za-z]:\\(?:[^<>:"|*?\n\r]+|\\[^<>:"|*?\n\r]*)*/g
const POSIX_PATH_RE = /(?:~\/|\/)(?:[\w.-]+\/?)+/g

function looksLikeFilesystemPath(target: string): boolean {
  const t = target.trim()
  return /^[A-Za-z]:\\/.test(t) || /^\//.test(t) || /^~\//.test(t)
}

/**
 * Pulls path-like strings from recent chat for follow-ups ("now run the backend there").
 */
export function extractPathHintsFromHistory(history: ChatMessage[], maxMessages = 10): string[] {
  const hints = new Set<string>()
  const slice = history.slice(-maxMessages)
  for (const message of slice) {
    const text = message.content
    const win = text.match(WIN_PATH_RE)
    const posix = text.match(POSIX_PATH_RE)
    win?.forEach((p) => hints.add(p.trim()))
    posix?.forEach((p) => hints.add(p.trim()))
  }
  return [...hints].slice(-4)
}

/**
 * Strips conversational prefixes so natural phrasing classifies like bare commands.
 * Applied repeatedly until no more prefix patterns match.
 */
export function stripCommandPreamble(raw: string): string {
  let s = raw.trim()

  // Order matters: more specific patterns first to avoid partial-stripping
  const patterns: RegExp[] = [
    // ── Direct address ────────────────────────────────────────────────────
    /^(hey\s+|hi\s+|ok\s+|okay\s+|yo\s+|hello\s+)?(jarvis\s*,?\s*)+/i,
    /^(dear\s+jarvis\s*,?\s*)/i,

    // ── Politeness / auxiliary ────────────────────────────────────────────
    /^(please\s+|pls\s+|kindly\s+)/i,
    /^(can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+)/i,
    /^(can\s+you\s+please\s+|could\s+you\s+please\s+|would\s+you\s+please\s+)/i,

    // ── Narrative / instructional ─────────────────────────────────────────
    /^(i\s+say\s+|i\s+said\s+)/i,
    /^(tell\s+me\s+to\s+|remind\s+me\s+to\s+)/i,
    /^(go\s+ahead\s+and\s+|go\s+on\s+and\s+)/i,
    /^(just\s+|simply\s+|quickly\s+|rapidly\s+)/i,

    // ── Softeners / hedges ────────────────────────────────────────────────
    /^(try\s+to\s+|try\s+and\s+)/i,
    /^(make\s+sure\s+(?:to\s+)?|be\s+sure\s+to\s+)/i,
    /^(help\s+me\s+(?:to\s+)?)/i,

    // ── Time / context ────────────────────────────────────────────────────
    /^(for\s+me\s*,?\s*)/i,
    /^(actually\s*,?\s*|basically\s*,?\s*|literally\s*,?\s*)/i,
  ]

  let changed = true
  while (changed) {
    changed = false
    for (const re of patterns) {
      const next = s.replace(re, '').trim()
      if (next !== s) {
        s = next
        changed = true
      }
    }
  }
  return s.trim()
}

/**
 * Non-path cues from recent chat + current line (editor preference, backend follow-ups).
 */
export function buildImplicitContextLine(history: ChatMessage[], currentUserLine: string): string | null {
  const recent = history.slice(-10).map((m) => m.content)
  const blob = [...recent, currentUserLine].join('\n')
  const lower = blob.toLowerCase()
  const parts: string[] = []

  if (/\b(vs code|vscode|visual studio code)\b/i.test(blob)) {
    parts.push('Recent phrasing suggests Visual Studio Code as the likely editor for code projects.')
  }
  if (/\bcursor\b/i.test(lower) && !/\bcursor\s+(pointer|position)\b/i.test(lower)) {
    parts.push('User may prefer Cursor for IDE-style work.')
  }
  if (/\b(run|start)\s+(the\s+)?backend\b/i.test(currentUserLine)) {
    parts.push(
      'Follow-up about "backend" often means a dev server — only whitelisted terminal commands can run here; otherwise guide them to run npm/yarn/pnpm in the project directory.',
    )
  }
  if (/\b(same|that)\s+(folder|project|repo|directory)\b/i.test(currentUserLine)) {
    parts.push('User may refer to a folder or path mentioned earlier in the thread — use continuity hint if it fits.')
  }

  return parts.length > 0 ? parts.join(' ') : null
}

/** Best single continuity hint for prompts (most recent path last). */
export function pickPrimaryContinuityHint(paths: string[]): string | null {
  if (paths.length === 0) return null
  return paths[paths.length - 1] ?? null
}

export function formatRecentCommandsForPrompt(logs: CommandLogRecord[], limit = 6): string[] {
  return logs.slice(0, limit).map((row) => `${row.result}: ${row.command.slice(0, 200)}`)
}

/**
 * Heuristic: path-like targets are clearer; natural-language project labels need clarification unless continuity exists.
 */
export function estimateTargetAmbiguity(
  intent: AssistantIntentType,
  target: string,
  continuityPath: string | null,
): CommandAmbiguity {
  const t = target.trim()
  if (!t) return 'high'

  if (intent === 'open_application' || intent === 'open_url') {
    if (intent === 'open_url' && /^https?:\/\//i.test(t)) return 'low'
    if (intent === 'open_application' && t.length <= 48 && !/\b(delete|remove|format)\b/i.test(t)) return 'low'
  }

  if (intent === 'open_folder' || intent === 'open_project') {
    if (looksLikeFilesystemPath(t)) return 'low'
    if (continuityPath && t.length < 64) return 'medium'
    if (t.length < 72 && /project|repo|frontend|backend|workspace|code/i.test(t)) return 'high'
    return 'medium'
  }

  if (intent === 'run_safe_command') {
    if (t.length > 120) return 'medium'
    return 'low'
  }

  return 'low'
}

/** One-line goal string for the system prompt and intent chip. */
export function summarizeGoal(parsed: ParsedIntent, understandingIntent: AssistantIntentType): string {
  const t = parsed.target?.trim() ?? ''
  switch (understandingIntent) {
    case 'open_application':
      return t ? `Launch application: ${t}` : 'Launch an application'
    case 'open_url':
      return t ? `Open URL: ${t}` : 'Open a web address'
    case 'open_folder':
      return t ? `Open folder: ${t}` : 'Open a folder'
    case 'open_project':
      return t ? `Open project workspace: ${t}` : 'Open a project folder'
    case 'run_safe_command':
      return t ? `Run allowed command: ${t}` : 'Run a safe terminal command'
    case 'system_monitoring':
      return 'Report system status'
    default:
      return 'Assist conversationally'
  }
}
