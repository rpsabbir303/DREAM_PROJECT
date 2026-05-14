import { spawn } from 'node:child_process'
import os from 'node:os'
import type { ExecutionResult } from '../../shared/interfaces/ipc.js'
import { resolveApplicationCommand } from './applicationRegistry.js'

/**
 * Launches a desktop application using the resolved registry entry (shell / open -a / PATH).
 */
export async function launchApplication(target: string): Promise<ExecutionResult> {
  const command = resolveApplicationCommand(target)
  if (!command) {
    return {
      ok: false,
      actionType: 'open_application',
      message: `Application "${target}" is not in the registry or unsupported on this OS.`,
      error: 'application_not_registered',
    }
  }

  try {
    const isDarwinOpen = command.startsWith('open -a ')
    const child = spawn(command, {
      shell: true,
      detached: true,
      stdio: 'ignore',
      windowsHide: os.platform() === 'win32',
    })
    child.on('error', () => {
      /* detached fire-and-forget; errors surface rarely */
    })
    child.unref()

    return {
      ok: true,
      actionType: 'open_application',
      message: isDarwinOpen
        ? `Launched application (macOS open): ${target}`
        : `Launched application: ${target}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Launch failed'
    return {
      ok: false,
      actionType: 'open_application',
      message: `Failed to launch "${target}": ${message}`,
      error: 'spawn_failed',
    }
  }
}
