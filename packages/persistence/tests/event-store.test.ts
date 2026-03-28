import { beforeEach, describe, expect, test } from "bun:test";
import type { Event } from "@nous/core";
import { initDatabase } from "../src/sqlite/connection.ts";
import { SQLiteEventStore } from "../src/sqlite/event-store.sqlite.ts";

let store: SQLiteEventStore;

beforeEach(() => {
	const db = initDatabase();
	store = new SQLiteEventStore(db);
});

function makeEvent(overrides: Partial<Event> = {}): Event {
	return {
		id: `evt_${Math.random().toString(36).slice(2)}`,
		timestamp: new Date().toISOString(),
		type: "task.created",
		entityType: "task",
		entityId: "task_123",
		payload: { description: "test" },
		...overrides,
	};
}

describe("SQLiteEventStore", () => {
	test("append and getById", () => {
		const event = makeEvent({ id: "evt_001" });
		store.append(event);
		const retrieved = store.getById("evt_001");
		expect(retrieved).toBeDefined();
		expect(retrieved?.id).toBe("evt_001");
		expect(retrieved?.type).toBe("task.created");
		expect(retrieved?.payload).toEqual({ description: "test" });
	});

	test("getById returns undefined for missing", () => {
		expect(store.getById("nonexistent")).toBeUndefined();
	});

	test("query by entityType and entityId", () => {
		store.append(makeEvent({ entityType: "task", entityId: "t1" }));
		store.append(makeEvent({ entityType: "task", entityId: "t2" }));
		store.append(makeEvent({ entityType: "intent", entityId: "i1" }));

		const taskEvents = store.query({ entityType: "task", entityId: "t1" });
		expect(taskEvents).toHaveLength(1);

		const allTaskEvents = store.query({ entityType: "task" });
		expect(allTaskEvents).toHaveLength(2);
	});

	test("query by type", () => {
		store.append(makeEvent({ type: "task.created" }));
		store.append(makeEvent({ type: "task.completed" }));
		store.append(makeEvent({ type: "task.created" }));

		const created = store.query({ type: "task.created" });
		expect(created).toHaveLength(2);
	});

	test("query with limit and offset", () => {
		for (let i = 0; i < 5; i++) {
			store.append(
				makeEvent({
					id: `evt_${i}`,
					timestamp: new Date(Date.now() + i * 1000).toISOString(),
				}),
			);
		}

		const page1 = store.query({ limit: 2 });
		expect(page1).toHaveLength(2);

		const page2 = store.query({ limit: 2, offset: 2 });
		expect(page2).toHaveLength(2);
		expect(page2[0].id).not.toBe(page1[0].id);
	});

	test("getByEntity delegates to query", () => {
		store.append(makeEvent({ entityType: "task", entityId: "t1" }));
		store.append(makeEvent({ entityType: "task", entityId: "t1" }));

		const events = store.getByEntity("task", "t1");
		expect(events).toHaveLength(2);
	});

	test("getCausalChain walks the chain", () => {
		store.append(makeEvent({ id: "evt_1" }));
		store.append(makeEvent({ id: "evt_2", causedByEventId: "evt_1" }));
		store.append(makeEvent({ id: "evt_3", causedByEventId: "evt_2" }));

		const chain = store.getCausalChain("evt_3");
		expect(chain).toHaveLength(3);
		expect(chain[0].id).toBe("evt_1");
		expect(chain[1].id).toBe("evt_2");
		expect(chain[2].id).toBe("evt_3");
	});

	test("count returns total and filtered counts", () => {
		store.append(makeEvent({ type: "task.created" }));
		store.append(makeEvent({ type: "task.created" }));
		store.append(makeEvent({ type: "task.completed" }));

		expect(store.count()).toBe(3);
		expect(store.count({ type: "task.created" })).toBe(2);
	});
});
