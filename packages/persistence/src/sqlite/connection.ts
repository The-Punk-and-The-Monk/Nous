import { Database } from "bun:sqlite";

export function createDatabase(path = ":memory:"): Database {
	const db = new Database(path);

	// Enable WAL mode for better concurrent read performance
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA busy_timeout = 5000");
	db.exec("PRAGMA synchronous = NORMAL");
	db.exec("PRAGMA foreign_keys = ON");

	return db;
}

const MIGRATION_001 = `
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
  metadata TEXT NOT NULL DEFAULT '{}',
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

-- Dialogue threads
CREATE TABLE IF NOT EXISTS dialogue_threads (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dialogue_threads_updated ON dialogue_threads(updated_at DESC);

-- Dialogue messages
CREATE TABLE IF NOT EXISTS dialogue_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES dialogue_threads(id)
);
CREATE INDEX IF NOT EXISTS idx_dialogue_messages_thread ON dialogue_messages(thread_id, created_at);

-- Decision queue
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  questions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  response_mode TEXT NOT NULL DEFAULT 'free_text',
  options TEXT NOT NULL DEFAULT '[]',
  selected_option_id TEXT,
  outcome TEXT,
  related_intent_ids TEXT NOT NULL DEFAULT '[]',
  answer_text TEXT,
  answer_message_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  answered_at TEXT,
  resolved_at TEXT,
  FOREIGN KEY (intent_id) REFERENCES intents(id),
  FOREIGN KEY (thread_id) REFERENCES dialogue_threads(id)
);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_thread ON decisions(thread_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_intent ON decisions(intent_id, status, created_at);

-- Proactive / reflection runtime
CREATE TABLE IF NOT EXISTS reflection_agenda_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  driving_question TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT NOT NULL,
  due_at TEXT,
  cooldown_until TEXT,
  budget_class TEXT NOT NULL,
  source_signal_ids TEXT NOT NULL DEFAULT '[]',
  source_memory_ids TEXT NOT NULL DEFAULT '[]',
  source_intent_ids TEXT NOT NULL DEFAULT '[]',
  source_thread_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued',
  scope TEXT,
  created_at TEXT NOT NULL,
  leased_at TEXT,
  lease_owner TEXT,
  last_run_at TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_reflection_agenda_status_due ON reflection_agenda_items(status, due_at, created_at);
CREATE INDEX IF NOT EXISTS idx_reflection_agenda_dedupe ON reflection_agenda_items(dedupe_key, created_at DESC);

CREATE TABLE IF NOT EXISTS reflection_runs (
  id TEXT PRIMARY KEY,
  agenda_item_ids TEXT NOT NULL DEFAULT '[]',
  retrieved_memory_ids TEXT NOT NULL DEFAULT '[]',
  produced_candidate_ids TEXT NOT NULL DEFAULT '[]',
  model_class TEXT NOT NULL,
  max_tokens_budget INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_reflection_runs_started ON reflection_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reflection_runs_outcome ON reflection_runs(outcome, started_at DESC);

CREATE TABLE IF NOT EXISTS proactive_candidates (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  message_draft TEXT NOT NULL,
  rationale TEXT NOT NULL,
  proposed_intent_text TEXT,
  confidence REAL NOT NULL,
  value_score REAL NOT NULL,
  interruption_cost REAL NOT NULL,
  urgency TEXT NOT NULL,
  recommended_mode TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  cooldown_key TEXT,
  expires_at TEXT,
  source_signal_ids TEXT NOT NULL DEFAULT '[]',
  source_memory_ids TEXT NOT NULL DEFAULT '[]',
  source_intent_ids TEXT NOT NULL DEFAULT '[]',
  source_thread_ids TEXT NOT NULL DEFAULT '[]',
  source_agenda_item_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'candidate',
  scope TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_proactive_candidates_status_created ON proactive_candidates(status, created_at);
CREATE INDEX IF NOT EXISTS idx_proactive_candidates_cooldown ON proactive_candidates(cooldown_key, created_at DESC);

-- Persistent outbox
CREATE TABLE IF NOT EXISTS message_outbox (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  target_channel TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  failure_reason TEXT,
  FOREIGN KEY (thread_id) REFERENCES dialogue_threads(id),
  FOREIGN KEY (message_id) REFERENCES dialogue_messages(id)
);
CREATE INDEX IF NOT EXISTS idx_message_outbox_pending ON message_outbox(status, target_channel, created_at);
`;

export function runMigrations(db: Database): void {
	db.exec(MIGRATION_001);
	ensureColumn(
		db,
		"intents",
		"metadata",
		"ALTER TABLE intents ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'",
	);
	ensureColumn(
		db,
		"decisions",
		"response_mode",
		"ALTER TABLE decisions ADD COLUMN response_mode TEXT NOT NULL DEFAULT 'free_text'",
	);
	ensureColumn(
		db,
		"decisions",
		"options",
		"ALTER TABLE decisions ADD COLUMN options TEXT NOT NULL DEFAULT '[]'",
	);
	ensureColumn(
		db,
		"decisions",
		"selected_option_id",
		"ALTER TABLE decisions ADD COLUMN selected_option_id TEXT",
	);
	ensureColumn(
		db,
		"decisions",
		"outcome",
		"ALTER TABLE decisions ADD COLUMN outcome TEXT",
	);
	ensureColumn(
		db,
		"decisions",
		"related_intent_ids",
		"ALTER TABLE decisions ADD COLUMN related_intent_ids TEXT NOT NULL DEFAULT '[]'",
	);
}

export function initDatabase(path = ":memory:"): Database {
	const db = createDatabase(path);
	runMigrations(db);
	return db;
}

function ensureColumn(
	db: Database,
	tableName: string,
	columnName: string,
	alterSql: string,
): void {
	const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as {
		name: string;
	}[];
	if (columns.some((column) => column.name === columnName)) {
		return;
	}
	db.exec(alterSql);
}
