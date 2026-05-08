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

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      intent TEXT NOT NULL,
      target TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS command_memory (
      command TEXT PRIMARY KEY,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      startup_commands_json TEXT NOT NULL,
      applications_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personalization_suggestions (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      confidence REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_schedules (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      time_of_day TEXT,
      day_of_week INTEGER,
      run_at TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS screen_captures (
      id TEXT PRIMARY KEY,
      image_base64 TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS screen_analyses (
      id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      ocr_text TEXT NOT NULL,
      confidence REAL NOT NULL,
      active_window_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_plans (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      state TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      state TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_provider_logs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      input_chars INTEGER NOT NULL,
      output_chars INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_embeddings (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      vector_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_context_logs (
      id TEXT PRIMARY KEY,
      app TEXT NOT NULL,
      title TEXT NOT NULL,
      process_name TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
      id TEXT PRIMARY KEY,
      from_node_id TEXT NOT NULL,
      to_node_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS observability_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proactive_notifications (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      event_id TEXT,
      action_label TEXT,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_feedback (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      score REAL NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS behavior_patterns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence REAL NOT NULL,
      frequency INTEGER NOT NULL,
      last_seen_at TEXT NOT NULL,
      related_actions_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS adaptive_recommendations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence REAL NOT NULL,
      impact_score REAL NOT NULL,
      source_pattern_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_optimization_insights (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      workflow_name TEXT NOT NULL,
      issue TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      confidence REAL NOT NULL,
      estimated_impact REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
    return db;
}
