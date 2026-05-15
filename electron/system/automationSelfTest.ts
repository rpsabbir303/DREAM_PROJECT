/**
 * Automation Self-Test
 *
 * Runs a sequence of real desktop automation steps against Notepad
 * and returns a detailed report showing exactly which steps pass/fail
 * and why.
 *
 * Run via IPC: invoke('automation:selfTest')
 */

import { safeLogger } from '../main/safeLogger.js'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface SelfTestStep {
  name:    string
  ok:      boolean
  message: string
  ms:      number
}

export interface SelfTestReport {
  passed:     number
  failed:     number
  totalMs:    number
  steps:      SelfTestStep[]
  summary:    string
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function isNotepadRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `cmd /c tasklist /FI "IMAGENAME eq notepad.exe" /NH`,
      { windowsHide: true, timeout: 5_000 },
    )
    return stdout.toLowerCase().includes('notepad.exe')
  } catch {
    return false
  }
}

async function step(name: string, fn: () => Promise<{ ok: boolean; message: string }>): Promise<SelfTestStep> {
  const t0 = Date.now()
  try {
    const result = await fn()
    return { name, ok: result.ok, message: result.message, ms: Date.now() - t0 }
  } catch (e) {
    return {
      name,
      ok:      false,
      message: `Threw: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
      ms:      Date.now() - t0,
    }
  }
}

export async function runAutomationSelfTest(): Promise<SelfTestReport> {
  const start = Date.now()
  const steps: SelfTestStep[] = []

  // ── STEP 1: Open Notepad ────────────────────────────────────────────────────
  steps.push(await step('Open Notepad', async () => {
    const { executeIntent } = await import('../plugins/pluginRegistry.js')
    const { routeIntent } = await import('../ai/nlpRouter.js')
    const intent = routeIntent('open notepad')
    if (!intent) return { ok: false, message: 'NLP router returned null intent for "open notepad"' }
    if (intent.type !== 'app.open') return { ok: false, message: `Wrong intent type: ${intent.type}` }
    const result = await executeIntent(intent)
    return result
  }))

  // Give Notepad time to open
  await sleep(2_000)

  // ── STEP 2: Verify Notepad is running ───────────────────────────────────────
  steps.push(await step('Verify Notepad running', async () => {
    const running = await isNotepadRunning()
    return {
      ok:      running,
      message: running ? 'notepad.exe found in tasklist' : 'notepad.exe NOT found in tasklist after open',
    }
  }))

  // ── STEP 3: Focus Notepad ───────────────────────────────────────────────────
  steps.push(await step('Focus Notepad', async () => {
    const { executeIntent } = await import('../plugins/pluginRegistry.js')
    const { routeIntent } = await import('../ai/nlpRouter.js')
    const intent = routeIntent('focus notepad')
    if (!intent) return { ok: false, message: 'NLP router returned null for "focus notepad"' }
    return executeIntent(intent)
  }))

  await sleep(500)

  // ── STEP 4: Type text into Notepad ─────────────────────────────────────────
  steps.push(await step('Type text in Notepad', async () => {
    const { typeText } = await import('./keyboardController.js')
    // Set previousWindow to Notepad's pid so keyboardController targets it
    const { runtimeState } = await import('./runtimeState.js')
    // Get notepad pid
    try {
      const { stdout } = await execAsync(
        `cmd /c tasklist /FI "IMAGENAME eq notepad.exe" /FO CSV /NH`,
        { windowsHide: true, timeout: 5_000 },
      )
      const parts = stdout.trim().replace(/"/g, '').split(',')
      const pid = parseInt(parts[1] ?? '', 10)
      if (pid) {
        runtimeState.session.previousWindow = {
          title:       'Notepad',
          processName: 'notepad.exe',
          appName:     'Notepad',
          pid,
          windowState: 'normal',
          capturedAt:  Date.now(),
        }
        safeLogger.info(`[JARVIS_TEST] set previousWindow to Notepad pid=${pid}`)
      }
    } catch { /* ok */ }

    return typeText('JARVIS automation test')
  }))

  await sleep(800)

  // ── STEP 5: Minimize Notepad ────────────────────────────────────────────────
  steps.push(await step('Minimize Notepad', async () => {
    const { executeIntent } = await import('../plugins/pluginRegistry.js')
    const { routeIntent } = await import('../ai/nlpRouter.js')
    const intent = routeIntent('minimize notepad')
    if (!intent) return { ok: false, message: 'NLP router returned null for "minimize notepad"' }
    return executeIntent(intent)
  }))

  await sleep(800)

  // ── STEP 6: Restore Notepad ─────────────────────────────────────────────────
  steps.push(await step('Restore Notepad', async () => {
    const { executeIntent } = await import('../plugins/pluginRegistry.js')
    const { routeIntent } = await import('../ai/nlpRouter.js')
    const intent = routeIntent('restore notepad')
    if (!intent) return { ok: false, message: 'NLP router returned null for "restore notepad"' }
    return executeIntent(intent)
  }))

  await sleep(800)

  // ── STEP 7: Close Notepad ───────────────────────────────────────────────────
  steps.push(await step('Close Notepad', async () => {
    const { reliableClose } = await import('./processController.js')
    const result = await reliableClose('notepad', ['notepad.exe'], 'Notepad')
    return result
  }))

  await sleep(1_000)

  // ── STEP 8: Verify Notepad is closed ───────────────────────────────────────
  steps.push(await step('Verify Notepad closed', async () => {
    const running = await isNotepadRunning()
    return {
      ok:      !running,
      message: running
        ? 'notepad.exe still in tasklist after close — close FAILED'
        : 'notepad.exe NOT in tasklist — close SUCCEEDED',
    }
  }))

  const passed = steps.filter((s) => s.ok).length
  const failed = steps.filter((s) => !s.ok).length
  const totalMs = Date.now() - start

  const stepLines = steps.map((s) => `  ${s.ok ? '✓' : '✗'} [${s.ms}ms] ${s.name}: ${s.message}`)
  const summary = [
    `Automation Self-Test: ${passed}/${steps.length} passed in ${totalMs}ms`,
    ...stepLines,
  ].join('\n')

  safeLogger.info(`[JARVIS_TEST]\n${summary}`)

  return { passed, failed, totalMs, steps, summary }
}
