/**
 * Window Manager — Phase 1 + 5
 *
 * Focus, minimize, maximize, restore, and list windows via PowerShell Win32 API.
 * Uses Add-Type to call user32.dll directly — most reliable on Windows.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { listWindowedProcesses } from './processManager.js';
const execAsync = promisify(exec);
// ─── Win32 constants ──────────────────────────────────────────────────────────
const SW_MINIMIZE = 6;
const SW_MAXIMIZE = 3;
const SW_RESTORE = 9;
// ─── PowerShell helper ───────────────────────────────────────────────────────
/**
 * Inline Win32 Add-Type block — compiled once per PowerShell session.
 * We embed it every call so each powershell -Command is self-contained.
 */
const WIN32_TYPE = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class JarvisWin32 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
'@ -ErrorAction SilentlyContinue
`;
function buildPsCommand(body) {
    const combined = `${WIN32_TYPE}${body}`.replace(/\n/g, '; ');
    return `powershell -NoProfile -NonInteractive -Command "${combined.replace(/"/g, '\\"')}"`;
}
async function runPs(body) {
    const cmd = buildPsCommand(body);
    const { stdout } = await execAsync(cmd, { windowsHide: true, timeout: 12_000 });
    return stdout.trim();
}
/** Resolve process handle by name or window title. */
function buildProcLookup(processNameOrTitle) {
    const safe = processNameOrTitle.replace(/'/g, "\\'");
    return `
$proc = Get-Process | Where-Object {
  $_.ProcessName -like '*${safe}*' -or $_.MainWindowTitle -like '*${safe}*'
} | Select-Object -First 1
`;
}
async function windowOp(processNameOrTitle, swCmd, opName) {
    try {
        const lookup = buildProcLookup(processNameOrTitle);
        const body = `
${lookup}
if ($proc -and $proc.MainWindowHandle -ne 0) {
  [JarvisWin32]::ShowWindow($proc.MainWindowHandle, ${swCmd}) | Out-Null
  [JarvisWin32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  Write-Output "ok"
} else {
  Write-Output "not_found"
}
`;
        const result = await runPs(body);
        if (result.includes('ok')) {
            return { ok: true, message: `${opName} successful.` };
        }
        return { ok: false, message: `Window not found for "${processNameOrTitle}".` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `Window operation failed: ${msg.slice(0, 160)}` };
    }
}
/** Bring a window to the foreground (restore if minimized). */
export async function focusWindow(processNameOrTitle) {
    try {
        const safe = processNameOrTitle.replace(/'/g, "\\'");
        const body = `
${buildProcLookup(processNameOrTitle)}
if ($proc -and $proc.MainWindowHandle -ne 0) {
  if ([JarvisWin32]::IsIconic($proc.MainWindowHandle)) {
    [JarvisWin32]::ShowWindow($proc.MainWindowHandle, ${SW_RESTORE}) | Out-Null
  }
  [JarvisWin32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  Write-Output "ok"
} else {
  Write-Output "not_found"
}
`;
        const result = await runPs(body);
        if (result.includes('ok')) {
            return { ok: true, message: `Focused "${safe}".` };
        }
        return { ok: false, message: `Could not find a window for "${processNameOrTitle}".` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `Focus failed: ${msg.slice(0, 160)}` };
    }
}
export async function minimizeWindow(processNameOrTitle) {
    return windowOp(processNameOrTitle, SW_MINIMIZE, `Minimized "${processNameOrTitle}"`);
}
export async function maximizeWindow(processNameOrTitle) {
    return windowOp(processNameOrTitle, SW_MAXIMIZE, `Maximized "${processNameOrTitle}"`);
}
export async function restoreWindow(processNameOrTitle) {
    return windowOp(processNameOrTitle, SW_RESTORE, `Restored "${processNameOrTitle}"`);
}
/** Returns all visible windows with their titles. */
export async function listWindows() {
    const procs = await listWindowedProcesses();
    return procs.map((p) => ({
        processName: p.name,
        pid: p.pid,
        title: p.title,
    }));
}
/** Get the currently active (foreground) window. */
export async function getActiveWindow() {
    try {
        const body = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FgWin32 {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$hWnd = [FgWin32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder(256)
[FgWin32]::GetWindowText($hWnd, $sb, 256) | Out-Null
$pid = [uint32]0
[FgWin32]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
if ($proc) {
  Write-Output "$($proc.ProcessName)|$pid|$($sb.ToString())"
}
`;
        const ps = body.replace(/\n/g, '; ');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, { windowsHide: true, timeout: 10_000 });
        const line = stdout.trim().split('\n')[0]?.trim();
        if (!line)
            return null;
        const [name, pidStr, ...titleParts] = line.split('|');
        return { processName: `${name}.exe`, pid: Number(pidStr), title: titleParts.join('|') };
    }
    catch {
        return null;
    }
}
