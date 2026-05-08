/**
 * Placeholder queue abstraction for future workflow orchestration.
 * Keeps automation concerns isolated from IPC and AI parsing layers.
 */
export interface QueuedTask {
  id: string
  type: string
  payload: Record<string, unknown>
}

export class AutomationTaskQueue {
  private queue: QueuedTask[] = []

  enqueue(task: QueuedTask) {
    this.queue.push(task)
  }

  drain() {
    const tasks = [...this.queue]
    this.queue = []
    return tasks
  }
}
