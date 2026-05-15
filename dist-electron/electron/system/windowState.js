/**
 * Window State — Phase 1
 *
 * Polls the OS for:
 *   • currently focused (foreground) window  — every 2 s
 *   • list of all running GUI apps           — every 5 s
 *
 * Writes results into runtimeState and emits events on the systemEvents bus.
 *
 * Call startWindowTracking() once from main/index.ts after app.whenReady().
 */
import { safeLogger } from '../main/safeLogger.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { runtimeState as _runtimeStateRef, setActiveWindow, setRunningApps, } from './runtimeState.js';
import { systemEvents } from './systemEvents.js';
const execAsync = promisify(exec);
// ─── Timing ───────────────────────────────────────────────────────────────────
const ACTIVE_WINDOW_POLL_MS = 2_000;
const RUNNING_APPS_POLL_MS = 5_000;
let activeWindowTimer = null;
let runningAppsTimer = null;
// ─── Process-name → friendly name resolution ─────────────────────────────────
const PROCESS_FRIENDLY = {
    'chrome.exe': 'Chrome',
    'msedge.exe': 'Edge',
    'firefox.exe': 'Firefox',
    'brave.exe': 'Brave',
    'opera.exe': 'Opera',
    'code.exe': 'VS Code',
    'cursor.exe': 'Cursor',
    'notepad.exe': 'Notepad',
    'notepad++.exe': 'Notepad++',
    'explorer.exe': 'File Explorer',
    'slack.exe': 'Slack',
    'discord.exe': 'Discord',
    'spotify.exe': 'Spotify',
    'teams.exe': 'Microsoft Teams',
    'outlook.exe': 'Outlook',
    'word.exe': 'Microsoft Word',
    'winword.exe': 'Microsoft Word',
    'excel.exe': 'Microsoft Excel',
    'powerpnt.exe': 'Microsoft PowerPoint',
    'onenote.exe': 'OneNote',
    'cmd.exe': 'Command Prompt',
    'powershell.exe': 'PowerShell',
    'windowsterminal.exe': 'Windows Terminal',
    'wt.exe': 'Windows Terminal',
    'taskmgr.exe': 'Task Manager',
    'calc.exe': 'Calculator',
    'mspaint.exe': 'Paint',
    'vlc.exe': 'VLC',
    'zoom.exe': 'Zoom',
    'skype.exe': 'Skype',
    'postman.exe': 'Postman',
    'figma.exe': 'Figma',
    'obsidian.exe': 'Obsidian',
    'notion.exe': 'Notion',
    'telegram.exe': 'Telegram',
    'whatsapp.exe': 'WhatsApp',
    'winrar.exe': 'WinRAR',
    '7zfm.exe': '7-Zip',
};
function friendlyName(processName) {
    const key = processName.toLowerCase();
    return PROCESS_FRIENDLY[key] ?? processName.replace(/\.exe$/i, '');
}
// ─── Active window poll ───────────────────────────────────────────────────────
/**
 * Single-shot PowerShell that returns "processName|pid|windowTitle|swState"
 * swState is 0=normal, 2=minimized, 3=maximized (SW_* numeric values).
 */
const ACTIVE_WINDOW_PS = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class JarvisAW {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$h = [JarvisAW]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { exit }
$sb = New-Object System.Text.StringBuilder(512)
[JarvisAW]::GetWindowText($h, $sb, 512) | Out-Null
$pid = [uint32]0
[JarvisAW]::GetWindowThreadProcessId($h, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
if (-not $proc) { exit }
$st = if ([JarvisAW]::IsIconic($h)) { 'minimized' } elseif ([JarvisAW]::IsZoomed($h)) { 'maximized' } else { 'normal' }
Write-Output "$($proc.ProcessName)|$pid|$st|$($sb.ToString())"
`;
let _lastActivePid = -1;
async function pollActiveWindow() {
    try {
        const ps = ACTIVE_WINDOW_PS.replace(/\n/g, '; ');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, { windowsHide: true, timeout: 6_000 });
        const line = stdout.trim().split('\n')[0]?.trim();
        if (!line)
            return;
        // Format: processName|pid|windowState|title
        const sep = line.indexOf('|');
        const rest = line.slice(sep + 1);
        const sep2 = rest.indexOf('|');
        const rest2 = rest.slice(sep2 + 1);
        const sep3 = rest2.indexOf('|');
        const rawProcess = line.slice(0, sep);
        const pid = Number(rest.slice(0, sep2));
        const stateRaw = rest2.slice(0, sep3);
        const title = rest2.slice(sep3 + 1);
        const processName = rawProcess.endsWith('.exe') ? rawProcess : `${rawProcess}.exe`;
        const windowState = (stateRaw === 'minimized' || stateRaw === 'maximized')
            ? stateRaw
            : 'normal';
        const snap = {
            title,
            processName,
            appName: friendlyName(processName),
            pid,
            windowState,
            capturedAt: Date.now(),
        };
        const previous = _lastActivePid;
        setActiveWindow(snap);
        if (pid !== previous) {
            _lastActivePid = pid;
            const prev = previous === -1 ? null : null; // will be filled by runtimeState's previous
            systemEvents.emit('focus_changed', { from: prev, to: snap });
            safeLogger.info(`[JARVIS_WIN] focus → ${snap.appName} (${processName}) pid=${pid} state=${windowState}`);
        }
    }
    catch {
        // Silently ignore transient poll failures
    }
}
// ─── Running apps poll ────────────────────────────────────────────────────────
const RUNNING_APPS_PS = `
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } |
  Select-Object ProcessName, Id, MainWindowTitle |
  ForEach-Object { "$($_.ProcessName)|$($_.Id)|$($_.MainWindowTitle)" }
`;
async function pollRunningApps() {
    try {
        const ps = RUNNING_APPS_PS.replace(/\n/g, ' ');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, { windowsHide: true, timeout: 10_000 });
        const apps = [];
        const seen = new Map();
        for (const raw of stdout.trim().split('\n')) {
            const line = raw.trim();
            if (!line)
                continue;
            const [proc, pidStr, ...titleParts] = line.split('|');
            if (!proc)
                continue;
            const processName = proc.endsWith('.exe') ? proc : `${proc}.exe`;
            const pid = Number(pidStr);
            const title = titleParts.join('|');
            const key = processName.toLowerCase();
            if (seen.has(key)) {
                seen.get(key).windows.push(title);
            }
            else {
                const entry = {
                    processName,
                    appName: friendlyName(processName),
                    pid,
                    windows: [title],
                };
                seen.set(key, entry);
                apps.push(entry);
            }
        }
        setRunningApps(apps);
    }
    catch {
        // Silently ignore
    }
}
// ─── Public API ───────────────────────────────────────────────────────────────
/** Start background polling. Safe to call multiple times — idempotent. */
export function startWindowTracking() {
    if (activeWindowTimer)
        return;
    safeLogger.info('[JARVIS_WIN] window tracking started');
    void pollActiveWindow();
    void pollRunningApps();
    activeWindowTimer = setInterval(() => { void pollActiveWindow(); }, ACTIVE_WINDOW_POLL_MS);
    runningAppsTimer = setInterval(() => { void pollRunningApps(); }, RUNNING_APPS_POLL_MS);
}
/** Stop polling (called on app quit). */
export function stopWindowTracking() {
    if (activeWindowTimer) {
        clearInterval(activeWindowTimer);
        activeWindowTimer = null;
    }
    if (runningAppsTimer) {
        clearInterval(runningAppsTimer);
        runningAppsTimer = null;
    }
    safeLogger.info('[JARVIS_WIN] window tracking stopped');
}
/**
 * Synchronous in-process check: is a given process name currently running?
 * Reads from the last polled runningApps cache — no shell spawn.
 */
export function isCachedRunning(processName) {
    const key = processName.toLowerCase().replace(/\.exe$/, '');
    // Import runtimeState at the top of the file — avoid require() in ESM
    return _runtimeStateRef.runningApps.some((a) => a.processName.toLowerCase().replace(/\.exe$/, '') === key);
}
