import fs from 'node:fs'
import os from 'node:os'

interface AppTarget {
  win32: string
  darwin: string
  linux: string
}

/**
 * Logical app name → per-OS launch command.
 * On Windows we prefer a verified .exe path when present, then fall back to PATH tokens.
 */
const APP_REGISTRY: Record<string, AppTarget> = {
  'vs code': { win32: 'code', darwin: 'code', linux: 'code' },
  vscode: { win32: 'code', darwin: 'code', linux: 'code' },
  code: { win32: 'code', darwin: 'code', linux: 'code' },
  chrome: { win32: 'chrome', darwin: 'Google Chrome', linux: 'google-chrome' },
  google: { win32: 'chrome', darwin: 'Google Chrome', linux: 'google-chrome' },
  edge: { win32: 'msedge', darwin: 'Microsoft Edge', linux: 'microsoft-edge' },
  figma: { win32: 'figma', darwin: 'Figma', linux: 'figma' },
  discord: { win32: 'discord', darwin: 'Discord', linux: 'discord' },
  terminal: { win32: 'wt', darwin: 'Terminal', linux: 'x-terminal-emulator' },
  'windows terminal': { win32: 'wt', darwin: 'Terminal', linux: 'x-terminal-emulator' },
  cmd: { win32: 'cmd', darwin: 'Terminal', linux: 'x-terminal-emulator' },
  notepad: { win32: 'notepad', darwin: 'TextEdit', linux: 'gedit' },
}

/** Optional full paths tried first on Windows (first existing wins). */
const WIN32_EXE_CANDIDATES: Record<string, string[]> = {
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  code: [
    `${process.env.LOCALAPPDATA ?? ''}\\Programs\\Microsoft VS Code\\Code.exe`.replace(/^\\/, ''),
    'C:\\Program Files\\Microsoft VS Code\\Code.exe',
    'C:\\Program Files\\Microsoft VS Code Insiders\\Code.exe',
  ],
  discord: [`${process.env.LOCALAPPDATA ?? ''}\\Discord\\Discord.exe`],
  figma: [`${process.env.LOCALAPPDATA ?? ''}\\Figma\\Figma.exe`],
  msedge: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
}

function pickExistingWin32Path(candidates: string[]): string | null {
  for (const c of candidates) {
    if (!c || c.startsWith('\\')) continue
    const withoutArgs = c.split(' ')[0]
    if (withoutArgs.endsWith('.exe') && fs.existsSync(withoutArgs)) return c
  }
  return null
}

function quoteIfNeeded(token: string): string {
  if (/[\s"]/.test(token)) return `"${token.replace(/"/g, '\\"')}"`
  return token
}

/**
 * Resolves a user-facing app label (e.g. "VS Code", "chrome") to a string passed to the shell / spawn.
 */
export function resolveApplicationCommand(input: string): string | null {
  const key = input.trim().toLowerCase()
  const target = APP_REGISTRY[key]
  if (!target) return null

  const platform = os.platform()
  if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') return null

  if (platform === 'win32') {
    const short = target.win32
    const exeList = WIN32_EXE_CANDIDATES[short] ?? WIN32_EXE_CANDIDATES[key]
    if (exeList) {
      const picked = pickExistingWin32Path(exeList)
      if (picked) return picked
    }
    // Windows Terminal is often `wt` on PATH
    return short
  }

  if (platform === 'darwin') {
    // Use `open -a "App Name"` for GUI apps (reliable on macOS).
    return `open -a ${quoteIfNeeded(target.darwin)}`
  }

  return target.linux
}
