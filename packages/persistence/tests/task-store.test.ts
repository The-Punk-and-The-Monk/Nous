import { beforeEach, describe, expect, test } from "bun:test";
import type { Intent, Task } from "@nous/core";
import { initDatabase } from "../src/sqlite/connection.ts";
import { SQLiteIntentStore } from "../src/sqlite/intent-store.sqlite.ts";
import { SQLiteTaskStore } from "../src/sqlite/task-store.sqlite.ts";

let taskStore: SQLiteTaskStore;
let intentStore: SQLiteIntentStore;

function makeIntent(id = "intent_1"): Intent {
	return {
		id,
		raw: "test intent",
		goal: { summary: "test", successCriteria: [] },
		constraints: [],
		priority: 0,
		humanCheckpoints: "always",
		status: "active",
		source: "human",
		createdAt: new Date().toISOString(),
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: `task_${Math.random().toString(36).slice(2)}`,
		intentId: "intent_1",
		dependsOn: [],
		description: "test task",
		capabilitiesRequired: [],
		status: "created",
		retries: 0,
		maxRetries: 3,
		backoffSeconds: 2,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

beforeEach(() => {
	const db = initDatabase();
	taskStore = new SQLiteTaskStore(db);
	intentStore = new SQLiteIntentStore(db);
	// Create a parent intent for FK constraint
	intentStore.create(makeIntent());
});

describe("SQLiteTaskStore", () => {
	test("create and getById", () => {
		const task = makeTask({ id: "task_001", description: "do something" });
		taskStore.create(task);
		const retrieved = taskStore.getById("task_001");
		expect(retrieved).toBeDefined();
		expect(retrieved?.description).toBe("do something");
		expect(retrieved?.status).toBe("created");
	});

	test("getById returns undefined for missing", () => {
		expect(taskStore.getById("nonexistent")).toBeUndefined();
	});

	test("update changes fields", () => {
		const task = makeTask({ id: "task_002" });
		taskStore.create(task);
		taskStore.update("task_002", {
			status: "queued",
			queuedAt: new Date().toISOString(),
		});
		const updated = taskStore.getById("task_002");
		expect(updated?.status).toBe("queued");
		expect(updated?.queuedAt).toBeDefined();
	});

	test("update with JSON fields", () => {
		const task = makeTask({ id: "task_003" });
		taskStore.create(task);
		taskStore.update("task_003", {
			result: { summary: "all good" },
			capabilitiesRequired: ["fs.read"],
		});
		const updated = taskStore.getById("task_003");
		expect(updated?.result).toEqual({ summary: "all good" });
		expect(updated?.capabilitiesRequired).toEqual(["fs.read"]);
	});

	test("delete removes task", () => {
		const task = makeTask({ id: "task_004" });
		taskStore.create(task);
		taskStore.delete("task_004");
		expect(taskStore.getById("task_004")).toBeUndefined();
	});

	test("getByStatus returns matching tasks", () => {
		taskStore.create(makeTask({ id: "t1", status: "created" }));
		taskStore.create(makeTask({ id: "t2", status: "created" }));
		taskStore.create(
			makeTask({
				id: "t3",
				status: "queued",
				queuedAt: new Date().toISOString(),
			}),
		);

		expect(taskStore.getByStatus("created")).toHaveLength(2);
		expect(taskStore.getByStatus("queued")).toHaveLength(1);
		expect(taskStore.getByStatus("running")).toHaveLength(0);
	});

	test("getByIntent returns tasks for that intent", () => {
		intentStore.create(makeIntent("intent_2"));
		taskStore.create(makeTask({ id: "t1", intentId: "intent_1" }));
		taskStore.create(makeTask({ id: "t2", intentId: "intent_2" }));
		taskStore.create(makeTask({ id: "t3", intentId: "intent_1" }));

		expect(taskStore.getByIntent("intent_1")).toHaveLength(2);
		expect(taskStore.getByIntent("intent_2")).toHaveLength(1);
	});

	test("getByAgent returns tasks assigned to an agent", () => {
		taskStore.create(makeTask({ id: "t1", assignedAgentId: "agent_a" }));
		taskStore.create(makeTask({ id: "t2", assignedAgentId: "agent_b" }));
		taskStore.create(makeTask({ id: "t3", assignedAgentId: "agent_a" }));

		expect(taskStore.getByAgent("agent_a")).toHaveLength(2);
		expect(taskStore.getByAgent("agent_b")).toHaveLength(1);
	});

	test("getDependents finds tasks depending on a given task", () => {
		taskStore.create(makeTask({ id: "t1", dependsOn: [] }));
		taskStore.create(
			makeTask({ id: "t2", dependsOn: ["t1"], status: "queued" }),
		);
		taskStore.create(
			makeTask({ id: "t3", dependsOn: ["t1", "t2"], status: "queued" }),
		);

		const deps = taskStore.getDependents("t1");
		expect(deps).toHaveLength(2);
	});

	test("getReady returns queued tasks with all deps done", () => {
		taskStore.create(makeTask({ id: "t1", status: "done" }));
		taskStore.create(
			makeTask({ id: "t2", status: "queued", dependsOn: ["t1"] }),
		);
		taskStore.create(
			makeTask({ id: "t3", status: "queued", dependsOn: ["t1", "t4"] }),
		);
		taskStore.create(makeTask({ id: "t4", status: "running" }));

		const ready = taskStore.getReady();
		expect(ready).toHaveLength(1);
		expect(ready[0].id).toBe("t2");
	});

	test("getRunningWithStaleHeartbeat detects stale agents", () => {
		const staleTime = new Date(Date.now() - 60000).toISOString();
		const freshTime = new Date().toISOString();

		taskStore.create(
			makeTask({ id: "t1", status: "running", lastHeartbeat: staleTime }),
		);
		taskStore.create(
			makeTask({ id: "t2", status: "running", lastHeartbeat: freshTime }),
		);

		const stale = taskStore.getRunningWithStaleHeartbeat(30000);
		expect(stale).toHaveLength(1);
		expect(stale[0].id).toBe("t1");
	});

	test("getFailedWithRetries returns retryable tasks", () => {
		taskStore.create(
			makeTask({ id: "t1", status: "failed", retries: 0, maxRetries: 3 }),
		);
		taskStore.create(
			makeTask({ id: "t2", status: "failed", retries: 3, maxRetries: 3 }),
		);

		const retryable = taskStore.getFailedWithRetries();
		expect(retryable).toHaveLength(1);
		expect(retryable[0].id).toBe("t1");
	});

	test("count returns total and by-status counts", () => {
		taskStore.create(makeTask({ id: "t1", status: "created" }));
		taskStore.create(makeTask({ id: "t2", status: "created" }));
		taskStore.create(makeTask({ id: "t3", status: "done" }));

		expect(taskStore.count()).toBe(3);
		expect(taskStore.count("created")).toBe(2);
		expect(taskStore.count("done")).toBe(1);
	});
});
