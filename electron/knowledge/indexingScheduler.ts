import type { MemoryRepository } from '../database/memoryRepository.js'
import { runKnowledgeIndexing } from './indexingEngine.js'

export class KnowledgeIndexingScheduler {
  private timer: NodeJS.Timeout | null = null
  private inFlight = false

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly rootPath: string,
  ) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.reindex()
    }, 1000 * 60 * 8)
    void this.reindex()
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  async reindex() {
    if (this.inFlight) return { ok: true as const, indexed: 0 }
    this.inFlight = true
    try {
      return await runKnowledgeIndexing(this.memoryRepository, this.rootPath)
    } finally {
      this.inFlight = false
    }
  }
}
