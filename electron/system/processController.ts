/**
 * Process Controller — Real multi-stage app close
 *
 * Fixes applied vs previous version:
 *  1. explorer.exe is the Windows shell — NEVER kill it by image name.
 *     Instead, close each visible File Explorer window individually.
 *  2. Window lookup uses both cache AND live PS query so stale cache never
 *     prevents a close.
 *  3. Verification uses the right signal for each app type:
 *     - normal apps: PID alive check
 *     - shell procs (explorer): window-count check, not process check
 *  4. Promise.any([]) edge case handled.
 *  5. Full logging at every stage.
 */

import { safeLogger } from '../main/safeLogger.js'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface CloseResult {
  ok:      boolean
  message: string
  method?: string
}

// ─── Shell-process guard ──────────────────────────────────────────────────────
// These processes ARE always running as Windows infrastructure. Killing them
// by image name would destroy the Windows shell or system. Only close their
// individual windows, never kill the process.
const SHELL_PROCESSES = new Set(['explorer.exe', 'explorer'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function normaliseExe(name: string): string {
  const n = name.toLowerCase().trim()
  return n.endsWith('.exe') ? n : `${n}.exe`
}

function isShellProcess(imageName: string): boolean {
  return SHELL_PROCESSES.has(imageName.toLowerCase())
}

/** Returns true if PID is still alive. */
async function isPidAlive(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `cmd /c tasklist /FI "PID eq ${pid}" /NH`,
      { windowsHide: true, timeout: 6_000 },
    )
    return stdout.includes(String(pid))
  } catch {
    return false
  }
}

/** Returns true if ANY process with this image name is running. */
async function isImageRunning(imageName: string): Promise<boolean> {
  const name = normaliseExe(imageName)
  try {
    const { stdout } = await execAsync(
      `cmd /c tasklist /FI "IMAGENAME eq ${name}" /NH`,
      { windowsHide: true, timeout: 6_000 },
    )
    return stdout.toLowerCase().includes(name.toLowerCase())
  } catch {
    return false
  }
}

// ─── Live window lookup via PowerShell ───────────────────────────────────────
//
// This is the fallback when the DesktopStateEngine cache is stale or empty.
// Returns an array of { hwnd, pid, title } for all visible windows matching
// the process name(s).

interface LiveWindow {
  hwnd:  number
  pid:   number
  title: string
  procName: string
}

async function liveWindowsByImageName(imageNames: string[]): Promise<LiveWindow[]> {
  // Build a list of process names without .exe for PowerShell -like matching
  const procNames = imageNames.map((n) =>
    n.toLowerCase().replace(/\.exe$/i, ''),
  )
  // PowerShell: get all windowed processes matching any of our names
  const filter = procNames
    .map((p) => `$_.ProcessName -like '${p}'`)
    .join(' -or ')

  const ps = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class JarvisLW {
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
'@ -ErrorAction SilentlyContinue
Get-Process | Where-Object { (${filter}) -and $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } | ForEach-Object {
    $vis = [JarvisLW]::IsWindowVisible($_.MainWindowHandle)
    if ($vis) { Write-Output "$($_.MainWindowHandle.ToInt64())|$($_.Id)|$($_.ProcessName)|$($_.MainWindowTitle)" }
}
  `.trim().replace(/\n/g, '; ')

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
      { windowsHide: true, timeout: 10_000 },
    )
    const result: LiveWindow[] = []
    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split('|')
      if (parts.length < 4) continue
      const hwnd = Number(parts[0])
      const pid  = Number(parts[1])
      if (!hwnd || !pid) continue
      result.push({
        hwnd,
        pid,
        procName: parts[2] ?? '',
        title:    parts.slice(3).join('|').trim(),
      })
    }
    return result
  } catch {
    return []
  }
}

/** Find best window for query using DesktopStateEngine cache + PS fallback. */
async function findWindows(query: string, imageNames: string[]): Promise<LiveWindow[]> {
  // Try the DesktopStateEngine cache first (cheap, O(n))
  try {
    const { forceRefresh } = await import('./desktopStateEngine.js')
    const { findBestWindow, findAllWindowsForApp } = await import('./windowTracker.js')

    // Refresh the cache
    await forceRefresh()

    const best = findBestWindow(query)
    if (best) {
      safeLogger.info(`[JARVIS_CLOSE] cache hit hwnd=${best.hwnd} proc=${best.processName} title="${best.title}"`)
      return [{ hwnd: best.hwnd, pid: best.pid, procName: best.processName, title: best.title }]
    }

    // Try all windows for app (in case findBestWindow was too strict)
    const all = findAllWindowsForApp(query)
    if (all.length > 0) {
      return all.map((w) => ({ hwnd: w.hwnd, pid: w.pid, procName: w.processName, title: w.title }))
    }
  } catch {
    // cache not ready
  }

  // PS fallback: live query by image name
  if (imageNames.length > 0) {
    safeLogger.info(`[JARVIS_CLOSE] cache miss — falling back to live PS query for [${imageNames.join(', ')}]`)
    const live = await liveWindowsByImageName(imageNames)
    if (live.length > 0) {
      safeLogger.info(`[JARVIS_CLOSE] live PS found ${live.length} window(s)`)
    }
    return live
  }

  return []
}

// ─── Window close operations ──────────────────────────────────────────────────

/** Send WM_CLOSE to a specific HWND. Returns whether the message was delivered. */
async function wmClose(hwnd: number): Promise<boolean> {
  const ps = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class JarvisWC {
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
}
'@ -ErrorAction SilentlyContinue
$h = [IntPtr]${hwnd}
[JarvisWC]::SendMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
Write-Output 'ok'
  `.trim().replace(/\n/g, '; ')
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
      { windowsHide: true, timeout: 8_000 },
    )
    return stdout.includes('ok')
  } catch {
    return false
  }
}

/** Check if a specific HWND still exists as a visible window. */
async function isHwndAlive(hwnd: number): Promise<boolean> {
  const ps = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class JarvisHW {
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
'@ -ErrorAction SilentlyContinue
$h = [IntPtr]${hwnd}
if ([JarvisHW]::IsWindow($h) -and [JarvisHW]::IsWindowVisible($h)) { Write-Output 'alive' } else { Write-Output 'gone' }
  `.trim().replace(/\n/g, '; ')
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
      { windowsHide: true, timeout: 6_000 },
    )
    return stdout.includes('alive')
  } catch {
    return false
  }
}

/** Count how many visible File Explorer windows are currently open. */
async function countExplorerWindows(): Promise<number> {
  const wins = await liveWindowsByImageName(['explorer'])
  return wins.length
}

// ─── Kill strategies (for non-shell processes) ────────────────────────────────

async function killByPid(pid: number): Promise<boolean> {
  try {
    const { stdout, stderr } = await execAsync(
      `cmd /c taskkill /F /PID ${pid}`,
      { windowsHide: true, timeout: 8_000 },
    )
    const out = (stdout + stderr).toLowerCase()
    return !out.includes('access is denied')
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
    return msg.includes('not found') || msg.includes('no tasks')
  }
}

async function killByImage(imageName: string): Promise<boolean> {
  const name = normaliseExe(imageName)
  try {
    const { stdout, stderr } = await execAsync(
      `cmd /c taskkill /F /IM "${name}"`,
      { windowsHide: true, timeout: 8_000 },
    )
    const out = (stdout + stderr).toLowerCase()
    if (out.includes('access is denied')) return false
    return !out.includes('no tasks running') && !out.includes('not found')
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
    return msg.includes('not found') || msg.includes('no tasks')
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Close an application reliably.
 *
 * @param query       Natural-language name for window matching ("file explorer")
 * @param imageNames  All known process image names for this app
 * @param label       Display name for the user-facing message
 */
export async function reliableClose(
  query: string,
  imageNames: string[],
  label: string,
): Promise<CloseResult> {
  const normImages = imageNames.map(normaliseExe)
  const isShell    = normImages.some(isShellProcess)

  safeLogger.info(`[JARVIS_CLOSE] ── start ──`)
  safeLogger.info(`[JARVIS_CLOSE] query="${query}" label="${label}" images=[${normImages.join(', ')}] isShell=${isShell}`)

  // ── Step 1: Find all matching windows ────────────────────────────────────
  const windows = await findWindows(query, normImages)
  safeLogger.info(`[JARVIS_CLOSE] found ${windows.length} window(s): ${windows.map((w) => `hwnd=${w.hwnd} pid=${w.pid} "${w.title}"`).join(' | ')}`)

  if (windows.length === 0) {
    // For shell processes: "not open" is different from "not running"
    if (isShell) {
      const explorerWins = await countExplorerWindows()
      safeLogger.info(`[JARVIS_CLOSE] explorer window count = ${explorerWins}`)
      if (explorerWins === 0) {
        return { ok: true, message: `No File Explorer windows are open.`, method: 'not_open' }
      }
    }

    // For normal apps: check if process is even running
    const anyRunning = await (async () => {
      for (const img of normImages) {
        if (!isShellProcess(img) && await isImageRunning(img)) return true
      }
      return false
    })()

    if (!anyRunning) {
      return { ok: true, message: `${label} doesn't appear to be running.`, method: 'not_running' }
    }

    // Process is running but no visible window found — try live lookup again with broader search
    const liveAgain = normImages.length > 0 ? await liveWindowsByImageName(normImages) : []
    if (liveAgain.length === 0) {
      safeLogger.info(`[JARVIS_CLOSE] process running but no visible window — likely minimised to tray`)
      // Still try killing via image name for non-shell
      if (!isShell) {
        for (const img of normImages) {
          if (await isImageRunning(img)) {
            const killed = await killByImage(img)
            if (killed) {
              await sleep(500)
              if (!(await isImageRunning(img))) {
                safeLogger.info(`[JARVIS_CLOSE] killed by image name: ${img}`)
                return { ok: true, message: `Closed ${label}.`, method: `kill_image:${img}` }
              }
            }
          }
        }
      }
      return { ok: false, message: `Could not close ${label} — no window found.`, method: 'no_window' }
    }
    windows.push(...liveAgain)
    safeLogger.info(`[JARVIS_CLOSE] live retry found ${liveAgain.length} window(s)`)
  }

  // ── Step 2: Send WM_CLOSE to each window ─────────────────────────────────
  for (const win of windows) {
    safeLogger.info(`[JARVIS_CLOSE] WM_CLOSE → hwnd=${win.hwnd} pid=${win.pid} "${win.title}"`)
    await wmClose(win.hwnd)
  }
  safeLogger.info(`[JARVIS_CLOSE] sent WM_CLOSE to ${windows.length} window(s)`)

  // Wait for windows to process WM_CLOSE
  await sleep(1_500)

  // ── Step 3: Verify ────────────────────────────────────────────────────────
  // For shell processes (explorer): verify individual windows are gone, NOT process
  if (isShell) {
    let allGone = true
    for (const win of windows) {
      const alive = await isHwndAlive(win.hwnd)
      safeLogger.info(`[JARVIS_CLOSE] verify hwnd=${win.hwnd} alive=${alive}`)
      if (alive) { allGone = false; break }
    }
    if (allGone) {
      safeLogger.info(`[JARVIS_CLOSE] ✓ all explorer windows closed`)
      return { ok: true, message: `Closed ${label}.`, method: 'wm_close_windows' }
    }

    // WM_CLOSE didn't work for some windows — try again
    for (const win of windows) {
      if (await isHwndAlive(win.hwnd)) {
        safeLogger.info(`[JARVIS_CLOSE] retry WM_CLOSE hwnd=${win.hwnd}`)
        await wmClose(win.hwnd)
      }
    }
    await sleep(800)

    const remainingExplorerWins = await countExplorerWindows()
    if (remainingExplorerWins === 0) {
      return { ok: true, message: `Closed ${label}.`, method: 'wm_close_retry' }
    }
    return { ok: false, message: `Could not close all ${label} windows.`, method: 'wm_close_failed' }
  }

  // For normal processes: check if main PID is gone
  const mainPid = windows[0]?.pid
  if (mainPid) {
    const pidGone = !(await isPidAlive(mainPid))
    safeLogger.info(`[JARVIS_CLOSE] verify pid=${mainPid} gone=${pidGone}`)
    if (pidGone) {
      return { ok: true, message: `Closed ${label}.`, method: 'wm_close' }
    }
  }

  // ── Step 4: Escalate — kill by PID ───────────────────────────────────────
  for (const win of windows) {
    safeLogger.info(`[JARVIS_CLOSE] escalate taskkill /PID ${win.pid}`)
    await killByPid(win.pid)
  }
  await sleep(600)

  if (mainPid && !(await isPidAlive(mainPid))) {
    safeLogger.info(`[JARVIS_CLOSE] ✓ closed via taskkill /PID`)
    return { ok: true, message: `Closed ${label}.`, method: 'taskkill_pid' }
  }

  // ── Step 5: Kill by image name (last resort — normal apps only) ───────────
  for (const img of normImages) {
    if (isShellProcess(img)) continue
    if (!(await isImageRunning(img))) continue
    safeLogger.info(`[JARVIS_CLOSE] escalate taskkill /IM ${img}`)
    const killed = await killByImage(img)
    if (killed) {
      await sleep(500)
      if (!(await isImageRunning(img))) {
        safeLogger.info(`[JARVIS_CLOSE] ✓ closed via taskkill /IM ${img}`)
        return { ok: true, message: `Closed ${label}.`, method: `taskkill_im:${img}` }
      }
    }
  }

  safeLogger.info(`[JARVIS_CLOSE] ✗ all strategies failed`)
  return {
    ok:      false,
    message: `Could not close ${label}. It may need to be closed manually.`,
    method:  'all_failed',
  }
}

/** Check if an app is currently running (by image names). */
export async function isAppRunning(imageNames: string[]): Promise<boolean> {
  for (const name of imageNames) {
    if (!isShellProcess(name) && await isImageRunning(name)) return true
  }
  return false
}
