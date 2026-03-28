import { beforeEach, describe, expect, test } from "bun:test";
import type { MemoryEntry } from "@nous/core";
import { initDatabase } from "../src/sqlite/connection.ts";
import { SQLiteMemoryStore } from "../src/sqlite/memory-store.sqlite.ts";

let store: SQLiteMemoryStore;

beforeEach(() => {
	const db = initDatabase();
	store = new SQLiteMemoryStore(db);
});

function makeMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
	return {
		id: `mem_${Math.random().toString(36).slice(2)}`,
		tier: "semantic",
		agentId: "agent_1",
		content: "The sky is blue",
		metadata: {},
		createdAt: new Date().toISOString(),
		lastAccessedAt: new Date().toISOString(),
		accessCount: 0,
		retentionScore: 1.0,
		...overrides,
	};
}

describe("SQLiteMemoryStore", () => {
	test("store and getById", () => {
		const mem = makeMemory({
			id: "mem_001",
			content: "Bun uses JavaScriptCore",
		});
		store.store(mem);
		const retrieved = store.getById("mem_001");
		expect(retrieved).toBeDefined();
		expect(retrieved?.content).toBe("Bun uses JavaScriptCore");
		expect(retrieved?.tier).toBe("semantic");
	});

	test("getById returns undefined for missing", () => {
		expect(store.getById("nonexistent")).toBeUndefined();
	});

	test("update changes fields", () => {
		const mem = makeMemory({ id: "mem_002" });
		store.store(mem);
		store.update("mem_002", {
			accessCount: 5,
			retentionScore: 0.8,
			lastAccessedAt: new Date().toISOString(),
		});
		const updated = store.getById("mem_002");
		expect(updated?.accessCount).toBe(5);
		expect(updated?.retentionScore).toBe(0.8);
	});

	test("delete removes entry", () => {
		const mem = makeMemory({ id: "mem_003" });
		store.store(mem);
		store.delete("mem_003");
		expect(store.getById("mem_003")).toBeUndefined();
	});

	test("query by agentId and tier", () => {
		store.store(makeMemory({ id: "m1", agentId: "a1", tier: "semantic" }));
		store.store(makeMemory({ id: "m2", agentId: "a1", tier: "episodic" }));
		store.store(makeMemory({ id: "m3", agentId: "a2", tier: "semantic" }));

		expect(store.query({ agentId: "a1" })).toHaveLength(2);
		expect(store.query({ agentId: "a1", tier: "semantic" })).toHaveLength(1);
		expect(store.query({ tier: "semantic" })).toHaveLength(2);
	});

	test("full-text search via query", () => {
		store.store(
			makeMemory({
				id: "m1",
				content: "TypeScript is a typed superset of JavaScript",
			}),
		);
		store.store(
			makeMemory({ id: "m2", content: "Bun is a fast JavaScript runtime" }),
		);
		store.store(
			makeMemory({ id: "m3", content: "SQLite is an embedded database" }),
		);

		const results = store.query({ search: "JavaScript" });
		expect(results).toHaveLength(2);
	});

	test("search with FTS ranking", () => {
		store.store(
			makeMemory({
				id: "m1",
				agentId: "a1",
				content: "JavaScript runtime performance",
			}),
		);
		store.store(
			makeMemory({
				id: "m2",
				agentId: "a1",
				content: "Database optimization techniques",
			}),
		);
		store.store(
			makeMemory({
				id: "m3",
				agentId: "a1",
				content: "JavaScript bundler comparison",
			}),
		);

		const results = store.search("a1", "JavaScript");
		expect(results).toHaveLength(2);
	});

	test("getByTier returns entries for agent and tier", () => {
		store.store(makeMemory({ id: "m1", agentId: "a1", tier: "episodic" }));
		store.store(makeMemory({ id: "m2", agentId: "a1", tier: "episodic" }));
		store.store(makeMemory({ id: "m3", agentId: "a1", tier: "semantic" }));

		expect(store.getByTier("a1", "episodic")).toHaveLength(2);
		expect(store.getByTier("a1", "semantic")).toHaveLength(1);
		expect(store.getByTier("a1", "procedural")).toHaveLength(0);
	});

	test("pruneOlderThan removes old entries", () => {
		const old = new Date(Date.now() - 86400000).toISOString();
		const recent = new Date().toISOString();

		store.store(
			makeMemory({ id: "m1", tier: "episodic", lastAccessedAt: old }),
		);
		store.store(
			makeMemory({ id: "m2", tier: "episodic", lastAccessedAt: recent }),
		);
		store.store(
			makeMemory({ id: "m3", tier: "episodic", lastAccessedAt: old }),
		);

		store.pruneOlderThan(
			"episodic",
			new Date(Date.now() - 3600000).toISOString(),
		);
		expect(store.getById("m2")).toBeDefined();
		expect(store.getById("m1")).toBeUndefined();
		expect(store.getById("m3")).toBeUndefined();
	});

	test("stores and retrieves metadata", () => {
		const mem = makeMemory({
			id: "m1",
			metadata: { tags: ["test", "important"], source: "manual" },
		});
		store.store(mem);
		const retrieved = store.getById("m1");
		expect(retrieved?.metadata).toEqual({
			tags: ["test", "important"],
			source: "manual",
		});
	});
});
