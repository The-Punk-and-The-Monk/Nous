import type { Database } from "bun:sqlite";
import type { DecisionStore } from "./interfaces/decision-store.ts";
import type { EventStore } from "./interfaces/event-store.ts";
import type { IntentStore } from "./interfaces/intent-store.ts";
import type { MemoryStore } from "./interfaces/memory-store.ts";
import type { MessageStore } from "./interfaces/message-store.ts";
import type { ProactiveStore } from "./interfaces/proactive-store.ts";
import type { TaskStore } from "./interfaces/task-store.ts";
import { initDatabase } from "./sqlite/connection.ts";
import { SQLiteDecisionStore } from "./sqlite/decision-store.sqlite.ts";
import { SQLiteEventStore } from "./sqlite/event-store.sqlite.ts";
import { SQLiteIntentStore } from "./sqlite/intent-store.sqlite.ts";
import { SQLiteMemoryStore } from "./sqlite/memory-store.sqlite.ts";
import { SQLiteMessageStore } from "./sqlite/message-store.sqlite.ts";
import { SQLiteProactiveStore } from "./sqlite/proactive-store.sqlite.ts";
import { SQLiteTaskStore } from "./sqlite/task-store.sqlite.ts";

export interface PersistenceBackend {
	events: EventStore;
	tasks: TaskStore;
	memory: MemoryStore;
	intents: IntentStore;
	messages: MessageStore;
	decisions: DecisionStore;
	proactive: ProactiveStore;
	close(): void;
}

export function createPersistenceBackend(
	dbPath = ":memory:",
): PersistenceBackend {
	const db = initDatabase(dbPath);
	return new SQLitePersistenceBackend(db);
}

class SQLitePersistenceBackend implements PersistenceBackend {
	readonly events: EventStore;
	readonly tasks: TaskStore;
	readonly memory: MemoryStore;
	readonly intents: IntentStore;
	readonly messages: MessageStore;
	readonly decisions: DecisionStore;
	readonly proactive: ProactiveStore;

	constructor(private db: Database) {
		this.events = new SQLiteEventStore(db);
		this.tasks = new SQLiteTaskStore(db);
		this.memory = new SQLiteMemoryStore(db);
		this.intents = new SQLiteIntentStore(db);
		this.messages = new SQLiteMessageStore(db);
		this.decisions = new SQLiteDecisionStore(db);
		this.proactive = new SQLiteProactiveStore(db);
	}

	close(): void {
		this.db.close();
	}
}
