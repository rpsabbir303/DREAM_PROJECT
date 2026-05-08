import { shell } from 'electron'
import { spawn } from 'node:child_process'
import type { ParsedIntent } from '../../shared/interfaces/ipc.js'
import { isSafeTerminalCommand, resolveWhitelistedApp } from '../security/executionPolicy.js'

function normalize(input: string) {
  return input.trim().toLowerCase()
}

export async function executeIntent(intent: ParsedIntent): Promise<string> {
  switch (intent.intent) {
    case 'open_url': {
      const url = intent.target
      if (!/^https?:\/\//i.test(url)) {
        throw new Error('Blocked: only http/https URLs are allowed.')
      }
      await shell.openExternal(url)
      return `Opened URL: ${url}`
    }
    case 'open_folder': {
      const result = await shell.openPath(intent.target)
      if (result) throw new Error(result)
      return `Opened folder: ${intent.target}`
    }
    case 'open_project': {
      const result = await shell.openPath(intent.target)
      if (result) throw new Error(result)
      return `Opened project path: ${intent.target}`
    }
    case 'open_application': {
      const appCommand = resolveWhitelistedApp(intent.target)
      if (!appCommand) {
        throw new Error('Application is not in the safe whitelist.')
      }
      spawn(appCommand, [], { detached: true, stdio: 'ignore', shell: true }).unref()
      return `Launched application: ${intent.target}`
    }
    case 'run_safe_command': {
      const command = normalize(intent.target)
      if (!isSafeTerminalCommand(command)) {
        throw new Error('Command blocked by safe mode policy.')
      }
      spawn(command, [], { detached: true, stdio: 'ignore', shell: true }).unref()
      return `Executed command: ${intent.target}`
    }
    case 'system_monitoring':
    case 'chat_general':
      throw new Error('No system action required for this intent.')
    default:
      throw new Error('Could not map instruction to a safe system action.')
  }
}
