import type { ObservabilityEvent } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'

export class ProactiveAwarenessEngine {
  constructor(private readonly memoryRepository: MemoryRepository) {}

  async handleEvent(event: ObservabilityEvent) {
    if (event.type === 'workflow_failed') {
      this.memoryRepository.addProactiveNotification({
        level: 'critical',
        title: 'Workflow Failure Detected',
        message: 'A scheduled workflow failed. Review automation logs and retry.',
        eventId: event.id,
        actionLabel: 'Open Automation',
        createdAt: new Date().toISOString(),
      })
      return
    }
    if (event.type === 'terminal_error' || event.type === 'ai_task_failed') {
      this.memoryRepository.addProactiveNotification({
        level: 'warning',
        title: 'Execution Issue Detected',
        message: event.message,
        eventId: event.id,
        actionLabel: 'Inspect Logs',
        createdAt: new Date().toISOString(),
      })
      return
    }
    if (event.type === 'system_resource_alert') {
      this.memoryRepository.addProactiveNotification({
        level: 'warning',
        title: 'System Resource Alert',
        message: event.message,
        eventId: event.id,
        actionLabel: 'Open Dashboard',
        createdAt: new Date().toISOString(),
      })
      return
    }
    if (event.type === 'workflow_completed' || event.type === 'knowledge_indexed') {
      this.memoryRepository.addProactiveNotification({
        level: 'info',
        title: event.title,
        message: event.message,
        eventId: event.id,
        actionLabel: null,
        createdAt: new Date().toISOString(),
      })
    }
  }
}
