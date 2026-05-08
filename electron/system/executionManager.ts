import type { ExecutionResult, ParsedIntent, TaskStatus } from '../../shared/interfaces/ipc.js'
import { validateIntent } from '../security/actionValidator.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { launchApplication } from './applicationLauncher.js'
import { ExecutionLogger } from './executionLogger.js'
import { openPathTarget, openUrlTarget } from './pathOpener.js'
import { executeSafeTerminalCommand } from './terminalExecutor.js'

interface RunIntentOptions {
  taskId?: string
  onTaskStatus?: (status: TaskStatus) => void
}

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
      return {
        ok: false,
        actionType: this.intentToActionType(intent.intent),
        message,
        error: 'validation_failed',
      }
    }

    setStatus('running')
    let result: ExecutionResult
    switch (intent.intent) {
      case 'open_application':
        result = await launchApplication(intent.target)
        break
      case 'open_folder':
      case 'open_project':
        result = await openPathTarget(intent.target)
        break
      case 'open_url':
        result = await openUrlTarget(intent.target)
        break
      case 'run_safe_command':
        result = await executeSafeTerminalCommand(intent.target)
        break
      default:
        result = {
          ok: false,
          actionType: 'run_terminal',
          message: 'Intent does not map to executable action.',
          error: 'not_executable',
        }
    }

    this.logger.log(result.ok ? 'info' : 'error', result.message)
    this.memoryRepository.addLearningFeedback({
      type: result.ok ? 'execution_success' : 'execution_failure',
      source: 'system',
      action: intent.intent,
      outcome: result.ok ? 'success' : 'failure',
      score: result.ok ? 1 : 0,
      metadata: { actionType: result.actionType },
      createdAt: new Date().toISOString(),
    })
    setStatus(result.ok ? 'completed' : 'failed')
    return result
  }

  private intentToActionType(intent: ParsedIntent['intent']): ExecutionResult['actionType'] {
    if (intent === 'open_application') return 'open_application'
    if (intent === 'open_url') return 'open_url'
    if (intent === 'open_folder' || intent === 'open_project') return 'open_path'
    return 'run_terminal'
  }
}
