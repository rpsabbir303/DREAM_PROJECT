import type { ExecuteIntentResult } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { ExecutionManager } from '../system/executionManager.js'
import { parseIntent } from './intentParser.js'

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
      const logId = this.memoryRepository.addCommandLog(userInput, 'success')
      return { ok: result.ok, message: result.message, logId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error'
      const logId = this.memoryRepository.addCommandLog(userInput, 'error')
      return { ok: false, message, logId }
    }
  }
}
