/**
 * SQLite is disabled for the MVP: `better-sqlite3` is not bundled so Electron can start without native bindings.
 * Persistence uses {@link createInMemoryMemoryRepository} instead.
 */
let logged = false;
export function getDb() {
    if (!logged) {
        console.info('[JARVIS_DB] SQLite disabled for MVP mode — no better-sqlite3, in-memory store only');
        logged = true;
    }
    return null;
}
