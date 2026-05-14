import type { ExecutionResult, ParsedIntent, TaskStatus } from '../../shared/interfaces/ipc.js'
import { recoveryHintForExecution } from '../ai/executionRecovery.js'
import { validateIntent } from '../security/actionValidator.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { withExecutionTimeout } from './executionTimeout.js'
import { launchApplication } from './applicationLauncher.js'
import { ExecutionLogger } from './executionLogger.js'
import { openPathTarget, openUrlTarget } from './pathOpener.js'
import { executeSafeTerminalCommand } from './terminalExecutor.js'

export interface RunIntentOptions {
  taskId?: string
  onTaskStatus?: (status: TaskStatus) => void
}

const ACTION_DEADLINE_MS = Math.min(
  Math.max(10_000, Number(process.env.JARVIS_ACTION_TIMEOUT_MS ?? 45_000)),
  120_000,
)

/**
 * Dispatches structured intents to OS-level actions (apps, URLs, folders, safe terminal).
 */
export class ExecutionManager {
  private readonly logger: ExecutionLogger

  constructor(private readonly memoryRepository: MemoryRepository) {
    this.logger = new ExecutionLogger(memoryRepository)
  }

  async runIntent(intent: ParsedIntent, options: RunIntentOptions = {}): Promise<ExecutionResult> {
    const setStatus = (status: TaskStatus) => {
      if (options.taskId) this.memoryRepository.updateTaskStatus(options.taskId, status)
      options.onTaskStatus?.(status)
    }

    setStatus('validating')
    const validation = validateIntent(intent)
    if (!validation.ok) {
      const message = validation.reason ?? 'Validation failed'
      this.logger.log('warning', message)
      setStatus('failed')
      const failed: ExecutionResult = {
        ok: false,
        actionType: this.intentToActionType(intent.intent),
        message,
        error: 'validation_failed',
      }
      return {
        ...failed,
        recoveryHint: recoveryHintForExecution(intent.intent, failed),
      }
    }

    setStatus('running')
    let result: ExecutionResult
    try {
      switch (intent.intent) {
        case 'open_application':
          result = await withExecutionTimeout(
            launchApplication(intent.target),
            ACTION_DEADLINE_MS,
            'Launch application',
          )
          break
        case 'open_folder':
        case 'open_project':
          result = await withExecutionTimeout(
            openPathTarget(intent.target),
            ACTION_DEADLINE_MS,
            'Open folder',
          )
          break
        case 'open_url':
          result = await withExecutionTimeout(openUrlTarget(intent.target), ACTION_DEADLINE_MS, 'Open URL')
          break
        case 'run_safe_command':
          result = await withExecutionTimeout(
            executeSafeTerminalCommand(intent.target),
            ACTION_DEADLINE_MS,
            'Terminal command',
          )
          break
        default:
          result = {
            ok: false,
            actionType: 'run_terminal',
            message: 'Intent does not map to executable action.',
            error: 'not_executable',
          }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution error'
      result = {
        ok: false,
        actionType: this.intentToActionType(intent.intent),
        message,
        error: 'exception',
      }
    }

    this.logger.log(result.ok ? 'info' : 'error', result.message)
    setStatus(result.ok ? 'completed' : 'failed')
    if (!result.ok) {
      return { ...result, recoveryHint: recoveryHintForExecution(intent.intent, result) }
    }
    return result
  }

  private intentToActionType(intent: ParsedIntent['intent']): ExecutionResult['actionType'] {
    if (intent === 'open_application') return 'open_application'
    if (intent === 'open_url') return 'open_url'
    if (intent === 'open_folder' || intent === 'open_project') return 'open_path'
    return 'run_terminal'
  }
}
