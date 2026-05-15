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

import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveApp, resolveAppDynamic, findExePath, displayName, isWindows } from '../../system/appRegistry.js'
import { killByImageName } from '../../system/processManager.js'
import {
  recordOpened,
  recordClosed,
  resolveContextualTarget,
  getPreviousAppName,
  getLastOpenedApp,
} from '../../system/runtimeState.js'
import { systemEvents } from '../../system/systemEvents.js'
import { fuzzyResolve } from '../../system/appDiscovery.js'
import { orchestrate } from '../../system/executionOrchestrator.js'
import { findBestWindow } from '../../system/windowTracker.js'
import type { ResolvedIntent } from '../../ai/nlpRouter.js'

const execAsync = promisify(exec)

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
    console.log(`[JARVIS_AUTOMATION] launching executable — ${exePath}`)
    return { ok: true, message: `Opening ${label}.` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[JARVIS_AUTOMATION] spawn failed — ${redact(msg)}`)
    return { ok: false, message: `Could not launch ${label}: ${redact(msg)}` }
  }
}

async function launchUwp(familyName: string, label: string): Promise<PluginResult> {
  const uri = `shell:AppsFolder\\${familyName}!App`
  console.log(`[JARVIS_AUTOMATION] launching UWP — ${uri}`)
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

async function openApp(appName: string, appKey?: string, discoveryHint?: string): Promise<PluginResult> {
  if (!isWindows()) return { ok: false, message: 'App control is only supported on Windows.' }

  const effectiveName = discoveryHint ?? appName
  console.log(`[JARVIS_APP] open — name="${appName}" key="${appKey ?? '—'}" discovery="${discoveryHint ?? '—'}"`)

  // ── PRIMARY: Try universal discovery first so ExecutionOrchestrator ───────
  //    has the full app descriptor (exe path, UWP family, process name).
  //    This path handles: ANY app, smart focus of existing windows, strategy
  //    detection, and launch verification.
  const discovered = await fuzzyResolve(effectiveName)
  if (discovered) {
    const result = await orchestrate({
      action: 'open',
      query:  effectiveName,
      app:    discovered.app,
    })
    if (result.ok) return result
    // If orchestrator couldn't launch (e.g. bad exe path), fall through to
    // static registry which may have a better exe path or openCmd.
    console.log(`[JARVIS_APP] orchestrator failed for "${effectiveName}", trying static registry`)
  } else {
    // No discovery result — still check windows in case app is already open
    const existingWin = findBestWindow(effectiveName)
    if (existingWin) {
      const { focusByHwnd } = await import('../../system/windowTracker.js')
      const focusResult = await focusByHwnd(existingWin.hwnd)
      if (focusResult.ok) {
        return {
          ok:      true,
          message: `${effectiveName} is already open. Brought it to the front.`,
        }
      }
    }
  }

  // ── STATIC REGISTRY: fast path for hardcoded known apps ──────────────────
  const def   = (appKey ? resolveApp(appKey) : null) ?? resolveApp(effectiveName)
  const label = displayName(def, effectiveName)

  if (def) {
    // UWP launch
    if (def.explorerUri) {
      const familyName = def.explorerUri.replace(/^shell:AppsFolder\\?/i, '').replace(/!App$/i, '')
      return launchUwp(familyName, label)
    }

    // Static exe path
    const exePath = findExePath(def)
    if (exePath) return spawnExe(exePath, label)

    // openCmd
    if (def.openCmd) {
      console.log(`[JARVIS_APP] running openCmd — ${def.openCmd}`)
      try {
        await execAsync(`cmd /c ${def.openCmd}`, { windowsHide: true, timeout: 10_000 })
        recordOpened(label)
        return { ok: true, message: `Opening ${label}.` }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { ok: false, message: `Could not open ${label}: ${redact(msg)}` }
      }
    }
  }

  // ── DYNAMIC REGISTRY SCAN ─────────────────────────────────────────────────
  const dynamic = await resolveAppDynamic(appKey ?? appName)
  if (dynamic) {
    console.log(`[JARVIS_APP] dynamic discovery found — ${dynamic.exePath}`)
    return spawnExe(dynamic.exePath, dynamic.displayName)
  }

  // ── SHELL `start` FALLBACK ────────────────────────────────────────────────
  try {
    const startCmd = `cmd /c start "" "${appName}"`
    console.log(`[JARVIS_APP] shell start fallback — ${startCmd}`)
    await execAsync(startCmd, { windowsHide: true, timeout: 8_000 })
    recordOpened(label)
    return { ok: true, message: `Opening ${label}.` }
  } catch { /* final fallback below */ }

  // ── FAIL-SAFE ─────────────────────────────────────────────────────────────
  console.log(`[JARVIS_APP] all strategies exhausted for "${appName}"`)
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

  console.log(`[JARVIS_APP] close — name="${appName}" key="${appKey ?? '—'}"`)

  // Try orchestrator first (HWND-based WM_CLOSE, then process kill)
  const discovered = await fuzzyResolve(appName)
  const oResult = await orchestrate({
    action: 'close',
    query:  appName,
    app:    discovered?.app ?? null,
  })
  if (oResult.ok) return oResult

  // Fallback: static def process names
  if (def?.processNames?.length) {
    for (const name of def.processNames) {
      const result = await killByImageName(name)
      if (result.ok) {
        recordClosed(label)
        systemEvents.emit('app_closed', { app: label })
        return { ok: true, message: `Closed ${label}.` }
      }
    }
  }

  return { ok: true, message: `${label} doesn't appear to be running.` }
}

// ─── Focus ────────────────────────────────────────────────────────────────────

async function focusApp(appName: string, appKey?: string): Promise<PluginResult> {
  const def = (appKey ? resolveApp(appKey) : null) ?? resolveApp(appName)

  console.log(`[JARVIS_APP] focus — name="${appName}" key="${appKey ?? '—'}"`)

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
        contextual === 'active'   ? "I'm not sure which app you're referring to. Please specify the app name." :
        contextual === 'previous' ? "I don't know which app you were using before." :
                                    "I don't remember the last app you opened."
      return { ok: false, message: hint }
    }
    app    = resolved
    appKey = undefined
    console.log(`[JARVIS_APP] contextual resolved — "${contextual}" → "${app}"`)
  }

  const discoveryName = intent.params.discoveryName

  console.log(
    `[JARVIS_APP] executeAppIntent — type="${intent.type}" ` +
    `app="${app}" appKey="${appKey ?? ''}" discovery="${discoveryName ?? ''}"`,
  )

  switch (intent.type) {
    case 'app.open':     return openApp(app, appKey, discoveryName)
    case 'app.close':    return closeApp(app, appKey)
    case 'app.focus':    return focusApp(app, appKey)
    case 'app.switch':   return focusApp(app, appKey)
    case 'app.minimize': return minimizeApp(app, appKey)
    case 'app.maximize': return maximizeApp(app, appKey)
    case 'app.restore':  return restoreApp(app, appKey)
    case 'app.restart':  return restartApp(app, appKey)
    default:             return { ok: false, message: `Unknown app intent: ${intent.type}` }
  }
}
