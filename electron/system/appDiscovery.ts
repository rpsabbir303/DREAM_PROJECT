/**
 * Universal App Discovery
 *
 * Scans every installed application on the PC from five sources:
 *   1. Start Menu shortcuts   (.lnk → real exe path)
 *   2. Windows Registry       (Uninstall keys → HKLM + HKCU + WOW64)
 *   3. UWP / Store apps       (Get-AppxPackage → shell:AppsFolder launcher)
 *   4. Running processes      (live snapshot of windowed processes)
 *
 * After scanning, all results are merged into a flat in-memory registry
 * and exposed through `fuzzyResolve(query)` with multi-tier scoring.
 *
 * The first scan runs in the background after Electron is ready.
 * Subsequent calls hit the cache (O(n) fuzzy search, typically <2 ms).
 *
 * Usage:
 *   import { initDiscovery, fuzzyResolve } from './appDiscovery.js'
 *   initDiscovery()                          // call once at startup
 *   const app = await fuzzyResolve('figma')  // resolve at any time
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppSource = 'start_menu' | 'registry' | 'uwp' | 'running'

export interface DiscoveredApp {
  /** Primary display name as reported by the OS */
  canonicalName: string
  /** Lowercase aliases for matching (generated from canonicalName) */
  aliases: string[]
  /** Full path to the main .exe (null for UWP apps) */
  executablePath: string | null
  /** Image name (e.g. "chrome.exe") for process detection */
  processName: string | null
  /** How this entry was found */
  source: AppSource
  /** Install root directory */
  installLocation: string | null
  /** Package family name for UWP apps */
  uwpFamilyName?: string
}

export interface ResolvedDiscovery {
  app: DiscoveredApp
  score: number
  matchReason: string
}

// ─── State ────────────────────────────────────────────────────────────────────

let _registry: DiscoveredApp[] = []
let _indexed       = false
let _scanPromise: Promise<void> | null = null
const REFRESH_INTERVAL_MS = 5 * 60 * 1_000   // full refresh every 5 min
let _refreshTimer: ReturnType<typeof setInterval> | null = null

// ─── Normalisation ────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Generate alias variants from a canonical app name */
function buildAliases(name: string): string[] {
  const base = norm(name)
  const words = base.split(' ').filter(Boolean)
  const aliases = new Set<string>()

  aliases.add(base)

  // Without version suffixes like "2024", "v3", "10.1"
  const noVersion = words.filter((w) => !/^\d+(\.\d+)?$/.test(w)).join(' ')
  if (noVersion && noVersion !== base) aliases.add(noVersion)

  // Drop company prefix (first word if 3+ words): "adobe photoshop" from "adobe photoshop 2025"
  if (words.length >= 3) aliases.add(words.slice(1).join(' '))

  // Drop last word if it's a version: "adobe photoshop" from "adobe photoshop cc"
  if (words.length >= 2) aliases.add(words.slice(0, -1).join(' '))

  // First word only
  if (words[0] && words[0].length >= 3) aliases.add(words[0])

  // Acronym: "vs" from "visual studio", "vsc" from "visual studio code"
  const acronym = words.map((w) => w[0]).join('')
  if (acronym.length >= 2 && acronym.length <= 5) aliases.add(acronym)

  // Fused (no spaces): "photoshop", "visualstudio"
  const fused = words.join('')
  if (fused.length >= 4 && fused !== base) aliases.add(fused)

  return [...aliases].filter(Boolean)
}

// ─── Fuzzy scoring ────────────────────────────────────────────────────────────

function editDistance(a: string, b: string): number {
  // Fast short-circuit
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 8) return 99

  const la = a.length
  const lb = b.length
  const prev = Array.from({ length: lb + 1 }, (_, i) => i)
  const curr = new Array<number>(lb + 1)

  for (let i = 1; i <= la; i++) {
    curr[0] = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let k = 0; k <= lb; k++) prev[k] = curr[k]
  }
  return prev[lb]
}

/**
 * Score 0–100 how well `query` matches `candidate`.
 * Returns { score, reason }.
 */
function scoreMatch(query: string, candidate: DiscoveredApp): { score: number; reason: string } {
  const q = norm(query)
  if (!q) return { score: 0, reason: 'empty' }

  // Check against canonical name and all aliases
  const targets = [norm(candidate.canonicalName), ...candidate.aliases]

  for (const t of targets) {
    if (q === t)                         return { score: 100, reason: `exact:${t}` }
    if (t.startsWith(q) && q.length >= 3) return { score: 88,  reason: `prefix:${t}` }
    if (q.startsWith(t) && t.length >= 3) return { score: 85,  reason: `prefix_rev:${t}` }
    if (t.includes(q)   && q.length >= 3) return { score: 75,  reason: `contains:${t}` }
    if (q.includes(t)   && t.length >= 3) return { score: 72,  reason: `contained_in:${t}` }
  }

  // Word-level: all query words appear in the canonical target
  const qWords    = q.split(' ')
  const nameWords = norm(candidate.canonicalName).split(' ')
  const matchedWords = qWords.filter((qw) =>
    nameWords.some((nw) => nw.startsWith(qw) || qw.startsWith(nw)),
  )
  if (matchedWords.length === qWords.length && qWords.length > 0) {
    return { score: 70, reason: 'all_words_matched' }
  }
  if (matchedWords.length > 0) {
    const ratio = matchedWords.length / Math.max(qWords.length, nameWords.length)
    return { score: Math.round(40 + ratio * 25), reason: `partial_words:${matchedWords.join(',')}` }
  }

  // Edit distance (only for short, single-word queries)
  if (!q.includes(' ') && q.length >= 4) {
    for (const t of targets) {
      if (t.includes(' ')) continue
      const dist = editDistance(q, t)
      const maxLen = Math.max(q.length, t.length)
      if (dist <= 2) {
        return { score: Math.round((1 - dist / maxLen) * 60), reason: `edit_dist:${t}(${dist})` }
      }
    }
  }

  return { score: 0, reason: 'no_match' }
}

// ─── Scanners ─────────────────────────────────────────────────────────────────

/** Run a PowerShell one-liner and return stdout (no throw). */
async function ps(script: string, timeoutMs = 20_000): Promise<string> {
  try {
    const safe   = script.replace(/\n/g, '; ').replace(/"/g, '\\"')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${safe}"`,
      { windowsHide: true, timeout: timeoutMs },
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

// ── Start Menu ────────────────────────────────────────────────────────────────

const START_MENU_PS = `
$shell = New-Object -ComObject WScript.Shell
$dirs = @(
  [Environment]::GetFolderPath('CommonStartMenu'),
  [Environment]::GetFolderPath('StartMenu')
)
foreach ($dir in $dirs) {
  Get-ChildItem -Path $dir -Recurse -Include '*.lnk' -ErrorAction SilentlyContinue |
    ForEach-Object {
      try {
        $lnk = $shell.CreateShortcut($_.FullName)
        $target = $lnk.TargetPath
        if ($target -and $target.EndsWith('.exe')) {
          Write-Output "$($_.BaseName)|$target"
        }
      } catch {}
    }
}
`

async function scanStartMenu(): Promise<DiscoveredApp[]> {
  const out = await ps(START_MENU_PS, 15_000)
  const apps: DiscoveredApp[] = []

  for (const line of out.split('\n')) {
    const [name, exePath] = line.trim().split('|')
    if (!name || !exePath?.endsWith('.exe')) continue

    const processName = exePath.split('\\').pop()!
    apps.push({
      canonicalName:   name.trim(),
      aliases:         buildAliases(name.trim()),
      executablePath:  exePath.trim(),
      processName:     processName.toLowerCase(),
      source:          'start_menu',
      installLocation: exePath.slice(0, exePath.lastIndexOf('\\')) || null,
    })
  }

  return apps
}

// ── Windows Registry ──────────────────────────────────────────────────────────

const REGISTRY_PS = `
$keys = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
foreach ($key in $keys) {
  Get-ItemProperty -Path $key -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne '' } |
    ForEach-Object {
      $icon = $_.DisplayIcon
      $exe  = if ($icon -and $icon.EndsWith('.exe')) { $icon } elseif ($icon -match '^(.+\\.exe)') { $Matches[1] } else { '' }
      $loc  = if ($_.InstallLocation) { $_.InstallLocation.Trim() } else { '' }
      Write-Output "$($_.DisplayName.Trim())|$exe|$loc"
    }
}
`

async function scanRegistry(): Promise<DiscoveredApp[]> {
  const out = await ps(REGISTRY_PS, 18_000)
  const apps: DiscoveredApp[] = []
  const seen = new Set<string>()

  for (const line of out.split('\n')) {
    const parts = line.trim().split('|')
    if (parts.length < 1) continue

    const name = parts[0]?.trim()
    if (!name || name.length < 2) continue
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())

    const rawExe      = parts[1]?.trim() ?? ''
    const installLoc  = parts[2]?.trim() || null
    // Strip icon index suffix ",0"
    const exePath     = rawExe.replace(/,\d+$/, '').trim()
    const processName = exePath?.endsWith('.exe')
      ? exePath.split('\\').pop()!.toLowerCase()
      : null

    apps.push({
      canonicalName:   name,
      aliases:         buildAliases(name),
      executablePath:  exePath?.endsWith('.exe') ? exePath : null,
      processName,
      source:          'registry',
      installLocation: installLoc,
    })
  }

  return apps
}

// ── UWP / Store apps ──────────────────────────────────────────────────────────

const UWP_PS = `
Get-AppxPackage -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notmatch '^(Microsoft\\.Net|Microsoft\\.Windows|Microsoft\\.UI|Windows\\.)' } |
  Select-Object Name, PackageFamilyName, InstallLocation |
  ForEach-Object {
    $display = $_.Name -replace '^\\w+\\.', '' -replace '(?<=[a-z])(?=[A-Z])', ' '
    Write-Output "$display|$($_.PackageFamilyName)|$($_.InstallLocation)"
  }
`

async function scanUwpApps(): Promise<DiscoveredApp[]> {
  const out = await ps(UWP_PS, 15_000)
  const apps: DiscoveredApp[] = []

  for (const line of out.split('\n')) {
    const [display, familyName] = line.trim().split('|')
    if (!display || !familyName) continue

    const cleanName = display
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleanName.length < 2) continue

    apps.push({
      canonicalName:   cleanName,
      aliases:         buildAliases(cleanName),
      executablePath:  null,
      processName:     null,
      source:          'uwp',
      installLocation: null,
      uwpFamilyName:   familyName.trim(),
    })
  }

  return apps
}

// ── Running processes ─────────────────────────────────────────────────────────

const RUNNING_PS = `
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } |
  Select-Object ProcessName, Path, MainWindowTitle |
  ForEach-Object { "$($_.ProcessName)|$($_.Path)|$($_.MainWindowTitle)" }
`

async function scanRunningProcesses(): Promise<DiscoveredApp[]> {
  const out = await ps(RUNNING_PS, 8_000)
  const apps: DiscoveredApp[] = []
  const seen = new Set<string>()

  for (const line of out.split('\n')) {
    const parts = line.trim().split('|')
    const [procName, exePath, title] = parts
    if (!procName) continue

    const key = procName.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    // Prefer window title (more human readable) over process name
    const displayName = title?.trim()
      ? title.replace(/ - .*$/, '').trim()  // strip " - Notepad" suffix
      : procName.replace(/\.exe$/i, '')

    apps.push({
      canonicalName:   displayName,
      aliases:         buildAliases(displayName),
      executablePath:  exePath?.trim() || null,
      processName:     `${key}.exe`,
      source:          'running',
      installLocation: exePath ? exePath.slice(0, exePath.lastIndexOf('\\')) : null,
    })
  }

  return apps
}

// ─── Registry merge + dedup ───────────────────────────────────────────────────

/**
 * Merge multiple source lists into a single deduplicated registry.
 * Prefers start_menu entries over registry over UWP over running.
 */
function mergeRegistry(
  startMenu:  DiscoveredApp[],
  registry:   DiscoveredApp[],
  uwp:        DiscoveredApp[],
  running:    DiscoveredApp[],
): DiscoveredApp[] {
  const merged = new Map<string, DiscoveredApp>()

  const priority: AppSource[] = ['start_menu', 'registry', 'uwp', 'running']

  for (const source of priority) {
    const list =
      source === 'start_menu' ? startMenu :
      source === 'registry'   ? registry  :
      source === 'uwp'        ? uwp       : running

    for (const app of list) {
      const key = norm(app.canonicalName)
      if (!merged.has(key)) {
        merged.set(key, app)
      } else {
        // Upgrade: if the existing entry lacks an exe path and this one has it
        const existing = merged.get(key)!
        if (!existing.executablePath && app.executablePath) {
          merged.set(key, { ...existing, executablePath: app.executablePath, processName: app.processName })
        }
      }
    }
  }

  return [...merged.values()]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Start the background discovery scan. Safe to call multiple times. */
export function initDiscovery(): void {
  if (_scanPromise) return
  _scanPromise = runFullScan()

  // Periodic refresh
  if (!_refreshTimer) {
    _refreshTimer = setInterval(() => {
      _scanPromise = runFullScan()
    }, REFRESH_INTERVAL_MS)
  }
}

/** Stop periodic refresh (called on app quit). */
export function stopDiscovery(): void {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null }
}

async function runFullScan(): Promise<void> {
  console.info('[JARVIS_DISCOVERY] starting full app scan …')
  const t0 = Date.now()

  const [startMenu, registry, uwp, running] = await Promise.allSettled([
    scanStartMenu(),
    scanRegistry(),
    scanUwpApps(),
    scanRunningProcesses(),
  ]).then((results) =>
    results.map((r) => (r.status === 'fulfilled' ? r.value : [])) as [
      DiscoveredApp[], DiscoveredApp[], DiscoveredApp[], DiscoveredApp[],
    ],
  )

  _registry = mergeRegistry(startMenu, registry, uwp, running)
  _indexed  = true

  console.info(
    `[JARVIS_DISCOVERY] indexed ${_registry.length} apps ` +
    `(startMenu=${startMenu.length} reg=${registry.length} ` +
    `uwp=${uwp.length} running=${running.length}) ` +
    `in ${Date.now() - t0} ms`,
  )
}

/** Refresh only the running-process snapshot (fast, called frequently). */
export async function refreshRunningApps(): Promise<void> {
  if (!_indexed) return
  const fresh = await scanRunningProcesses()
  // Upsert running entries without removing the existing ones
  for (const app of fresh) {
    const key = norm(app.canonicalName)
    if (!_registry.some((a) => norm(a.canonicalName) === key)) {
      _registry.push(app)
    }
  }
}

/**
 * Fuzzy-resolve a natural-language query to the best matching app.
 * Waits for the initial scan to finish if it hasn't yet.
 *
 * @param query   User-supplied app name, e.g. "photo shop", "vscode", "figma"
 * @param minScore Minimum score (0–100) to accept as a match (default 55)
 */
export async function fuzzyResolve(
  query: string,
  minScore = 55,
): Promise<ResolvedDiscovery | null> {
  // Block until the first scan completes
  if (!_indexed && _scanPromise) await _scanPromise
  if (_registry.length === 0) return null

  const q = norm(query)
  console.info(`[JARVIS_MATCH] input="${query}" normalized="${q}"`)

  let best: ResolvedDiscovery | null = null

  for (const app of _registry) {
    const { score, reason } = scoreMatch(q, app)
    if (score >= minScore) {
      if (!best || score > best.score) {
        best = { app, score, matchReason: reason }
      }
    }
  }

  if (best) {
    console.info(
      `[JARVIS_MATCH] resolved="${best.app.canonicalName}" ` +
      `score=${best.score} reason=${best.matchReason} ` +
      `source=${best.app.source} exe=${best.app.executablePath ?? 'UWP'}`,
    )
  } else {
    console.info(`[JARVIS_MATCH] no match found for "${query}" (threshold=${minScore})`)
  }

  return best
}

/**
 * Synchronous fuzzy resolve (uses cached registry, no await).
 * Returns null if the registry hasn't been populated yet.
 */
export function fuzzyResolveSync(query: string, minScore = 55): ResolvedDiscovery | null {
  if (!_indexed || _registry.length === 0) return null
  const q = norm(query)
  let best: ResolvedDiscovery | null = null
  for (const app of _registry) {
    const { score, reason } = scoreMatch(q, app)
    if (score >= minScore && (!best || score > best.score)) {
      best = { app, score, matchReason: reason }
    }
  }
  return best
}

/** Returns the full in-memory registry snapshot. */
export function getDiscoveryRegistry(): DiscoveredApp[] {
  return _registry
}

/** True once the first scan has completed. */
export function isDiscoveryReady(): boolean {
  return _indexed
}

/** How many apps are indexed. */
export function getDiscoveryCount(): number {
  return _registry.length
}
