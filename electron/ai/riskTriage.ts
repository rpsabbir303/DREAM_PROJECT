import { containsDangerousShellPattern } from '../security/executionPolicy.js'
import type { CommandRiskLevel } from '../../shared/ai/jarvisCommandIntel.js'

/** Phrases that imply destructive or system-wide actions — never auto-execute tools. */
const BLOCKED_REQUEST_PATTERNS: RegExp[] = [
  /\brm\s+(-rf|-fr|\s+-r)\b/i,
  /\bdelete\s+(all|everything|system|windows)/i,
  /\bdelete\s+system(\s+files?)?\b/i,
  /\b(format|wipe|erase)\s+(disk|drive|hd|ssd|system)/i,
  /\bsystem32\b/i,
  /\bregistry\b.*\b(delete|wipe)\b/i,
  /\bchmod\s+777\b/i,
  /\bsudo\b/i,
  /\bdd\s+if=/i,
  /:()\{\s*:\|:&\s*\};:/,
  />\s*\/dev\//,
  /\bcurl\b.+\|\s*(sh|bash|pwsh)/i,
]

/**
 * Conservative triage on raw user text (before intent parsing).
 * "blocked" means desktop tools must stay off for this turn.
 */
export function triageUserRiskLevel(rawInput: string): CommandRiskLevel {
  const trimmed = rawInput.trim()
  if (!trimmed) return 'none'
  if (containsDangerousShellPattern(trimmed)) return 'blocked'
  if (BLOCKED_REQUEST_PATTERNS.some((re) => re.test(trimmed))) return 'blocked'
  return 'none'
}
