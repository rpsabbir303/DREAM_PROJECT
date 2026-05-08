import type { ActivityLogLevel } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'

export class ExecutionLogger {
  constructor(private readonly memoryRepository: MemoryRepository) {}

  log(level: ActivityLogLevel, message: string) {
    this.memoryRepository.addActivityLog(level, message)
  }
}
