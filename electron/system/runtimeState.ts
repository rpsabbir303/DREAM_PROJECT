/**
 * Runtime State — Phase 6
 *
 * Central in-memory registry for all live desktop state.
 * All agents read from here; windowState.ts writes to here.
 *
 * Design: plain mutable singleton — no persistence, reset on restart.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WindowSnapshot {
  /** Human-readable title from the OS window bar */
  title: string
  /** Raw image name from the process list, e.g. "chrome.exe" */
  processName: string
  /** Display-friendly app name resolved from processName */
  appName: string
  /** Numeric process ID */
  pid: number
  /** "normal" | "minimized" | "maximized" */
  windowState: 'normal' | 'minimized' | 'maximized'
  /** Millisecond timestamp when this snapshot was captured */
  capturedAt: number
}

export interface RunningApp {
  processName: string
  appName: string
  pid: number
  windows: string[]
}

export interface SessionContext {
  /** The most recently focused window */
  activeWindow: WindowSnapshot | null
  /** Window that was focused just before the current one */
  previousWindow: WindowSnapshot | null
  /** Last app the user explicitly opened via Jarvis */
  lastOpenedApp: string | null
  /** Last app the user explicitly closed via Jarvis */
  lastClosedApp: string | null
  /** Rolling list of the last 20 raw command strings */
  recentCommands: string[]
  /** A short label for the current inferred task (optional, AI-set) */
  currentTask: string | null
  /** When this session started */
  sessionStart: Date
}

// ─── State ────────────────────────────────────────────────────────────────────

export const runtimeState: {
  session: SessionContext
  runningApps: RunningApp[]
  /** Latest snapshot of the foreground window */
  activeWindow: WindowSnapshot | null
} = {
  session: {
    activeWindow:    null,
    previousWindow:  null,
    lastOpenedApp:   null,
    lastClosedApp:   null,
    recentCommands:  [],
    currentTask:     null,
    sessionStart:    new Date(),
  },
  runningApps:  [],
  activeWindow: null,
}

// ─── Mutators ─────────────────────────────────────────────────────────────────

/** Called by windowState.ts whenever the foreground window changes. */
export function setActiveWindow(snap: WindowSnapshot): void {
  if (
    runtimeState.activeWindow &&
    runtimeState.activeWindow.pid !== snap.pid
  ) {
    runtimeState.session.previousWindow = runtimeState.activeWindow
  }
  runtimeState.activeWindow = snap
  runtimeState.session.activeWindow = snap
}

/** Replace the full running-apps cache (called every N seconds). */
export function setRunningApps(apps: RunningApp[]): void {
  runtimeState.runningApps = apps
}

/** Append a raw user command string to the rolling history. */
export function pushCommand(raw: string): void {
  runtimeState.session.recentCommands.push(raw)
  if (runtimeState.session.recentCommands.length > 20) {
    runtimeState.session.recentCommands.shift()
  }
}

/** Record that Jarvis just opened an app. */
export function recordOpened(appName: string): void {
  runtimeState.session.lastOpenedApp = appName
}

/** Record that Jarvis just closed an app. */
export function recordClosed(appName: string): void {
  runtimeState.session.lastClosedApp = appName
}

// ─── Readers ──────────────────────────────────────────────────────────────────

/** Returns the friendly name of the currently focused app. */
export function getActiveAppName(): string | null {
  return runtimeState.activeWindow?.appName ?? null
}

/** Returns the process name of the active window (e.g. "chrome.exe"). */
export function getActiveProcessName(): string | null {
  return runtimeState.activeWindow?.processName ?? null
}

/** Returns the app the user was in just before the current one. */
export function getPreviousAppName(): string | null {
  return runtimeState.session.previousWindow?.appName ?? null
}

/** Returns the last app name the user opened via Jarvis. */
export function getLastOpenedApp(): string | null {
  return runtimeState.session.lastOpenedApp
}

/** Returns a snapshot of the session context for injection into prompts. */
export function getSessionContext(): SessionContext {
  return { ...runtimeState.session }
}

/**
 * Derive a friendly "subject" for contextual pronoun resolution.
 * Priority: activeWindow → lastOpenedApp → previousWindow → null
 */
export function resolveContextualTarget(): string | null {
  return (
    runtimeState.activeWindow?.appName ??
    runtimeState.session.lastOpenedApp ??
    runtimeState.session.previousWindow?.appName ??
    null
  )
}
