import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Maps shorthand folder names to absolute paths under the user profile (Windows/macOS/Linux).
 */
const FOLDER_ALIASES: Record<string, string[]> = {
  downloads: ['downloads', 'download'],
  documents: ['documents', 'docs', 'my documents'],
  desktop: ['desktop'],
  pictures: ['pictures', 'photos', 'images'],
  videos: ['videos'],
  music: ['music'],
}

/**
 * Expands tokens like "downloads" or "my downloads folder" to a real directory under homedir.
 * If no alias matches, returns the original string (caller may still resolve as absolute/relative path).
 */
export function expandUserPathAlias(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '')
  if (!trimmed) return trimmed

  const lower = trimmed.toLowerCase()
  const home = os.homedir()

  for (const [folder, synonyms] of Object.entries(FOLDER_ALIASES)) {
    for (const syn of synonyms) {
      if (lower === syn || lower.includes(`${syn} folder`) || lower === `my ${syn}`) {
        const cap = folder.charAt(0).toUpperCase() + folder.slice(1)
        const joined = path.join(home, cap)
        if (fs.existsSync(joined)) return joined
      }
    }
  }

  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(home, trimmed.slice(2))
  }

  return trimmed
}
