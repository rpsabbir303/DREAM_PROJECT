/**
 * GLOBAL console / stdout protection — MUST be the first import in bootstrap.ts
 * NEVER calls native console — all output goes to file via safeLogger (loaded next).
 */

// STEP 1 — swallow broken pipe errors on streams
process.stdout?.on?.('error', () => { /* broken pipe */ })
process.stderr?.on?.('error', () => { /* broken pipe */ })

// STEP 2 — never crash the process on EPIPE
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err?.code === 'EPIPE' || err?.code === 'ERR_STREAM_DESTROYED') return
})

process.on('unhandledRejection', (reason: unknown) => {
  const e = reason as NodeJS.ErrnoException
  if (e?.code === 'EPIPE' || e?.code === 'ERR_STREAM_DESTROYED') return
})

// STEP 3 — replace console methods with no-ops (safeLogger overwrites with file logging next)
// Do NOT call the original console — a broken pipe can exist even when !destroyed.
const noop = () => { /* silent */ }
const c = global.console as unknown as Record<string, unknown>
for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table']) {
  c[method] = noop
}
