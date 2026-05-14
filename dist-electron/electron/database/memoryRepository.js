import { createInMemoryMemoryRepository } from './memoryRepositoryInMemory.js';
/**
 * MVP: no SQLite / better-sqlite3 — all memory is in-process only.
 */
export function createMemoryRepository() {
    console.info('[JARVIS_DB] Using in-memory MemoryRepository (SQLite disabled)');
    return createInMemoryMemoryRepository();
}
