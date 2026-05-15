/**
 * Launch Strategy Resolver
 *
 * Pure-function module — NO side effects, NO I/O.
 *
 * Given an app descriptor, determines the best launch strategy:
 *   exe        → standard Win32 executable (spawn detached)
 *   uwp        → Windows Store / UWP app (explorer shell:AppsFolder)
 *   electron   → Electron-based desktop app (same as exe, different cleanup)
 *   browser    → known web browser (same as exe, browser-aware)
 *   steam      → Steam game or Steam-launched app
 *   cmd_start  → fallback: `cmd /c start "" <name>`
 *
 * Usage:
 *   import { resolveStrategy } from './launchStrategyResolver.js'
 *   const decision = resolveStrategy(discoveredApp)
 */

export type LaunchStrategy =
  | 'exe'
  | 'uwp'
  | 'electron'
  | 'browser'
  | 'steam'
  | 'cmd_start'

export interface StrategyDecision {
  strategy:   LaunchStrategy
  /** Executable / program to spawn (or explorer.exe for UWP) */
  executable: string
  /** Arguments to pass to the executable */
  args:       string[]
  /** Whether to detach the child process from Jarvis's stdio */
  detached:   boolean
  /** 0–100 confidence in this strategy being correct */
  confidence: number
  /** Human-readable reason for the decision */
  reason:     string
}

// ─── Known signatures ─────────────────────────────────────────────────────────

/** Process names / exe names that indicate an Electron-based app. */
const ELECTRON_APPS = new Set([
  'discord', 'discordptb', 'discordcanary',
  'slack',
  'code',           // Visual Studio Code
  'cursor',
  'notion',
  'figma',
  'obsidian',
  'postman',
  'hyper',
  '1password',
  'bitwarden',
  'linear',
  'codeium',
  'zed',
  'insomnia',
  'whatsapp',
  'teams',          // Microsoft Teams (new Electron version)
  'signal',
])

/** Process names that indicate a web browser. */
const BROWSER_APPS = new Set([
  'chrome', 'googlechrome', 'chromium',
  'msedge', 'microsoftedge',
  'firefox', 'firefox_beta',
  'brave', 'brave_browser',
  'opera', 'launcher',
  'vivaldi',
  'arc',
])

/** Path fragments that indicate a Steam game install. */
const STEAM_PATH_FRAGMENTS = [
  'steamapps\\common',
  'steamapps/common',
  'steam\\games',
  'steam/games',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normExeName(exe: string): string {
  return exe
    .split(/[\\/]/).pop()!         // last path segment
    .toLowerCase()
    .replace(/\.exe$/i, '')
}

function isSteamPath(exePath: string): boolean {
  const lower = exePath.toLowerCase()
  return STEAM_PATH_FRAGMENTS.some((f) => lower.includes(f))
}

function isElectronExe(exePath: string, processName: string | null): boolean {
  const name = processName ? normExeName(processName) : normExeName(exePath)
  if (ELECTRON_APPS.has(name)) return true
  // Common Electron indicator: exe is in a folder named after the app
  // (e.g., C:\…\Discord\Discord.exe) — heuristic only
  return false
}

function isBrowserExe(exePath: string, processName: string | null): boolean {
  const name = processName ? normExeName(processName) : normExeName(exePath)
  return BROWSER_APPS.has(name)
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export interface AppDescriptor {
  canonicalName:  string
  executablePath: string | null
  processName:    string | null
  source:         string               // 'start_menu' | 'registry' | 'uwp' | 'running' | ...
  uwpFamilyName?: string
  installLocation?: string | null
}

/**
 * Resolve the best launch strategy for the given app descriptor.
 * This function is synchronous and has no side effects.
 */
export function resolveStrategy(app: AppDescriptor): StrategyDecision {
  const { executablePath, processName, source, uwpFamilyName } = app

  // ── UWP / Store app ───────────────────────────────────────────────────────
  if (uwpFamilyName || source === 'uwp') {
    const familyName = uwpFamilyName ?? ''
    return {
      strategy:   'uwp',
      executable: 'explorer.exe',
      args:       [`shell:AppsFolder\\${familyName}!App`],
      detached:   true,
      confidence: 95,
      reason:     `uwp_package:${familyName}`,
    }
  }

  // ── Steam game ─────────────────────────────────────────────────────────────
  if (executablePath && isSteamPath(executablePath)) {
    return {
      strategy:   'steam',
      executable: executablePath,
      args:       [],
      detached:   true,
      confidence: 88,
      reason:     'steamapps_path',
    }
  }

  // ── Standard .exe path available ──────────────────────────────────────────
  if (executablePath?.toLowerCase().endsWith('.exe')) {
    const isBrowser  = isBrowserExe(executablePath, processName)
    const isElectron = !isBrowser && isElectronExe(executablePath, processName)

    const strategy: LaunchStrategy =
      isBrowser  ? 'browser'   :
      isElectron ? 'electron'  :
                   'exe'

    return {
      strategy,
      executable: executablePath,
      args:       [],
      detached:   true,
      confidence: 92,
      reason:     `${strategy}:exe_path`,
    }
  }

  // ── Process name only (no exe path, e.g. running process) ─────────────────
  if (processName) {
    const name = normExeName(processName)
    if (BROWSER_APPS.has(name)) {
      return {
        strategy:   'browser',
        executable: 'cmd',
        args:       ['/c', 'start', '""', name],
        detached:   false,
        confidence: 60,
        reason:     'browser:process_name',
      }
    }
  }

  // ── Fallback: cmd /c start ─────────────────────────────────────────────────
  const startTarget = app.canonicalName || processName || 'unknown'
  return {
    strategy:   'cmd_start',
    executable: 'cmd',
    args:       ['/c', 'start', '""', startTarget],
    detached:   false,
    confidence: 45,
    reason:     'fallback:cmd_start',
  }
}

/** Format the strategy decision for terminal logging. */
export function formatStrategyLog(decision: StrategyDecision): string {
  return (
    `[JARVIS_EXEC] strategy=${decision.strategy} ` +
    `exe="${decision.executable}" ` +
    `confidence=${decision.confidence} ` +
    `reason=${decision.reason}`
  )
}
