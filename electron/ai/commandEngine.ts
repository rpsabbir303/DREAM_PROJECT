import type { ExecuteIntentResult } from '../../shared/interfaces/ipc.js'
import type { CommandLogRecord } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { ExecutionManager } from '../system/executionManager.js'
import { parseIntent } from './intentParser.js'

/**
 * IPC-facing command engine: parse → validate inside ExecutionManager → act → typed result.
 */
export class CommandEngine {
  private readonly executionManager: ExecutionManager

  constructor(private readonly memoryRepository: MemoryRepository) {
    this.executionManager = new ExecutionManager(memoryRepository)
  }

  parse(userInput: string) {
    return parseIntent(userInput)
  }

  async handle(userInput: string): Promise<ExecuteIntentResult> {
    const parsed = parseIntent(userInput)

    try {
      const result = await this.executionManager.runIntent(parsed)
      const logStatus: CommandLogRecord['result'] = result.ok
        ? 'success'
        : result.error === 'validation_failed'
          ? 'warning'
          : 'error'
      const logId = this.memoryRepository.addCommandLog(userInput, logStatus)
      return { ok: result.ok, message: result.message, logId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error'
      const logId = this.memoryRepository.addCommandLog(userInput, 'error')
      return { ok: false, message, logId }
    }
  }
}
