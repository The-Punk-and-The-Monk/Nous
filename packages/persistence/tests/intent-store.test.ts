import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import type { Intent } from "@nous/core";
import { initDatabase, runMigrations } from "../src/sqlite/connection.ts";
import { SQLiteIntentStore } from "../src/sqlite/intent-store.sqlite.ts";

let store: SQLiteIntentStore;

function makeIntent(overrides: Partial<Intent> = {}): Intent {
	return {
		id: overrides.id ?? "intent_1",
		flowId: overrides.flowId,
		planGraphId: overrides.planGraphId,
		sourceEnvelopeId: overrides.sourceEnvelopeId,
		raw: overrides.raw ?? "Inspect the auth changes",
		goal:
			overrides.goal ??
			({
				summary: "Inspect auth changes",
				successCriteria: ["Identify impacted files"],
			} satisfies Intent["goal"]),
		constraints: overrides.constraints ?? [],
		priority: overrides.priority ?? 1,
		humanCheckpoints: overrides.humanCheckpoints ?? "always",
		contract: overrides.contract ?? {
			summary: "Inspect auth changes and summarize findings",
			successCriteria: ["Identify impacted files"],
			boundaries: ["Do not modify files"],
			interruptionPolicy: "minimal",
			deliveryMode: "structured_with_evidence",
		},
		executionDepth: overrides.executionDepth ?? {
			planningDepth: "light",
			timeDepth: "foreground",
			organizationDepth: "single_agent",
			initiativeMode: "reactive",
			rationale: "Short bounded investigation.",
		},
		clarificationQuestions: overrides.clarificationQuestions ?? [],
		revisionHistory: overrides.revisionHistory,
		executionDirectives: overrides.executionDirectives,
		pendingRevision: overrides.pendingRevision,
		pendingCancellation: overrides.pendingCancellation,
		pendingPause: overrides.pendingPause,
		status: overrides.status ?? "active",
		source: overrides.source ?? "human",
		createdAt: overrides.createdAt ?? new Date().toISOString(),
		achievedAt: overrides.achievedAt,
	};
}

beforeEach(() => {
	const db = initDatabase();
	store = new SQLiteIntentStore(db);
});

describe("SQLiteIntentStore", () => {
	test("stores and retrieves task-intake metadata", () => {
		store.create(
			makeIntent({
				id: "intent_meta",
				flowId: "flow_auth",
				planGraphId: "plan_auth",
				sourceEnvelopeId: "env_turn_1",
			}),
		);

		const retrieved = store.getById("intent_meta");
		expect(retrieved?.flowId).toBe("flow_auth");
		expect(retrieved?.planGraphId).toBe("plan_auth");
		expect(retrieved?.sourceEnvelopeId).toBe("env_turn_1");
		expect(retrieved?.contract?.summary).toContain("summarize findings");
		expect(retrieved?.executionDepth?.planningDepth).toBe("light");
		expect(retrieved?.clarificationQuestions).toEqual([]);
	});

	test("update merges metadata fields without dropping other columns", () => {
		store.create(makeIntent({ id: "intent_update" }));

		store.update("intent_update", {
			status: "awaiting_clarification",
			clarificationQuestions: ["Which auth flow should I inspect first?"],
		});

		const updated = store.getById("intent_update");
		expect(updated?.status).toBe("awaiting_clarification");
		expect(updated?.contract?.summary).toContain("summarize findings");
		expect(updated?.clarificationQuestions).toEqual([
			"Which auth flow should I inspect first?",
		]);
	});

	test("round-trips pending revision metadata", () => {
		store.create(
			makeIntent({
				id: "intent_revision",
				revisionHistory: [
					{
						id: "rev_1",
						kind: "scope_update",
						requestedText: "Keep it read-only and focus on token refresh.",
						requestedAt: new Date().toISOString(),
						status: "requested",
						applyMode: "deferred_replan",
					},
				],
				executionDirectives: [
					{
						id: "dir_1",
						kind: "scope_revision",
						revisionText: "Keep it read-only and focus on token refresh.",
						requestedAt: new Date().toISOString(),
						status: "requested",
						applyMode: "deferred_replan",
						applyPolicy: "next_execution_boundary",
						revisionIds: ["rev_1"],
						sourceMessageIds: ["msg_1", "msg_2"],
					},
					{
						id: "dir_2",
						kind: "cancellation",
						requestedAt: new Date().toISOString(),
						status: "requested",
						reason: "Stop the intent after the current task",
						mode: "after_current_boundary",
					},
					{
						id: "dir_3",
						kind: "pause",
						requestedAt: new Date().toISOString(),
						status: "requested",
						reason: "Pause after the current task",
						mode: "after_current_task",
						resumeStatus: "active",
					},
					{
						id: "dir_4",
						kind: "approval_wait",
						requestedAt: new Date().toISOString(),
						status: "requested",
						reason: "Need approval after a risky boundary",
						taskId: "task_risky",
						toolNames: ["file_write", "shell"],
						rollbackAvailable: true,
					},
				],
				pendingRevision: {
					kind: "scope_update",
					revisionText: "Keep it read-only and focus on token refresh.",
					requestedAt: new Date().toISOString(),
					applyPolicy: "next_execution_boundary",
					revisionIds: ["rev_1"],
					sourceMessageIds: ["msg_1", "msg_2"],
				},
				pendingCancellation: {
					requestedAt: new Date().toISOString(),
					reason: "Stop the intent after the current task",
					mode: "after_current_boundary",
				},
				pendingPause: {
					requestedAt: new Date().toISOString(),
					reason: "Pause after the current task",
					mode: "after_current_task",
					resumeStatus: "active",
				},
			}),
		);

		const retrieved = store.getById("intent_revision");
		expect(retrieved?.revisionHistory?.[0]?.id).toBe("rev_1");
		expect(retrieved?.pendingRevision?.kind).toBe("scope_update");
		expect(retrieved?.pendingRevision?.revisionText).toContain("token refresh");
		expect(retrieved?.pendingRevision?.applyPolicy).toBe(
			"next_execution_boundary",
		);
		expect(retrieved?.pendingRevision?.revisionIds).toEqual(["rev_1"]);
		expect(retrieved?.pendingRevision?.sourceMessageIds).toEqual([
			"msg_1",
			"msg_2",
		]);
		expect(retrieved?.executionDirectives?.[0]).toMatchObject({
			kind: "scope_revision",
			status: "requested",
			revisionIds: ["rev_1"],
		});
		expect(retrieved?.executionDirectives?.[1]).toMatchObject({
			kind: "cancellation",
			mode: "after_current_boundary",
		});
		expect(retrieved?.executionDirectives?.[2]).toMatchObject({
			kind: "pause",
			mode: "after_current_task",
			resumeStatus: "active",
		});
		expect(retrieved?.executionDirectives?.[3]).toMatchObject({
			kind: "approval_wait",
			taskId: "task_risky",
			toolNames: ["file_write", "shell"],
			rollbackAvailable: true,
		});
		expect(retrieved?.pendingCancellation?.mode).toBe("after_current_boundary");
		expect(retrieved?.pendingPause).toMatchObject({
			mode: "after_current_task",
			resumeStatus: "active",
		});
	});

	test("getActive includes clarification-blocked intents", () => {
		store.create(makeIntent({ id: "intent_active" }));
		store.create(
			makeIntent({
				id: "intent_clarify",
				status: "awaiting_clarification",
				clarificationQuestions: ["Need the target branch."],
			}),
		);
		store.create(makeIntent({ id: "intent_done", status: "achieved" }));

		const active = store.getActive();
		expect(active.map((intent) => intent.id)).toEqual([
			"intent_active",
			"intent_clarify",
		]);
	});

	test("migration adds metadata column for older intent tables", () => {
		const db = new Database(":memory:");
		db.exec(`
			CREATE TABLE intents (
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
			)
		`);

		runMigrations(db);
		const columns = db.prepare("PRAGMA table_info(intents)").all() as {
			name: string;
		}[];
		expect(columns.some((column) => column.name === "metadata")).toBe(true);
	});
});
