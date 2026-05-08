import fs from 'node:fs'
import path from 'node:path'
import type { ParsedIntent } from '../../shared/interfaces/ipc.js'

const SAFE_COMMANDS = new Set(['ls', 'pwd', 'git status', 'npm run dev'])
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /rmdir\s+\/s/i,
  /format\s+/i,
  /reg\s+add/i,
  /del\s+\/f/i,
  /shutdown/i,
]

function isAllowedHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

function isValidExistingPath(raw: string) {
  const normalized = path.resolve(raw)
  return fs.existsSync(normalized)
}

export function validateIntent(intent: ParsedIntent): { ok: boolean; reason?: string } {
  const target = intent.target.trim()

  if (intent.intent === 'open_url') {
    if (!isAllowedHttpUrl(target)) return { ok: false, reason: 'Only http/https URLs are allowed.' }
    return { ok: true }
  }

  if (intent.intent === 'open_folder' || intent.intent === 'open_project') {
    if (!isValidExistingPath(target)) return { ok: false, reason: 'Path does not exist on disk.' }
    return { ok: true }
  }

  if (intent.intent === 'run_safe_command') {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(target)) return { ok: false, reason: 'Dangerous command pattern blocked.' }
    }
    if (!SAFE_COMMANDS.has(target.toLowerCase())) {
      return { ok: false, reason: 'Command is not in the whitelist.' }
    }
    return { ok: true }
  }

  return { ok: true }
}
