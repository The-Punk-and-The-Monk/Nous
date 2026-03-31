// Interfaces
export type { EventStore, EventQuery } from "./interfaces/event-store.ts";
export type { TaskStore } from "./interfaces/task-store.ts";
export type { MemoryStore, MemoryQuery } from "./interfaces/memory-store.ts";
export type { IntentStore } from "./interfaces/intent-store.ts";
export type { MessageStore } from "./interfaces/message-store.ts";
export type { DecisionStore } from "./interfaces/decision-store.ts";
export type {
	ProactiveStore,
	ReflectionAgendaQuery,
	ProactiveCandidateQuery,
	ReflectionRunQuery,
} from "./interfaces/proactive-store.ts";

// SQLite implementations
export { SQLiteEventStore } from "./sqlite/event-store.sqlite.ts";
export { SQLiteTaskStore } from "./sqlite/task-store.sqlite.ts";
export { SQLiteMemoryStore } from "./sqlite/memory-store.sqlite.ts";
export { SQLiteIntentStore } from "./sqlite/intent-store.sqlite.ts";
export { SQLiteMessageStore } from "./sqlite/message-store.sqlite.ts";
export { SQLiteDecisionStore } from "./sqlite/decision-store.sqlite.ts";
export { SQLiteProactiveStore } from "./sqlite/proactive-store.sqlite.ts";

// Connection utilities
export {
	createDatabase,
	runMigrations,
	initDatabase,
} from "./sqlite/connection.ts";

// Backend composition
export { createPersistenceBackend } from "./backend.ts";
export type { PersistenceBackend } from "./backend.ts";
