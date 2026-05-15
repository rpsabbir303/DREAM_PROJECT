/**
 * Execution Orchestrator
 *
 * The universal app launcher and controller for Jarvis.
 *
 * Decision flow for every open/launch request:
 *
 *   1. Check WindowTracker — is a matching window already visible?
 *      YES → focus existing window (HWND-based), return "already open"
 *      NO  →
 *   2. Check process list — is the process running but without a window?
 *      YES → wait briefly for window then focus
 *      NO  →
 *   3. Resolve launch strategy (LaunchStrategyResolver)
 *   4. Spawn the process
 *   5. Verify: poll WindowTracker until the new window appears (up to 5 s)
 *   6. Focus the new window + return result with HWND
 *
 * For close / focus / minimize / restore — always goes HWND-first.
 *
 * Usage:
 *   import { orchestrate } from './executionOrchestrator.js'
 *   const result = await orchestrate({ action: 'open', query: 'photoshop', app: discoveredApp })
 */
import { spawn } from 'node:child_process';
import { findBestWindow, findWindowsByProcess, focusByHwnd, minimizeByHwnd, maximizeByHwnd, restoreByHwnd, closeByHwnd, } from './windowTracker.js';
import { waitForWindow, getTrackedWindows } from './desktopStateEngine.js';
import { resolveStrategy, formatStrategyLog } from './launchStrategyResolver.js';
import { isProcessInGraph } from './runtimeProcessGraph.js';
import { recordOpened, recordClosed } from './runtimeState.js';
import { systemEvents } from './systemEvents.js';
// ─── Internal helpers ─────────────────────────────────────────────────────────
/**
 * Spawn an exe detached from Jarvis's stdio.
 * Returns the child PID (or 0 on error).
 */
function spawnDetached(executable, args) {
    return new Promise((resolve) => {
        try {
            const child = spawn(executable, args, {
                detached: true,
                stdio: 'ignore',
                shell: executable === 'cmd',
            });
            child.once('spawn', () => {
                const pid = child.pid ?? 0;
                child.unref();
                resolve(pid);
            });
            child.once('error', () => resolve(0));
            setTimeout(() => resolve(0), 3_000);
        }
        catch {
            resolve(0);
        }
    });
}
/**
 * Build a human-readable label for the app.
 */
function appLabel(query, app) {
    return app?.canonicalName ?? query;
}
// ─── Open / Launch ────────────────────────────────────────────────────────────
async function handleOpen(req) {
    const { query, app } = req;
    const label = appLabel(query, app);
    // ── Step 1: Window already visible? ──────────────────────────────────────
    const existingWindow = findBestWindow(query);
    if (existingWindow) {
        const state = existingWindow.isMinimized ? 'minimized' :
            existingWindow.isFocused ? 'already focused' :
                'open in background';
        const focusResult = await focusByHwnd(existingWindow.hwnd);
        if (focusResult.ok) {
            console.log(`[JARVIS_EXEC] found existing window — ${label} (${state}) hwnd=${existingWindow.hwnd}`);
            return {
                ok: true,
                message: `${label} is already open. ${existingWindow.isMinimized ? 'Restored and brought' : 'Brought'} it to the front.`,
                hwnd: existingWindow.hwnd,
                pid: existingWindow.pid,
                launched: false,
            };
        }
    }
    // ── Step 2: Process running but no visible window yet? ────────────────────
    if (app?.processName) {
        const procName = app.processName.replace(/\.exe$/i, '');
        if (isProcessInGraph(procName)) {
            console.log(`[JARVIS_EXEC] process running but no window yet — ${procName}, waiting…`);
            const appeared = await waitForWindow((w) => w.processName.includes(procName), 3_000);
            if (appeared) {
                await focusByHwnd(appeared.hwnd);
                return {
                    ok: true,
                    message: `${label} is already running. Brought it to the front.`,
                    hwnd: appeared.hwnd,
                    pid: appeared.pid,
                    launched: false,
                };
            }
        }
    }
    // ── Step 3: Resolve launch strategy ──────────────────────────────────────
    if (!app) {
        return {
            ok: false,
            message: `I couldn't find "${query}" on this PC. Make sure it is installed and try again.`,
            launched: false,
        };
    }
    const decision = resolveStrategy(app);
    console.log(formatStrategyLog(decision));
    // ── Step 4: Spawn ─────────────────────────────────────────────────────────
    // Capture current window hwnds before launching so we can detect the new one
    const hwndsBefore = new Set(getTrackedWindows().map((w) => w.hwnd));
    const pid = await spawnDetached(decision.executable, decision.args);
    console.log(`[JARVIS_EXEC] launched pid=${pid || 'unknown'} label="${label}"`);
    if (!pid && decision.strategy !== 'cmd_start') {
        // cmd_start doesn't give us a PID; assume success
        return {
            ok: false,
            message: `Failed to launch ${label}. The executable may be missing or blocked.`,
            launched: false,
        };
    }
    recordOpened(label);
    systemEvents.emit('app_opened', { app: label });
    // ── Step 5: Verify — wait for new window to appear ────────────────────────
    const processHint = app.processName?.replace(/\.exe$/i, '') ?? '';
    const newWindow = await waitForWindow((w) => {
        if (hwndsBefore.has(w.hwnd))
            return false;
        if (processHint && w.processName.includes(processHint))
            return true;
        const titleLower = w.title.toLowerCase();
        const labelLower = label.toLowerCase();
        return titleLower.includes(labelLower) || labelLower.includes(titleLower.split(' ')[0] ?? '');
    }, 5_000, 400);
    if (newWindow) {
        await focusByHwnd(newWindow.hwnd);
        console.log(`[JARVIS_WINDOW] detected hwnd=${newWindow.hwnd} title="${newWindow.title}"`);
        return {
            ok: true,
            message: `Opening ${label}.`,
            hwnd: newWindow.hwnd,
            pid: newWindow.pid,
            launched: true,
        };
    }
    // Launched but window not yet detected (background startup) — still success
    return {
        ok: true,
        message: `Opening ${label}.`,
        pid: pid || undefined,
        launched: true,
    };
}
// ─── Close ────────────────────────────────────────────────────────────────────
async function handleClose(req) {
    const { query, app } = req;
    const label = appLabel(query, app);
    // Find window first
    const win = findBestWindow(query);
    if (win) {
        const result = await closeByHwnd(win.hwnd);
        if (result.ok) {
            recordClosed(label);
            systemEvents.emit('app_closed', { app: label });
            return { ok: true, message: `Closed ${label}.`, hwnd: win.hwnd, launched: false };
        }
    }
    // Fallback: close by process name via taskkill
    const procName = app?.processName ?? `${query}.exe`;
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    try {
        const imageName = procName.endsWith('.exe') ? procName : `${procName}.exe`;
        const { stdout } = await execAsync(`cmd /c taskkill /F /IM "${imageName}"`, { windowsHide: true, timeout: 8_000 });
        const lower = stdout.toLowerCase();
        if (!lower.includes('not found') && !lower.includes('no tasks')) {
            recordClosed(label);
            systemEvents.emit('app_closed', { app: label });
            return { ok: true, message: `Closed ${label}.`, launched: false };
        }
    }
    catch { /* Not running */ }
    return { ok: true, message: `${label} doesn't appear to be running.`, launched: false };
}
// ─── Focus / Minimize / Maximize / Restore ────────────────────────────────────
async function handleWindowOp(req, opFn) {
    const { query, app } = req;
    const label = appLabel(query, app);
    // Try HWND-based first
    const win = findBestWindow(query);
    if (win) {
        const result = await opFn(win.hwnd);
        return { ...result, hwnd: win.hwnd, pid: win.pid, launched: false };
    }
    // Fallback: process/title based (windowManager legacy)
    const terms = [query, app?.processName?.replace(/\.exe$/i, '') ?? ''].filter(Boolean);
    for (const term of terms) {
        if (!term)
            continue;
        const byTitle = findWindowsByProcess(term);
        if (byTitle.length) {
            const result = await opFn(byTitle[0].hwnd);
            return { ...result, hwnd: byTitle[0].hwnd, launched: false };
        }
    }
    return { ok: false, message: `No window found for "${label}".`, launched: false };
}
// ─── Main entry point ─────────────────────────────────────────────────────────
/**
 * Route an app control request through the full window-first orchestration pipeline.
 *
 * @param req.action   What to do: 'open' | 'close' | 'focus' | 'minimize' | 'maximize' | 'restore' | 'switch'
 * @param req.query    Human-readable name used for window matching
 * @param req.app      Resolved DiscoveredApp (required for open)
 */
export async function orchestrate(req) {
    console.log(`[JARVIS_EXEC] orchestrate action=${req.action} query="${req.query}"`);
    switch (req.action) {
        case 'open':
        case 'switch':
            return handleOpen(req);
        case 'close':
            return handleClose(req);
        case 'focus':
            return handleWindowOp(req, focusByHwnd);
        case 'minimize':
            return handleWindowOp(req, minimizeByHwnd);
        case 'maximize':
            return handleWindowOp(req, maximizeByHwnd);
        case 'restore':
            return handleWindowOp(req, restoreByHwnd);
        default:
            return { ok: false, message: `Unknown action: ${req.action}`, launched: false };
    }
}
// ─── Convenience named exports ────────────────────────────────────────────────
export async function launchApp(query, app) {
    return orchestrate({ action: 'open', query, app });
}
export async function closeApp(query, app) {
    return orchestrate({ action: 'close', query, app });
}
export async function focusApp(query, app) {
    return orchestrate({ action: 'focus', query, app });
}
export async function minimizeApp(query, app) {
    return orchestrate({ action: 'minimize', query, app });
}
export async function maximizeApp(query, app) {
    return orchestrate({ action: 'maximize', query, app });
}
export async function restoreApp(query, app) {
    return orchestrate({ action: 'restore', query, app });
}
