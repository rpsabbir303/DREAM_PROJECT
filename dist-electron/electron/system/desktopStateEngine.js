/**
 * Desktop State Engine
 *
 * The central live-desktop-state source of truth for Jarvis.
 *
 * Continuously tracks every visible window on the system:
 *   - HWND (Win32 window handle) — PRIMARY identity
 *   - PID, process name, exe path
 *   - Window title
 *   - Focus, minimize, maximize state
 *
 * Refresh cadence:
 *   - Full window snapshot:  every 2 s
 *   - Focus-only fast check: every 1 s (lightweight — just GetForegroundWindow)
 *
 * The engine uses a single PowerShell invocation per poll that combines
 * Get-Process (fast, managed) with inline Win32 Add-Type for IsIconic/IsZoomed.
 *
 * All consumers should call startDesktopStateEngine() on app ready.
 *
 * Usage:
 *   import { startDesktopStateEngine, getTrackedWindows, getFocusedWindow }
 *     from './desktopStateEngine.js'
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { systemEvents } from './systemEvents.js';
import { setActiveWindow } from './runtimeState.js';
const execAsync = promisify(exec);
// ─── State ────────────────────────────────────────────────────────────────────
let _windows = [];
let _focused = null;
let _fullTimer = null;
let _focusTimer = null;
const FULL_REFRESH_MS = 2_000;
const FOCUS_REFRESH_MS = 1_000;
// ─── PowerShell snapshot ──────────────────────────────────────────────────────
/**
 * Combined PS script:
 *  1. Compiles inline Win32 bindings (IsIconic, IsZoomed, GetForegroundWindow).
 *  2. Iterates Get-Process windows.
 *  3. Emits pipe-delimited lines: hwnd|pid|procName|title|focused|min|max|exePath
 */
const SNAPSHOT_PS = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class JarvisSnap {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
}
'@ -ErrorAction SilentlyContinue
$fg = [JarvisSnap]::GetForegroundWindow().ToInt64()
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } | ForEach-Object {
    $h   = $_.MainWindowHandle
    $hv  = $h.ToInt64()
    $min = if ([JarvisSnap]::IsIconic($h)) { 1 } else { 0 }
    $max = if ([JarvisSnap]::IsZoomed($h)) { 1 } else { 0 }
    $foc = if ($hv -eq $fg) { 1 } else { 0 }
    $exe = if ($_.Path) { $_.Path } else { '' }
    Write-Output "$hv|$($_.Id)|$($_.ProcessName)|$($_.MainWindowTitle)|$foc|$min|$max|$exe"
}
`.trim();
/** Fast foreground-only query. */
const FOCUS_PS = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Text;
public class JarvisFg {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
'@ -ErrorAction SilentlyContinue
$h  = [JarvisFg]::GetForegroundWindow()
$hv = $h.ToInt64()
$sb = New-Object System.Text.StringBuilder(256)
[JarvisFg]::GetWindowText($h, $sb, 256) | Out-Null
$pid = [uint32]0
[JarvisFg]::GetWindowThreadProcessId($h, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
if ($proc) { Write-Output "$hv|$pid|$($proc.ProcessName)|$($sb.ToString())" }
`.trim();
// ─── Parse helpers ────────────────────────────────────────────────────────────
function parseSnapshot(stdout) {
    const now = Date.now();
    const windows = [];
    for (const raw of stdout.trim().split('\n')) {
        const parts = raw.trim().split('|');
        if (parts.length < 7)
            continue;
        const [hwndStr, pidStr, procName, title, focStr, minStr, maxStr, ...exeParts] = parts;
        const hwnd = Number(hwndStr);
        const pid = Number(pidStr);
        if (!hwnd || !pid || !title?.trim())
            continue;
        windows.push({
            hwnd,
            pid,
            processName: (procName ?? '').toLowerCase().replace(/\.exe$/i, ''),
            title: title.trim(),
            exePath: exeParts.join('|').trim() || null,
            isFocused: focStr === '1',
            isMinimized: minStr === '1',
            isMaximized: maxStr === '1',
            capturedAt: now,
        });
    }
    return windows;
}
// ─── Pollers ──────────────────────────────────────────────────────────────────
async function runFullSnapshot() {
    try {
        const safe = SNAPSHOT_PS.replace(/\n/g, '; ').replace(/"/g, '\\"');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${safe}"`, { windowsHide: true, timeout: 10_000 });
        const fresh = parseSnapshot(stdout);
        const prevFocused = _focused;
        _windows = fresh;
        _focused = fresh.find((w) => w.isFocused) ?? null;
        console.log(`[JARVIS_STATE] tracking ${fresh.length} windows — focused=${_focused?.processName ?? 'none'}`);
        // Sync runtimeState active window
        if (_focused) {
            const windowState = _focused.isMinimized ? 'minimized' :
                _focused.isMaximized ? 'maximized' :
                    'normal';
            const snap = {
                processName: `${_focused.processName}.exe`,
                appName: _focused.processName.replace(/\.exe$/i, ''),
                title: _focused.title,
                pid: _focused.pid,
                windowState,
                capturedAt: Date.now(),
            };
            setActiveWindow(snap);
            // Emit focus_changed only when the focused window actually changed
            if (!prevFocused || prevFocused.hwnd !== _focused.hwnd) {
                const fromSnap = prevFocused ? {
                    processName: `${prevFocused.processName}.exe`,
                    appName: prevFocused.processName,
                    title: prevFocused.title,
                    pid: prevFocused.pid,
                    windowState: prevFocused.isMinimized ? 'minimized' : prevFocused.isMaximized ? 'maximized' : 'normal',
                    capturedAt: prevFocused.capturedAt,
                } : null;
                systemEvents.emit('focus_changed', { from: fromSnap, to: snap });
                console.log(`[JARVIS_STATE] focused=${_focused.processName} hwnd=${_focused.hwnd}`);
            }
        }
    }
    catch {
        // Swallow — stale data is fine for one cycle
    }
}
async function runFocusCheck() {
    try {
        const safe = FOCUS_PS.replace(/\n/g, '; ').replace(/"/g, '\\"');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${safe}"`, { windowsHide: true, timeout: 5_000 });
        const line = stdout.trim().split('\n')[0]?.trim();
        if (!line)
            return;
        const [hwndStr, pidStr, procName, ...titleParts] = line.split('|');
        const hwnd = Number(hwndStr);
        if (!hwnd)
            return;
        // Update focus flag in cache without a full re-scan
        for (const w of _windows)
            w.isFocused = (w.hwnd === hwnd);
        const nowFocused = _windows.find((w) => w.isFocused) ?? null;
        if (nowFocused?.hwnd !== _focused?.hwnd) {
            const prev = _focused;
            _focused = nowFocused ?? {
                hwnd,
                pid: Number(pidStr),
                processName: (procName ?? '').toLowerCase().replace(/\.exe$/i, ''),
                title: titleParts.join('|').trim(),
                exePath: null,
                isFocused: true,
                isMinimized: false,
                isMaximized: false,
                capturedAt: Date.now(),
            };
            setActiveWindow({
                processName: `${_focused.processName}.exe`,
                appName: _focused.processName.replace(/\.exe$/i, ''),
                title: _focused.title,
                pid: _focused.pid,
                windowState: 'normal',
                capturedAt: Date.now(),
            });
            const toSnap = {
                processName: `${_focused.processName}.exe`,
                appName: _focused.processName,
                title: _focused.title,
                pid: _focused.pid,
                windowState: 'normal',
                capturedAt: Date.now(),
            };
            const fromSnap2 = prev ? {
                processName: `${prev.processName}.exe`,
                appName: prev.processName,
                title: prev.title,
                pid: prev.pid,
                windowState: prev.isMinimized ? 'minimized' : prev.isMaximized ? 'maximized' : 'normal',
                capturedAt: prev.capturedAt,
            } : null;
            systemEvents.emit('focus_changed', { from: fromSnap2, to: toSnap });
        }
    }
    catch {
        // Non-critical
    }
}
// ─── Public API ───────────────────────────────────────────────────────────────
/** Start the desktop state engine. Safe to call multiple times. */
export function startDesktopStateEngine() {
    if (_fullTimer)
        return;
    // Immediate first snapshot
    runFullSnapshot().catch(() => undefined);
    _fullTimer = setInterval(runFullSnapshot, FULL_REFRESH_MS);
    _focusTimer = setInterval(runFocusCheck, FOCUS_REFRESH_MS);
    console.log('[JARVIS_STATE] desktop state engine started');
}
/** Stop all pollers (call on app quit). */
export function stopDesktopStateEngine() {
    if (_fullTimer) {
        clearInterval(_fullTimer);
        _fullTimer = null;
    }
    if (_focusTimer) {
        clearInterval(_focusTimer);
        _focusTimer = null;
    }
}
/** All currently tracked windows (last 2-second snapshot). */
export function getTrackedWindows() {
    return _windows;
}
/** The window that currently has focus, or null. */
export function getFocusedWindow() {
    return _focused;
}
/** Find windows whose process name matches (partial, case-insensitive). */
export function findWindowsByProcess(processName) {
    const target = processName.toLowerCase().replace(/\.exe$/i, '');
    return _windows.filter((w) => w.processName.includes(target) || target.includes(w.processName));
}
/** Find windows whose title contains the given fragment (case-insensitive). */
export function findWindowsByTitle(fragment) {
    const frag = fragment.toLowerCase();
    return _windows.filter((w) => w.title.toLowerCase().includes(frag));
}
/**
 * Force a fresh snapshot immediately, outside the normal polling cycle.
 * Returns the refreshed window list.
 */
export async function forceRefresh() {
    await runFullSnapshot();
    return _windows;
}
/** Wait up to `timeoutMs` for a new window matching the predicate to appear. */
export async function waitForWindow(predicate, timeoutMs = 5_000, pollMs = 500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollMs));
        await runFullSnapshot();
        const found = _windows.find(predicate);
        if (found)
            return found;
    }
    return null;
}
