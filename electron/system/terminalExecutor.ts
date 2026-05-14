import { spawn } from 'node:child_process'
import os from 'node:os'
import type { ExecutionResult } from '../../shared/interfaces/ipc.js'

interface RunOptions {
  timeoutMs?: number
  /** Max combined stdout/stderr characters stored on the result object. */
  maxOutputChars?: number
}

function createShellChild(command: string) {
  if (os.platform() === 'win32') {
    const comSpec = process.env.ComSpec ?? 'cmd.exe'
    return spawn(comSpec, ['/d', '/s', '/c', command], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  return spawn('/bin/sh', ['-c', command], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * Runs a **pre-validated** shell command with timeout and captured output (MVP safe terminal).
 */
export async function executeSafeTerminalCommand(
  command: string,
  options: RunOptions = {},
): Promise<ExecutionResult> {
  const timeoutMs = options.timeoutMs ?? 120_000
  const maxOutputChars = options.maxOutputChars ?? 16_000

  return new Promise((resolve) => {
    const processHandle = createShellChild(command)
    let output = ''
    let settled = false

    const finish = (result: ExecutionResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const timer = setTimeout(() => {
      try {
        processHandle.kill('SIGTERM')
      } catch {
        /* ignore */
      }
      finish({
        ok: false,
        actionType: 'run_terminal',
        message: `Command timed out after ${timeoutMs}ms: ${command}`,
        error: 'timeout',
        output: output.trim().slice(0, maxOutputChars),
      })
    }, timeoutMs)

    const append = (chunk: unknown) => {
      output += String(chunk)
      if (output.length > maxOutputChars) {
        output = `${output.slice(0, maxOutputChars)}\n… [output truncated]`
      }
    }

    processHandle.stdout?.on('data', append)
    processHandle.stderr?.on('data', append)
    processHandle.on('error', (error) => {
      clearTimeout(timer)
      finish({
        ok: false,
        actionType: 'run_terminal',
        message: `Failed to execute command: ${command}`,
        error: error.message,
        output: output.trim(),
      })
    })
    processHandle.on('close', (code) => {
      clearTimeout(timer)
      const trimmed = output.trim()
      finish({
        ok: code === 0,
        actionType: 'run_terminal',
        message:
          code === 0
            ? `Finished: ${command}`
            : `Command exited with code ${code ?? 'unknown'}: ${command}`,
        output: trimmed || undefined,
        error: code === 0 ? undefined : `exit_code_${code ?? 'unknown'}`,
      })
    })
  })
}
