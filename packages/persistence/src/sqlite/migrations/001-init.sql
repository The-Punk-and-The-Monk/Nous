-- Nous Schema v1 — All tables for MVP

-- Events: append-only log (event sourcing)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  caused_by_event_id TEXT,
  agent_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id);

-- Intents
CREATE TABLE IF NOT EXISTS intents (
  id TEXT PRIMARY KEY,
  raw TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '{}',
  constraints TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 0,
  human_checkpoints TEXT NOT NULL DEFAULT 'always',
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'human',
  created_at TEXT NOT NULL,
  achieved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_intents_status ON intents(status);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL,
  parent_task_id TEXT,
  depends_on TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL,
  assigned_agent_id TEXT,
  capabilities_required TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'created',
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  backoff_seconds INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL,
  queued_at TEXT,
  started_at TEXT,
  last_heartbeat TEXT,
  completed_at TEXT,
  result TEXT,
  error TEXT,
  escalation_reason TEXT,
  FOREIGN KEY (intent_id) REFERENCES intents(id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_intent ON tasks(intent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);

-- Memory
CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  embedding BLOB,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  retention_score REAL NOT NULL DEFAULT 1.0,
  digested_from TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_agent_tier ON memory(agent_id, tier);

-- Memory FTS (full-text search)
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  id UNINDEXED,
  content,
  content=memory,
  content_rowid=rowid
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory BEGIN
  INSERT INTO memory_fts(rowid, id, content) VALUES (new.rowid, new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, id, content) VALUES ('delete', old.rowid, old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, id, content) VALUES ('delete', old.rowid, old.id, old.content);
  INSERT INTO memory_fts(rowid, id, content) VALUES (new.rowid, new.id, new.content);
END;

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT '{}',
  memory_id TEXT NOT NULL,
  current_task_id TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  personality TEXT NOT NULL DEFAULT '{}'
);
