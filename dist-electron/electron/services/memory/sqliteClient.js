import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
let db = null;
function getDatabasePath() {
    const basePath = app.getPath('userData');
    return path.join(basePath, 'jarvis-memory.db');
}
export function getDb() {
    if (db)
        return db;
    db = new Database(getDatabasePath());
    db.exec(`
    CREATE TABLE IF NOT EXISTS command_logs (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
    return db;
}
