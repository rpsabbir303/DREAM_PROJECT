import { randomUUID } from 'node:crypto';
import { getDb } from './sqliteClient.js';
export function createMemoryRepository() {
    const db = getDb();
    const insert = db.prepare('INSERT INTO command_logs (id, command, result, created_at) VALUES (?, ?, ?, ?)');
    const getRecent = db.prepare('SELECT id, command, result, created_at as createdAt FROM command_logs ORDER BY created_at DESC LIMIT ?');
    return {
        addCommandLog(command, result) {
            const id = randomUUID();
            insert.run(id, command, result, new Date().toISOString());
            return id;
        },
        getRecentCommands(limit = 20) {
            return getRecent.all(limit);
        },
    };
}
