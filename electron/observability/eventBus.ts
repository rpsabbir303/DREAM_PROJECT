import type { ObservabilityEvent } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'

type EventListener = (event: ObservabilityEvent) => Promise<void> | void

export class EventBus {
  private listeners: EventListener[] = []

  constructor(private readonly memoryRepository: MemoryRepository) {}

  subscribe(listener: EventListener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  async publish(event: Omit<ObservabilityEvent, 'id'>) {
    const created = this.memoryRepository.addObservabilityEvent(event)
    for (const listener of this.listeners) {
      await listener(created)
    }
    return created
  }
}
