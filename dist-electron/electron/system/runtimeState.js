/**
 * Runtime State — Phase 6
 *
 * Central in-memory registry for all live desktop state.
 * All agents read from here; windowState.ts writes to here.
 *
 * Design: plain mutable singleton — no persistence, reset on restart.
 */
// ─── State ────────────────────────────────────────────────────────────────────
export const runtimeState = {
    session: {
        activeWindow: null,
        previousWindow: null,
        lastOpenedApp: null,
        lastClosedApp: null,
        recentCommands: [],
        currentTask: null,
        sessionStart: new Date(),
    },
    runningApps: [],
    activeWindow: null,
};
// ─── Mutators ─────────────────────────────────────────────────────────────────
/** Called by windowState.ts whenever the foreground window changes. */
export function setActiveWindow(snap) {
    if (runtimeState.activeWindow &&
        runtimeState.activeWindow.pid !== snap.pid) {
        runtimeState.session.previousWindow = runtimeState.activeWindow;
    }
    runtimeState.activeWindow = snap;
    runtimeState.session.activeWindow = snap;
}
/** Replace the full running-apps cache (called every N seconds). */
export function setRunningApps(apps) {
    runtimeState.runningApps = apps;
}
/** Append a raw user command string to the rolling history. */
export function pushCommand(raw) {
    runtimeState.session.recentCommands.push(raw);
    if (runtimeState.session.recentCommands.length > 20) {
        runtimeState.session.recentCommands.shift();
    }
}
/** Record that Jarvis just opened an app. */
export function recordOpened(appName) {
    runtimeState.session.lastOpenedApp = appName;
}
/** Record that Jarvis just closed an app. */
export function recordClosed(appName) {
    runtimeState.session.lastClosedApp = appName;
}
// ─── Readers ──────────────────────────────────────────────────────────────────
/** Returns the friendly name of the currently focused app. */
export function getActiveAppName() {
    return runtimeState.activeWindow?.appName ?? null;
}
/** Returns the process name of the active window (e.g. "chrome.exe"). */
export function getActiveProcessName() {
    return runtimeState.activeWindow?.processName ?? null;
}
/** Returns the app the user was in just before the current one. */
export function getPreviousAppName() {
    return runtimeState.session.previousWindow?.appName ?? null;
}
/** Returns the last app name the user opened via Jarvis. */
export function getLastOpenedApp() {
    return runtimeState.session.lastOpenedApp;
}
/** Returns a snapshot of the session context for injection into prompts. */
export function getSessionContext() {
    return { ...runtimeState.session };
}
/**
 * Derive a friendly "subject" for contextual pronoun resolution.
 * Priority: activeWindow → lastOpenedApp → previousWindow → null
 */
export function resolveContextualTarget() {
    return (runtimeState.activeWindow?.appName ??
        runtimeState.session.lastOpenedApp ??
        runtimeState.session.previousWindow?.appName ??
        null);
}
