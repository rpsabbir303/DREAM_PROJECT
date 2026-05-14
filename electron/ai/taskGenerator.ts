import type { AssistantTask, CommandUnderstanding } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'

export function createTaskFromUnderstanding(
  understanding: CommandUnderstanding,
  memoryRepository: MemoryRepository,
): AssistantTask | null {
  if (!understanding.actionRequired) return null
  if (understanding.riskLevel === 'blocked') return null
  if (understanding.ambiguity === 'high') return null

  const title =
    understanding.target && understanding.target.length > 0
      ? `${understanding.intent}: ${understanding.target}`
      : understanding.intent

  return memoryRepository.addTask({
    title,
    intent: understanding.intent,
    target: understanding.target,
    status: 'pending',
  })
}
