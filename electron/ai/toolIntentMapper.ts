import type { ParsedIntent } from '../../shared/interfaces/ipc.js'

/**
 * Maps an OpenAI function name + JSON arguments string to a ParsedIntent for ExecutionManager.
 */
export function parsedIntentFromToolCall(functionName: string, argumentsJson: string): ParsedIntent | null {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(argumentsJson || '{}') as Record<string, unknown>
  } catch {
    return null
  }

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = args[key]
      if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    }
    return ''
  }

  const raw = `tool:${functionName}`
  const target = pick('target', 'url', 'path', 'command')

  switch (functionName) {
    case 'open_app':
      return { intent: 'open_application', target, confidence: 1, rawInput: raw, mvpKind: 'open_app' }
    case 'open_url':
      return { intent: 'open_url', target, confidence: 1, rawInput: raw, mvpKind: 'open_url' }
    case 'open_folder':
      return { intent: 'open_folder', target, confidence: 1, rawInput: raw, mvpKind: 'open_folder' }
    case 'run_terminal_command': {
      const command = pick('command')
      return { intent: 'run_safe_command', target: command, confidence: 1, rawInput: raw, mvpKind: 'run_command' }
    }
    default:
      return null
  }
}
