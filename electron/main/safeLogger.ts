/**
 * safeLogger — MUST load before any other Electron main-process module.
 * File-only logging. Never writes to stdout/stderr.
 * Patches broken-pipe streams so native console cannot crash the process.
 */

import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const LOG_FILE = join(tmpdir(), 'jarvis-debug.log')

const SEP = '='.repeat(60)
const BOOT = `\n${SEP}\nJARVIS boot ${new Date().toISOString()}\nPID=${process.pid}\n${SEP}\n`

try { appendFileSync(LOG_FILE, BOOT) } catch { /* ignore */ }

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v) ?? String(v) }
  catch { return String(v) }
}

function formatArgs(args: unknown[]): string {
  return args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ')
}

function write(level: string, args: unknown[]): void {
  try {
    const line = `${new Date().toISOString()} [${level}] ${formatArgs(args)}\n`
    appendFileSync(LOG_FILE, line)
  } catch { /* never throw */ }
}

function info (...args: unknown[]): void { write('INFO', args) }
function warn (...args: unknown[]): void { write('WARN', args) }
function error (...args: unknown[]): void { write('ERROR', args) }
function debug (...args: unknown[]): void { write('DEBUG', args) }
function log (...args: unknown[]): void { write('LOG', args) }

/** Primary logging API — use this instead of console.* */
export const safeLogger = { log, info, warn, error, debug }

// Legacy named exports (index.ts and others)
export const safeLog = log
export const safeInfo = info
export const safeWarn = warn
export const safeError = error
export const safeDebug = debug

// ─── Replace global.console with FILE-ONLY (never writes to stdout/stderr) ───
// consoleGuard runs first; this fully overrides so discovery/IPC cannot EPIPE.

const noopTable = () => undefined
const c = global.console as unknown as Record<string, unknown>

c['log']   = (...a: unknown[]) => log(...a)
c['info']  = (...a: unknown[]) => info(...a)
c['warn']  = (...a: unknown[]) => warn(...a)
c['error'] = (...a: unknown[]) => error(...a)
c['debug'] = (...a: unknown[]) => debug(...a)
c['trace'] = (...a: unknown[]) => debug(...a)
c['dir']   = (...a: unknown[]) => log(...a)
c['table'] = noopTable

info(`[safeLogger] active — file only: ${LOG_FILE}`)
