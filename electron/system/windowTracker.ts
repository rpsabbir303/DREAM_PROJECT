/**
 * Window Tracker
 *
 * Window-first query and control layer built on top of DesktopStateEngine.
 *
 * Architecture shift:
 *   OLD: command → process name → process
 *   NEW: command → app identity → HWND → process graph
 *
 * Key principle: HWND is the primary identity for any window operation.
 * Process names are only a lookup hint — the actual target is always an HWND.
 *
 * Provides:
 *   - findBestWindow(query)          smart fuzzy window resolution
 *   - focusByHwnd(hwnd)             Win32 SetForegroundWindow via PS
 *   - minimizeByHwnd(hwnd)          Win32 ShowWindow(SW_MINIMIZE) via PS
 *   - restoreByHwnd(hwnd)           Win32 ShowWindow(SW_RESTORE) via PS
 *   - closeByHwnd(hwnd)             WM_CLOSE message via PS
 *   - All read queries delegated to desktopStateEngine (cached, O(n))
 *
 * Usage:
 *   import { findBestWindow, focusByHwnd } from './windowTracker.js'
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import {
  getTrackedWindows,
  getFocusedWindow,
  findWindowsByProcess,
  findWindowsByTitle,
} from './desktopStateEngine.js'
import type { TrackedWindow } from './desktopStateEngine.js'

export type { TrackedWindow }

const execAsync = promisify(exec)

// ─── Re-export read helpers ───────────────────────────────────────────────────

export { getTrackedWindows, getFocusedWindow, findWindowsByProcess, findWindowsByTitle }

// ─── Fuzzy window matching ────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Score 0–100 how well `query` matches `window` using multiple signals.
 */
function scoreWindow(query: string, w: TrackedWindow): number {
  const q     = norm(query)
  const proc  = norm(w.processName)
  const title = norm(w.title)

  if (proc  === q || title === q) return 100
  if (proc.startsWith(q)  && q.length >= 3) return 90
  if (title.startsWith(q) && q.length >= 3) return 85
  if (proc.includes(q)    && q.length >= 3) return 75
  if (title.includes(q)   && q.length >= 3) return 70
  if (q.includes(proc)    && proc.length >= 3) return 68
  if (q.includes(title)   && title.length >= 3) return 65

  // Word-level: query words appear in processName or title
  const qWords = q.split(' ').filter((w) => w.length >= 2)
  if (qWords.length > 0) {
    const combined = `${proc} ${title}`
    const matched  = qWords.filter((qw) => combined.includes(qw))
    if (matched.length === qWords.length) return 62
    if (matched.length > 0) return Math.round(30 + (matched.length / qWords.length) * 30)
  }

  return 0
}

/**
 * Resolve a natural-language query (app name, process name, or window title)
 * to the single best-matching tracked window.
 *
 * Selection criteria (priority order):
 *  1. Highest score
 *  2. Ties broken by: focused > normal > minimized
 *  3. Most recently captured
 */
export function findBestWindow(query: string): TrackedWindow | null {
  const windows = getTrackedWindows()
  if (!windows.length) return null

  let best:      TrackedWindow | null = null
  let bestScore  = 0

  for (const w of windows) {
    const score = scoreWindow(query, w)
    if (score <= 0) continue

    if (score > bestScore) {
      best      = w
      bestScore = score
      continue
    }

    if (score === bestScore && best) {
      // Prefer focused over minimized
      const wPriority = w.isFocused ? 2 : w.isMinimized ? 0 : 1
      const bPriority = best.isFocused ? 2 : best.isMinimized ? 0 : 1
      if (wPriority > bPriority) best = w
    }
  }

  if (best) {
    console.log(
      `[JARVIS_WINDOW] matched query="${query}" ` +
      `proc=${best.processName} hwnd=${best.hwnd} ` +
      `score=${bestScore} focused=${best.isFocused} minimized=${best.isMinimized}`,
    )
  } else {
    console.log(`[JARVIS_WINDOW] no window match for query="${query}"`)
  }

  return best
}

/**
 * Find all windows that could represent the given app.
 * Returns them sorted best-match first.
 */
export function findAllWindowsForApp(query: string): TrackedWindow[] {
  const windows = getTrackedWindows()
  const scored  = windows
    .map((w) => ({ w, score: scoreWindow(query, w) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.map(({ w }) => w)
}

// ─── Win32 window operations ──────────────────────────────────────────────────

const SW_RESTORE  = 9
const SW_MINIMIZE = 6
const SW_MAXIMIZE = 3

/** Inline Win32 bindings embedded in every PS call. */
const WIN32_BLOCK = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class JarvisWT {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr wP, IntPtr lP);
}
'@ -ErrorAction SilentlyContinue
`.trim()

async function runWin32(script: string): Promise<string> {
  const full = `${WIN32_BLOCK}; ${script}`.replace(/\n/g, ' ')
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -Command "${full.replace(/"/g, '\\"')}"`,
    { windowsHide: true, timeout: 8_000 },
  )
  return stdout.trim()
}

export type WindowOpResult = { ok: boolean; message: string }

/** Focus window by HWND. Restores it first if minimised. */
export async function focusByHwnd(hwnd: number): Promise<WindowOpResult> {
  try {
    await runWin32(
      `$h = [IntPtr]${hwnd};` +
      `if ([JarvisWT]::IsIconic($h)) { [JarvisWT]::ShowWindow($h, ${SW_RESTORE}) | Out-Null };` +
      `[JarvisWT]::SetForegroundWindow($h) | Out-Null`,
    )
    console.log(`[JARVIS_WINDOW] focus success hwnd=${hwnd}`)
    return { ok: true, message: 'Window focused.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[JARVIS_WINDOW] focus failed hwnd=${hwnd} err=${msg.slice(0, 120)}`)
    return { ok: false, message: `Could not focus window: ${msg.slice(0, 120)}` }
  }
}

/** Minimise window by HWND. */
export async function minimizeByHwnd(hwnd: number): Promise<WindowOpResult> {
  try {
    await runWin32(`$h = [IntPtr]${hwnd}; [JarvisWT]::ShowWindow($h, ${SW_MINIMIZE}) | Out-Null`)
    console.log(`[JARVIS_WINDOW] minimized hwnd=${hwnd}`)
    return { ok: true, message: 'Window minimized.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not minimize window: ${msg.slice(0, 120)}` }
  }
}

/** Maximise window by HWND. */
export async function maximizeByHwnd(hwnd: number): Promise<WindowOpResult> {
  try {
    await runWin32(`$h = [IntPtr]${hwnd}; [JarvisWT]::ShowWindow($h, ${SW_MAXIMIZE}) | Out-Null`)
    console.log(`[JARVIS_WINDOW] maximized hwnd=${hwnd}`)
    return { ok: true, message: 'Window maximized.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not maximize window: ${msg.slice(0, 120)}` }
  }
}

/** Restore window by HWND. */
export async function restoreByHwnd(hwnd: number): Promise<WindowOpResult> {
  try {
    await runWin32(`$h = [IntPtr]${hwnd}; [JarvisWT]::ShowWindow($h, ${SW_RESTORE}) | Out-Null`)
    console.log(`[JARVIS_WINDOW] restored hwnd=${hwnd}`)
    return { ok: true, message: 'Window restored.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not restore window: ${msg.slice(0, 120)}` }
  }
}

/** Close window by HWND (sends WM_CLOSE — polite close, not forced kill). */
export async function closeByHwnd(hwnd: number): Promise<WindowOpResult> {
  try {
    // 0x0010 = WM_CLOSE
    await runWin32(`$h = [IntPtr]${hwnd}; [JarvisWT]::SendMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null`)
    console.log(`[JARVIS_WINDOW] WM_CLOSE sent hwnd=${hwnd}`)
    return { ok: true, message: 'Window closed.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not close window: ${msg.slice(0, 120)}` }
  }
}

// ─── High-level named operations ─────────────────────────────────────────────

/**
 * Focus the best window matching `query`.
 * Returns { ok, message, hwnd } where hwnd is the HWND if found.
 */
export async function focusByQuery(query: string): Promise<WindowOpResult & { hwnd?: number }> {
  const win = findBestWindow(query)
  if (!win) return { ok: false, message: `No window found for "${query}".` }
  const result = await focusByHwnd(win.hwnd)
  return { ...result, hwnd: win.hwnd }
}

export async function minimizeByQuery(query: string): Promise<WindowOpResult & { hwnd?: number }> {
  const win = findBestWindow(query)
  if (!win) return { ok: false, message: `No window found for "${query}".` }
  const result = await minimizeByHwnd(win.hwnd)
  return { ...result, hwnd: win.hwnd }
}

export async function maximizeByQuery(query: string): Promise<WindowOpResult & { hwnd?: number }> {
  const win = findBestWindow(query)
  if (!win) return { ok: false, message: `No window found for "${query}".` }
  const result = await maximizeByHwnd(win.hwnd)
  return { ...result, hwnd: win.hwnd }
}

export async function restoreByQuery(query: string): Promise<WindowOpResult & { hwnd?: number }> {
  const win = findBestWindow(query)
  if (!win) return { ok: false, message: `No window found for "${query}".` }
  const result = await restoreByHwnd(win.hwnd)
  return { ...result, hwnd: win.hwnd }
}

export async function closeByQuery(query: string): Promise<WindowOpResult & { hwnd?: number }> {
  const win = findBestWindow(query)
  if (!win) return { ok: false, message: `No window found for "${query}".` }
  const result = await closeByHwnd(win.hwnd)
  return { ...result, hwnd: win.hwnd }
}
