/**
 * Local desktop application control via OS shell (no LLM).
 *
 * Close strategy (in priority order):
 *  1. tasklist /FI scan through each known processName — use the first match
 *  2. PowerShell window-title scan (fallback for apps whose exe name varies)
 *  3. Report "not running" only when both strategies find nothing
 *
 * Open strategy:
 *  - Standard apps  → execAsync('cmd /c start <name>')
 *  - UWP/Store apps → spawn('explorer.exe', [shell:URI], { shell: false })
 *    (bypasses cmd.exe so the '!' in the AUMID is never mangled)
 *
 * Future: file ops, browser automation, workflows — keep entry points here.
 */
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { displayNameForApp, parseDesktopAutomationIntent, parseMultiIntent, } from './desktopAutomationIntent.js';
const execAsync = promisify(exec);
const APP_REGISTRY = {
    chrome: {
        processNames: ['chrome.exe'],
        windowTitle: 'Google Chrome',
        openCmd: 'start chrome',
    },
    whatsapp: {
        // WhatsApp Store version (Windows 10/11) actual process is WhatsApp.Root.exe.
        // WhatsApp.exe and WhatsAppDesktop.exe are kept as fallbacks for other
        // distribution channels / older versions.
        processNames: ['WhatsApp.Root.exe', 'WhatsApp.exe', 'WhatsAppDesktop.exe'],
        windowTitle: 'WhatsApp',
        explorerUri: 'shell:AppsFolder\\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App',
    },
    vscode: {
        processNames: ['Code.exe'],
        windowTitle: 'Visual Studio Code',
        openCmd: 'start code',
    },
    spotify: {
        processNames: ['Spotify.exe'],
        windowTitle: 'Spotify',
        openCmd: 'start spotify',
    },
    notepad: {
        processNames: ['notepad.exe', 'Notepad.exe'],
        windowTitle: 'Notepad',
        openCmd: 'start notepad',
    },
    calculator: {
        processNames: ['CalculatorApp.exe', 'Calculator.exe'],
        windowTitle: 'Calculator',
        openCmd: 'start calc',
    },
};
// ---------------------------------------------------------------------------
// Process detection helpers
// ---------------------------------------------------------------------------
/**
 * Check whether a single exe image name is currently running via tasklist /FI.
 * Returns the matching process name (for use in taskkill) or null.
 */
async function isProcessRunning(processName) {
    try {
        const { stdout } = await execAsync(`cmd /c tasklist /FI "IMAGENAME eq ${processName}" /NH`, { windowsHide: true, timeout: 6_000 });
        // tasklist prints the image name on a match; "No tasks" when nothing found
        return stdout.toLowerCase().includes(processName.toLowerCase());
    }
    catch {
        return false;
    }
}
/**
 * Scan all processNames for an app definition and return the first one that
 * is currently running, or null if none are active.
 */
async function detectRunningProcess(app) {
    for (const name of app.processNames) {
        const running = await isProcessRunning(name);
        if (running) {
            console.log('[JARVIS_AUTOMATION] detected process', name);
            return name;
        }
    }
    return null;
}
/**
 * PowerShell window-title fallback.
 * Returns the ProcessName of the first process whose window title matches,
 * or null if nothing matches.
 */
async function detectByWindowTitle(title) {
    try {
        const ps = [
            'Get-Process',
            `| Where-Object { $_.MainWindowTitle -match '${title.replace(/'/g, "\\'")}' }`,
            '| Select-Object -First 1 -ExpandProperty ProcessName',
        ].join(' ');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 10_000 });
        const found = stdout.trim();
        if (found) {
            console.log('[JARVIS_AUTOMATION] detected process via window title', found);
            return `${found}.exe`;
        }
        return null;
    }
    catch {
        return null;
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isWindows() {
    return process.platform === 'win32';
}
/**
 * Spawn explorer.exe with a shell: URI directly (no cmd.exe in between).
 * Resolves once the process has spawned; rejects on spawn error.
 */
function spawnExplorer(uri) {
    return new Promise((resolve, reject) => {
        const child = spawn('explorer.exe', [uri], {
            detached: true,
            stdio: 'ignore',
            shell: false,
        });
        child.once('error', reject);
        child.once('spawn', () => {
            child.unref();
            resolve();
        });
        setTimeout(resolve, 5_000);
    });
}
function redactPaths(s) {
    return s.replace(/[A-Z]:\\[^\s"]+/gi, '[path]').slice(0, 200);
}
// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------
export async function openApplication(appName) {
    if (!isWindows()) {
        return { ok: false, message: 'Desktop automation is only supported on Windows.' };
    }
    const label = displayNameForApp(appName);
    const def = APP_REGISTRY[appName];
    // UWP / Store app (explorer.exe, no cmd.exe)
    if (def.explorerUri) {
        console.log('[JARVIS_AUTOMATION] launching', appName, '(explorer)');
        console.log('[JARVIS_AUTOMATION] command', `explorer.exe ${def.explorerUri}`);
        try {
            await spawnExplorer(def.explorerUri);
            console.log('[JARVIS_AUTOMATION] launched', appName);
            return { ok: true, message: `Opening ${label}.` };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[JARVIS_AUTOMATION] failed', appName, msg);
            return { ok: false, message: `I couldn't open ${label}. ${redactPaths(msg)}` };
        }
    }
    // Standard app via cmd /c start
    if (def.openCmd) {
        const fullCmd = `cmd /c ${def.openCmd}`;
        console.log('[JARVIS_AUTOMATION] launching', appName);
        console.log('[JARVIS_AUTOMATION] command', fullCmd);
        try {
            await execAsync(fullCmd, { windowsHide: true, timeout: 10_000 });
            console.log('[JARVIS_AUTOMATION] launched', appName);
            return { ok: true, message: `Opening ${label}.` };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[JARVIS_AUTOMATION] failed', appName, msg);
            return { ok: false, message: `I couldn't open ${label}. ${redactPaths(msg)}` };
        }
    }
    return { ok: false, message: `No open command configured for ${label}.` };
}
// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------
export async function closeApplication(appName) {
    if (!isWindows()) {
        return { ok: false, message: 'Desktop automation is only supported on Windows.' };
    }
    const label = displayNameForApp(appName);
    const def = APP_REGISTRY[appName];
    // Step 1 — detect via tasklist
    let targetExe = await detectRunningProcess(def);
    // Step 2 — fallback: detect via PowerShell window title
    if (!targetExe && def.windowTitle) {
        targetExe = await detectByWindowTitle(def.windowTitle);
    }
    // Step 3 — nothing found
    if (!targetExe) {
        console.log('[JARVIS_AUTOMATION] process not found', appName);
        return { ok: true, message: `${label} is not running.` };
    }
    // Step 4 — kill the detected process
    const killCmd = `cmd /c taskkill /F /IM ${targetExe}`;
    console.log('[JARVIS_AUTOMATION] closing process', targetExe, 'for', appName);
    console.log('[JARVIS_AUTOMATION] command', killCmd);
    try {
        const { stdout, stderr } = await execAsync(killCmd, { windowsHide: true, timeout: 10_000 });
        const out = (stdout + stderr).toLowerCase();
        if (out.includes('not found') || out.includes('could not find') || out.includes('no tasks')) {
            return { ok: true, message: `${label} is not running.` };
        }
        console.log('[JARVIS_AUTOMATION] closed', appName);
        return { ok: true, message: `Closing ${label}.` };
    }
    catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const low = raw.toLowerCase();
        console.error('[JARVIS_AUTOMATION] failed', appName, raw);
        if (low.includes('not found') || low.includes('not running') || low.includes('no tasks')) {
            return { ok: true, message: `${label} is not running.` };
        }
        return { ok: false, message: `I couldn't close ${label}. ${redactPaths(raw)}` };
    }
}
async function executeSingleIntent(intent) {
    if (intent.kind === 'open') {
        const result = await openApplication(intent.app);
        return result.message;
    }
    const result = await closeApplication(intent.app);
    return result.message;
}
/**
 * If `text` is a supported open/close command (single or compound), run it and return an
 * assistant-style reply.  Otherwise returns `{ handled: false }` so the caller invokes the LLM.
 *
 * Supported forms:
 *   "open notepad"                    → single
 *   "close what's app"                → single (WhatsApp alias)
 *   "close what's app and notepad"    → compound
 *   "open chrome and spotify"         → compound
 */
export async function tryRunDesktopAutomationFromUserText(text) {
    // Compound intent ("close X and Y")
    const multi = parseMultiIntent(text);
    if (multi) {
        console.log('[JARVIS_AUTOMATION] compound intent matched', multi);
        const messages = await Promise.all(multi.map(executeSingleIntent));
        return { handled: true, message: messages.join(' ') };
    }
    // Single intent ("close X")
    const single = parseDesktopAutomationIntent(text);
    if (!single) {
        return { handled: false };
    }
    console.log('[JARVIS_AUTOMATION] intent matched', single);
    const message = await executeSingleIntent(single);
    return { handled: true, message };
}
