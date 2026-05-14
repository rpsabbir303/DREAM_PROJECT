import type { ExecutionResult, ParsedIntent } from '../../shared/interfaces/ipc.js'

/**
 * Maps common failure modes to a short, user-facing recovery line for the model and UI.
 */
export function recoveryHintForExecution(
  intent: ParsedIntent['intent'],
  result: Pick<ExecutionResult, 'message' | 'error' | 'ok'>,
): string | null {
  if (result.ok) return null

  const msg = result.message.toLowerCase()

  if (result.error === 'validation_failed') {
    if (msg.includes('path does not exist')) {
      return 'Ask the user for the full folder path or drag the folder into chat next time.'
    }
    if (msg.includes('http') || msg.includes('url')) {
      return 'Ask for a full https:// link or a well-known site name.'
    }
    if (msg.includes('dangerous') || msg.includes('whitelist')) {
      return 'Suggest a read-only or whitelisted command (e.g. git status, npm run build) or use open_folder instead.'
    }
    return 'Double-check spelling and permissions, then try a more specific target.'
  }

  if (intent === 'open_application') {
    if (msg.includes('not found') || msg.includes('could not')) {
      return 'Try the exact executable name, install the app, or open the folder containing the project instead.'
    }
  }

  if (intent === 'open_folder' || intent === 'open_project') {
    return 'Verify the path exists, or use an alias like Desktop/Documents if appropriate.'
  }

  if (intent === 'run_safe_command') {
    return 'Confirm the command is on the safe list; use the terminal manually for anything else.'
  }

  return 'Offer one alternative action the user can try safely.'
}
