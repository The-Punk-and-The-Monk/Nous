import { beforeEach, describe, expect, test } from "bun:test";
import type {
	Flow,
	FlowThreadBinding,
	Intent,
	MergeCandidate,
	PlanGraph,
	WorkRelation,
} from "@nous/core";
import { initDatabase } from "../src/sqlite/connection.ts";
import { SQLiteIntentStore } from "../src/sqlite/intent-store.sqlite.ts";
import { SQLiteMessageStore } from "../src/sqlite/message-store.sqlite.ts";
import { SQLiteWorkStore } from "../src/sqlite/work-store.sqlite.ts";

let store: SQLiteWorkStore;
let messageStore: SQLiteMessageStore;
let intentStore: SQLiteIntentStore;

beforeEach(() => {
	const db = initDatabase();
	store = new SQLiteWorkStore(db);
	messageStore = new SQLiteMessageStore(db);
	intentStore = new SQLiteIntentStore(db);
});

describe("SQLiteWorkStore", () => {
	test("stores and retrieves flows and plan graphs", () => {
		const flow: Flow = {
			id: "flow_auth",
			kind: "explicit_request",
			title: "Auth migration",
			summary: "Track the auth migration work.",
			ownerThreadId: "thread_auth",
			status: "active",
			source: "human",
			priority: 2,
			createdAt: "2026-04-01T10:00:00.000Z",
			updatedAt: "2026-04-01T10:00:00.000Z",
			relatedIntentIds: ["intent_auth"],
			relatedTaskIds: [],
		};
		const planGraph: PlanGraph = {
			id: "plan_auth",
			intentId: "intent_auth",
			flowId: flow.id,
			status: "active",
			topology: "serial",
			planningDepth: "light",
			createdAt: "2026-04-01T10:00:00.000Z",
			updatedAt: "2026-04-01T10:00:00.000Z",
		};

		store.createFlow(flow);
		intentStore.create(makeIntent());
		store.createPlanGraph(planGraph);

		expect(store.getFlowById(flow.id)?.title).toBe("Auth migration");
		expect(store.listFlows({ ownerThreadId: "thread_auth" })).toHaveLength(1);
		expect(store.getPlanGraphById(planGraph.id)?.topology).toBe("serial");
		expect(store.listPlanGraphs({ flowId: flow.id })).toHaveLength(1);
	});

	test("stores work relations and merge candidates", () => {
		store.createFlow({
			id: "flow_auth",
			kind: "explicit_request",
			title: "Auth migration",
			summary: "Track the auth migration work.",
			status: "active",
			source: "human",
			priority: 2,
			createdAt: "2026-04-01T10:00:00.000Z",
			updatedAt: "2026-04-01T10:00:00.000Z",
			relatedIntentIds: [],
			relatedTaskIds: [],
		});

		const relation: WorkRelation = {
			id: "rel_1",
			fromKind: "task",
			fromId: "task_a",
			toKind: "task",
			toId: "task_b",
			kind: "hard_dependency",
			flowId: "flow_auth",
			rationale: "Task B depends on task A completing first.",
			confidence: 1,
			createdAt: "2026-04-01T10:05:00.000Z",
		};
		const candidate: MergeCandidate = {
			id: "merge_1",
			leftKind: "intent",
			leftId: "intent_auth",
			rightKind: "intent",
			rightId: "intent_auth_followup",
			proposedAction: "link_only",
			rationale: "Likely the same larger auth migration responsibility.",
			confidence: 0.72,
			producedBy: "reflection",
			status: "proposed",
			createdAt: "2026-04-01T10:06:00.000Z",
		};

		store.createRelation(relation);
		store.createMergeCandidate(candidate);
		store.updateMergeCandidate(candidate.id, { status: "accepted" });

		expect(store.getRelationById("rel_1")?.kind).toBe("hard_dependency");
		expect(store.listRelations({ flowId: "flow_auth" })).toHaveLength(1);
		expect(store.getMergeCandidateById("merge_1")?.status).toBe("accepted");
		expect(
			store.listMergeCandidates({ statuses: ["accepted"] }),
		).toHaveLength(1);
	});

	test("stores flow-thread bindings", () => {
		store.createFlow({
			id: "flow_auth",
			kind: "explicit_request",
			title: "Auth migration",
			summary: "Track the auth migration work.",
			status: "active",
			source: "human",
			priority: 2,
			createdAt: "2026-04-01T10:00:00.000Z",
			updatedAt: "2026-04-01T10:00:00.000Z",
			relatedIntentIds: [],
			relatedTaskIds: [],
		});
		messageStore.createThread({
			id: "thread_auth",
			title: "Auth migration",
			status: "active",
			createdAt: "2026-04-01T10:00:00.000Z",
			updatedAt: "2026-04-01T10:00:00.000Z",
		});

		const binding: FlowThreadBinding = {
			flowId: "flow_auth",
			threadId: "thread_auth",
			role: "primary",
			createdAt: "2026-04-01T10:10:00.000Z",
		};

		store.bindFlowThread(binding);

		expect(store.listFlowThreadBindings({ flowId: "flow_auth" })).toEqual([
			{
				...binding,
				metadata: {},
			},
		]);
	});
});

function makeIntent(overrides: Partial<Intent> = {}): Intent {
	return {
		id: overrides.id ?? "intent_auth",
		raw: overrides.raw ?? "Inspect auth migration status",
		goal:
			overrides.goal ??
			({
				summary: "Inspect auth migration status",
				successCriteria: ["Summarize current status"],
			} satisfies Intent["goal"]),
		constraints: overrides.constraints ?? [],
		priority: overrides.priority ?? 1,
		humanCheckpoints: overrides.humanCheckpoints ?? "always",
		status: overrides.status ?? "active",
		source: overrides.source ?? "human",
		createdAt: overrides.createdAt ?? "2026-04-01T10:00:00.000Z",
	};
}
