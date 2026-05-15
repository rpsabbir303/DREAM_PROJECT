/**
 * App Plugin — Universal Desktop Control (Window-First Architecture)
 *
 * Handles all app.* intents:
 *   open, close, focus, minimize, maximize, restart, switch
 *
 * NEW Execution path (window-first):
 *   command → app identity (fuzzy resolve) → HWND → process graph
 *
 * Open resolution cascade:
 *   1. ExecutionOrchestrator.open  — checks existing windows first (HWND-based)
 *      ↳ WindowTracker: is a matching window already visible?  → focus HWND, done
 *      ↳ DesktopStateEngine: process running but no window?    → wait + focus, done
 *      ↳ LaunchStrategyResolver: pick exe / uwp / steam / etc
 *      ↳ Spawn + verify new window appears (up to 5 s), focus it
 *   2. Static appRegistry (fast, known aliases)
 *   3. Universal fuzzy discovery (appDiscovery) — ANY installed app
 *   4. Dynamic registry scan
 *   5. `cmd /c start <name>` shell fallback
 *   6. FAIL-SAFE: clear "not found" — NEVER falls through to Gemini
 *
 * Close / focus / minimize / maximize / restore:
 *   Always attempts HWND-based operation first via ExecutionOrchestrator.
 */

import { safeLogger } from '../../main/safeLogger.js'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { resolveApp, resolveAppDynamic, findExePath, displayName, isWindows } from '../../system/appRegistry.js'
import {
  recordOpened,
  recordClosed,
  resolveContextualTarget,
  getPreviousAppName,
  getLastOpenedApp,
} from '../../system/runtimeState.js'
import { systemEvents } from '../../system/systemEvents.js'
import { fuzzyResolve, getDiscoveryCount } from '../../system/appDiscovery.js'
import { orchestrate } from '../../system/executionOrchestrator.js'
import { findBestWindow } from '../../system/windowTracker.js'
import type { ResolvedIntent } from '../../ai/nlpRouter.js'
import {
  isJunkDiscoveryName,
  isWhatsAppTypos,
  sanitizeAppOpenParams,
} from '../../ai/nlp/appOpenResolver.js'
import { launchWhatsApp } from '../../system/whatsappLauncher.js'

const execAsync = promisify(exec)

// ─── Live process helpers (discovery-free fallback) ───────────────────────────

/**
 * Query live processes by a fuzzy name match.
 * Works even when appDiscovery = 0 (no indexing).
 * Returns the best matching process name as "foo.exe" or null.
 */
async function liveMatchProcess(query: string): Promise<string | null> {
  const tmpFile = join(tmpdir(), `jarvis_lm_${randomUUID()}.ps1`)
  try {
    const q = query.replace(/\.exe$/i, '').toLowerCase()
    const script = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$procs = Get-Process -ErrorAction SilentlyContinue | Select-Object -Property Name,Id,Path -Unique
foreach ($p in $procs) {
  Write-Output "$($p.Name)|$($p.Id)|$($p.Path)"
}
`
    await writeFile(tmpFile, '\uFEFF' + script, 'utf-8')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { windowsHide: true, timeout: 8_000, maxBuffer: 4 * 1024 * 1024 },
    )

    // Exact and fuzzy match
    const lines = stdout.trim().split('\n').map((l) => l.trim()).filter(Boolean)
    let best: string | null = null
    let bestScore = 0
    for (const line of lines) {
      const name = line.split('|')[0].trim().toLowerCase().replace(/\.exe$/i, '')
      if (!name) continue
      let score = 0
      if (name === q)               score = 100
      else if (name.startsWith(q))  score = 80
      else if (q.startsWith(name))  score = 70
      else if (name.includes(q))    score = 60
      else if (q.includes(name) && name.length >= 3) score = 50
      if (score > bestScore) { bestScore = score; best = name + '.exe' }
    }

    if (best) safeLogger.info(`[JARVIS_LIVE] matched "${query}" → "${best}" (score=${bestScore})`)
    else       safeLogger.warn(`[JARVIS_LIVE] no live process match for "${query}"`)
    return bestScore >= 50 ? best : null
  } catch (e) {
    safeLogger.error(`[JARVIS_LIVE] liveMatchProcess failed: ${(e as Error).message}`)
    return null
  } finally {
    unlink(tmpFile).catch(() => undefined)
  }
}

/**
 * Find an exe path for an app name using `where` and live process path.
 * Used as open fallback when discovery = 0.
 */
async function liveResolveExePath(appName: string): Promise<string | null> {
  const cleanName = appName.replace(/\.exe$/i, '')
  // 1. Try "where <name>"
  try {
    const { stdout } = await execAsync(
      `where "${cleanName}.exe"`,
      { windowsHide: true, timeout: 5_000 },
    )
    const line = stdout.trim().split('\n')[0].trim()
    if (line.toLowerCase().endsWith('.exe')) {
      safeLogger.info(`[JARVIS_LIVE] where found: ${line}`)
      return line
    }
  } catch { /* not in PATH */ }

  // 2. Get path from a running process by that name
  const tmpFile = join(tmpdir(), `jarvis_ep_${randomUUID()}.ps1`)
  try {
    const script = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$p = Get-Process -Name "${cleanName}" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p -and $p.Path) { Write-Output $p.Path }
`
    await writeFile(tmpFile, '\uFEFF' + script, 'utf-8')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { windowsHide: true, timeout: 6_000 },
    )
    const path = stdout.trim().split('\n')[0].trim()
    if (path.toLowerCase().endsWith('.exe')) {
      safeLogger.info(`[JARVIS_LIVE] running proc path: ${path}`)
      return path
    }
  } catch { /* pass */ } finally {
    unlink(tmpFile).catch(() => undefined)
  }
  return null
}

export type PluginResult = { ok: boolean; message: string }

function redact(s: string): string {
  return s.replace(/[A-Z]:\\[^\s"]+/gi, '[path]').slice(0, 200)
}

// ─── Legacy helpers (fallback paths) ─────────────────────────────────────────

function spawnExe(exePath: string, label: string): PluginResult {
  try {
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
    recordOpened(label)
    systemEvents.emit('app_opened', { app: label })
    safeLogger.info(`[JARVIS_AUTOMATION] launching executable — ${exePath}`)
    return { ok: true, message: `Opening ${label}.` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    safeLogger.error(`[JARVIS_AUTOMATION] spawn failed — ${redact(msg)}`)
    return { ok: false, message: `Could not launch ${label}: ${redact(msg)}` }
  }
}

async function launchUwp(familyName: string, label: string): Promise<PluginResult> {
  const uri = `shell:AppsFolder\\${familyName}!App`
  safeLogger.info(`[JARVIS_AUTOMATION] launching UWP — ${uri}`)
  return new Promise<PluginResult>((resolve) => {
    const child = spawn('explorer.exe', [uri], { detached: true, stdio: 'ignore', shell: false })
    child.once('error', (e) => resolve({ ok: false, message: `Could not open ${label}: ${redact(e.message)}` }))
    child.once('spawn', () => {
      child.unref()
      recordOpened(label)
      systemEvents.emit('app_opened', { app: label })
      resolve({ ok: true, message: `Opening ${label}.` })
    })
    setTimeout(() => { recordOpened(label); resolve({ ok: true, message: `Opening ${label}.` }) }, 4_000)
  })
}

// ─── Open ─────────────────────────────────────────────────────────────────────

/** Launch via static registry (UWP / exe / openCmd). */
async function launchFromRegistryDef(
  def: NonNullable<ReturnType<typeof resolveApp>>,
  label: string,
  appKey?: string,
): Promise<PluginResult | null> {
  if (appKey === 'whatsapp' || label.toLowerCase().includes('whatsapp')) {
    const wa = await launchWhatsApp()
    if (wa.ok) {
      recordOpened('WhatsApp')
      systemEvents.emit('app_opened', { app: 'WhatsApp' })
    }
    return wa
  }

  if (def.explorerUri) {
    const familyName = def.explorerUri.replace(/^shell:AppsFolder\\?/i, '').replace(/!App$/i, '')
    return launchUwp(familyName, label)
  }
  const exePath = findExePath(def)
  if (exePath) return spawnExe(exePath, label)
  if (def.openCmd) {
    safeLogger.info(`[JARVIS_APP] running openCmd — ${def.openCmd}`)
    try {
      await execAsync(`cmd /c ${def.openCmd}`, { windowsHide: true, timeout: 10_000 })
      recordOpened(label)
      return { ok: true, message: `Opening ${label}.` }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: `Could not open ${label}: ${redact(msg)}` }
    }
  }
  return null
}

async function openApp(appName: string, appKey?: string, discoveryHint?: string): Promise<PluginResult> {
  if (!isWindows()) return { ok: false, message: 'App control is only supported on Windows.' }

  const sanitized = sanitizeAppOpenParams({ app: appName, appKey, discoveryName: discoveryHint })
  appName = sanitized.app
  appKey = sanitized.appKey
  discoveryHint = sanitized.discoveryName

  safeLogger.info(`[JARVIS_APP] open — name="${appName}" key="${appKey ?? '—'}" discovery="${discoveryHint ?? '—'}"`)

  // ── STATIC REGISTRY FIRST when appKey is known (WhatsApp UWP, Chrome exe, …) ──
  if (appKey) {
    const keyed = resolveApp(appKey)
    if (keyed) {
      const label = displayName(keyed, appName)
      const launched = await launchFromRegistryDef(keyed, label, appKey)
      if (launched) return launched
    }
  }

  const discoveryQuery = discoveryHint && !isJunkDiscoveryName(discoveryHint) ? discoveryHint : appName

  if (isWhatsAppTypos(discoveryQuery) || isWhatsAppTypos(appName) || appKey === 'whatsapp') {
    const wa = await launchWhatsApp()
    if (wa.ok) {
      recordOpened('WhatsApp')
      systemEvents.emit('app_opened', { app: 'WhatsApp' })
    }
    return wa
  }

  // ── Discovery + orchestrator (unknown apps only; never prefer junk shortcuts) ──
  if (!appKey && discoveryQuery && !isJunkDiscoveryName(discoveryQuery)) {
    const discovered = await fuzzyResolve(discoveryQuery)
    if (discovered && !isJunkDiscoveryName(discovered.app.canonicalName)) {
      const result = await orchestrate({
        action: 'open',
        query:  discoveryQuery,
        app:    discovered.app,
      })
      if (result.ok) return result
      safeLogger.info(`[JARVIS_APP] orchestrator failed for "${discoveryQuery}", trying static registry`)
    } else if (discovered) {
      safeLogger.info(`[JARVIS_APP] ignored junk discovery match — "${discovered.app.canonicalName}"`)
    } else {
      const existingWin = findBestWindow(discoveryQuery)
      if (existingWin) {
        const { focusByHwnd } = await import('../../system/windowTracker.js')
        const focusResult = await focusByHwnd(existingWin.hwnd)
        if (focusResult.ok) {
          return {
            ok:      true,
            message: `${discoveryQuery} is already open. Brought it to the front.`,
          }
        }
      }
    }
  }

  // ── STATIC REGISTRY: alias / name fallback ───────────────────────────────
  const def   = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)
  const label = displayName(def, appName)

  if (def) {
    const launched = await launchFromRegistryDef(def, label, appKey)
    if (launched) return launched
  }

  // ── DYNAMIC REGISTRY SCAN ─────────────────────────────────────────────────
  const dynamic = await resolveAppDynamic(appKey ?? appName)
  if (dynamic) {
    safeLogger.info(`[JARVIS_APP] dynamic discovery found — ${dynamic.exePath}`)
    return spawnExe(dynamic.exePath, dynamic.displayName)
  }

  // ── LIVE PROCESS PATH FALLBACK (discovery = 0) ───────────────────────────
  // If discovery is empty, try to find the exe via `where` or a running process.
  if (getDiscoveryCount() === 0) {
    const livePath = await liveResolveExePath(appName)
    if (livePath) {
      safeLogger.info(`[JARVIS_APP] live exe path fallback — ${livePath}`)
      return spawnExe(livePath, label)
    }
  }

  // ── SHELL `start` FALLBACK — only for short single-token names with appKey or known app ──
  const safeForShell =
    appKey &&
    appKey.length >= 2 &&
    !appName.includes(' ') &&
    appName.length >= 3 &&
    appName.length <= 24 &&
    !/\b(is|new|latest|version|what)\b/i.test(appName)

  if (safeForShell && appKey) {
    try {
      const startCmd = `cmd /c start "" "${appKey.replace(/"/g, '')}"`
      safeLogger.info(`[JARVIS_APP] shell start fallback — ${startCmd}`)
      await execAsync(startCmd, { windowsHide: true, timeout: 8_000 })
      recordOpened(label)
      return { ok: true, message: `Opening ${label}.` }
    } catch { /* final fallback below */ }
  }

  // ── FAIL-SAFE ─────────────────────────────────────────────────────────────
  safeLogger.info(`[JARVIS_APP] all strategies exhausted for "${appName}"`)
  return {
    ok:      false,
    message: `I couldn't find "${appName}" on this PC. Make sure it is installed, or check the name and try again.`,
  }
}

// ─── Close ────────────────────────────────────────────────────────────────────

async function closeApp(appName: string, appKey?: string): Promise<PluginResult> {
  if (!isWindows()) return { ok: false, message: 'App control is only supported on Windows.' }

  const def   = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)
  const label = displayName(def, appName)

  safeLogger.info(`[JARVIS_APP] close — name="${appName}" key="${appKey ?? '—'}"`)

  // Collect ALL known process names for this app so the close pipeline has
  // the best possible chance to find and kill the right process
  const knownNames: string[] = []
  if (def?.processNames?.length) {
    for (const n of def.processNames) knownNames.push(n)
  }

  // Discovery can give us additional process info
  const discovered = await fuzzyResolve(appName)
  if (discovered?.app.processName && !knownNames.includes(discovered.app.processName)) {
    knownNames.push(discovered.app.processName)
  }

  // LIVE FALLBACK: if discovery is empty OR we have no known names,
  // do a live Get-Process query to find the exact process name
  if (knownNames.length === 0 || getDiscoveryCount() === 0) {
    const liveProc = await liveMatchProcess(appName)
    if (liveProc && !knownNames.includes(liveProc)) {
      safeLogger.info(`[JARVIS_APP] live process match for close: ${liveProc}`)
      knownNames.push(liveProc)
    }
  }

  // Deduplicate and normalise to .exe
  const imageNames = [...new Set(
    knownNames.map((n) => n.toLowerCase().endsWith('.exe') ? n : `${n}.exe`),
  )]

  // Use the reliable multi-stage close pipeline directly
  const { reliableClose } = await import('../../system/processController.js')
  const result = await reliableClose(appName, imageNames.length ? imageNames : [`${appName}.exe`], label)

  if (result.ok) {
    recordClosed(label)
    systemEvents.emit('app_closed', { app: label })
  }

  return result
}

// ─── Focus ────────────────────────────────────────────────────────────────────

async function focusApp(appName: string, appKey?: string): Promise<PluginResult> {
  const def = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)

  safeLogger.info(`[JARVIS_APP] focus — name="${appName}" key="${appKey ?? '—'}"`)

  // Try orchestrator (HWND-based)
  const discovered = await fuzzyResolve(appName)
  const oResult = await orchestrate({
    action: 'focus',
    query:  def?.windowTitle ?? appName,
    app:    discovered?.app ?? null,
  })
  if (oResult.ok) return oResult

  // Legacy fallback
  const { focusWindow } = await import('../../system/windowManager.js')
  const terms: string[] = [def?.windowTitle, appName].filter(Boolean) as string[]
  for (const term of terms) {
    const res = await focusWindow(term)
    if (res.ok) return res
  }

  return { ok: false, message: `Could not find a window for "${appName}".` }
}

// ─── Minimize / Maximize / Restore ────────────────────────────────────────────

async function minimizeApp(appName: string, appKey?: string): Promise<PluginResult> {
  const def = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)
  const query = def?.windowTitle ?? appName
  const discovered = await fuzzyResolve(appName)

  const oResult = await orchestrate({ action: 'minimize', query, app: discovered?.app ?? null })
  if (oResult.ok) return oResult

  const { minimizeWindow } = await import('../../system/windowManager.js')
  return minimizeWindow(query)
}

async function maximizeApp(appName: string, appKey?: string): Promise<PluginResult> {
  const def = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)
  const query = def?.windowTitle ?? appName
  const discovered = await fuzzyResolve(appName)

  const oResult = await orchestrate({ action: 'maximize', query, app: discovered?.app ?? null })
  if (oResult.ok) return oResult

  const { maximizeWindow } = await import('../../system/windowManager.js')
  return maximizeWindow(query)
}

async function restoreApp(appName: string, appKey?: string): Promise<PluginResult> {
  const def = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)
  const query = def?.windowTitle ?? appName
  const discovered = await fuzzyResolve(appName)

  const oResult = await orchestrate({ action: 'restore', query, app: discovered?.app ?? null })
  if (oResult.ok) return oResult

  const { restoreWindow } = await import('../../system/windowManager.js')
  return restoreWindow(query)
}


async function restartApp(appName: string, appKey?: string): Promise<PluginResult> {
  const closeResult = await closeApp(appName, appKey)
  if (!closeResult.ok) return closeResult
  await new Promise((r) => setTimeout(r, 1_200))
  const openResult = await openApp(appName, appKey)
  const def   = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)
  const label = displayName(def, appName)
  return { ok: openResult.ok, message: openResult.ok ? `Restarted ${label}.` : openResult.message }
}

// ─── Contextual target resolution ────────────────────────────────────────────

function resolveContextual(contextual: string): string | null {
  switch (contextual) {
    case 'active':   return resolveContextualTarget()
    case 'previous': return getPreviousAppName()
    case 'last':     return getLastOpenedApp()
    default:         return null
  }
}

// ─── Plugin entry point ───────────────────────────────────────────────────────

export async function executeAppIntent(intent: ResolvedIntent): Promise<PluginResult> {
  const contextual = intent.params.contextual
  let app: string    = intent.params.app ?? ''
  let appKey: string | undefined = intent.params.appKey

  if (contextual) {
    const resolved = resolveContextual(contextual)
    if (!resolved) {
      const hint =
        contextual === 'active'   ? "I'm not sure which app you're referring to. Which one?" :
        contextual === 'previous' ? "I don't know which app you were using before." :
                                    "I don't remember the last app you opened."
      return { ok: false, message: hint }
    }
    app    = resolved
    appKey = undefined
    safeLogger.info(`[JARVIS_APP] contextual resolved — "${contextual}" → "${app}"`)
  }

  let discoveryName: string | undefined = intent.params.discoveryName
  const alternatives  = intent.params.alternatives  // comma-separated sibling keys

  if (intent.type === 'app.open') {
    const clean = sanitizeAppOpenParams({ app, appKey, discoveryName })
    app = clean.app
    appKey = clean.appKey
    discoveryName = clean.discoveryName
  }

  safeLogger.info(
    `[JARVIS_APP] executeAppIntent — type="${intent.type}" ` +
    `app="${app}" appKey="${appKey ?? ''}" discovery="${discoveryName ?? ''}"`,
  )

  let result: PluginResult

  switch (intent.type) {
    case 'app.open':     result = await openApp(app, appKey, discoveryName); break
    case 'app.close':    result = await closeApp(app, appKey); break
    case 'app.focus':    result = await focusApp(app, appKey); break
    case 'app.switch':   result = await focusApp(app, appKey); break
    case 'app.minimize': result = await minimizeApp(app, appKey); break
    case 'app.maximize': result = await maximizeApp(app, appKey); break
    case 'app.restore':  result = await restoreApp(app, appKey); break
    case 'app.restart':  result = await restartApp(app, appKey); break
    default:             return { ok: false, message: `Unknown app intent: ${intent.type}` }
  }

  // If the open succeeded and there were alternative matches (ambiguous term),
  // append a helpful hint so the user knows they can be more specific.
  if (
    result.ok &&
    intent.type === 'app.open' &&
    alternatives &&
    alternatives.split(',').length >= 2
  ) {
    const alts = alternatives.split(',').map((k) => k.trim()).slice(0, 3)
    result = {
      ...result,
      message: `${result.message} (You can also say "open ${alts[0]}" or "open ${alts[1]}" for other options.)`,
    }
  }

  return result
}
