import { safeLogger } from '../main/safeLogger.js'
import { createInMemoryMemoryRepository } from './memoryRepositoryInMemory.js'
import type { MemoryRepository } from './memoryRepositoryTypes.js'

export type { MemoryRepository } from './memoryRepositoryTypes.js'

/**
 * MVP: no SQLite / better-sqlite3 — all memory is in-process only.
 */
export function createMemoryRepository(): MemoryRepository {
  safeLogger.info('[JARVIS_DB] Using in-memory MemoryRepository (SQLite disabled)')
  return createInMemoryMemoryRepository()
}
