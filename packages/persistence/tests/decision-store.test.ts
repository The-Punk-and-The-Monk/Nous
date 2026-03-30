import { beforeEach, describe, expect, test } from "bun:test";
import type { Decision, DecisionOption, Intent } from "@nous/core";
import { initDatabase } from "../src/sqlite/connection.ts";
import { SQLiteDecisionStore } from "../src/sqlite/decision-store.sqlite.ts";
import { SQLiteIntentStore } from "../src/sqlite/intent-store.sqlite.ts";
import { SQLiteMessageStore } from "../src/sqlite/message-store.sqlite.ts";

let store: SQLiteDecisionStore;
let intentStore: SQLiteIntentStore;
let messageStore: SQLiteMessageStore;

function makeIntent(id = "intent_1"): Intent {
	return {
		id,
		raw: "Inspect auth changes",
		workingText: "Inspect auth changes",
		goal: {
			summary: "Inspect auth changes",
			successCriteria: ["Report findings"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always",
		status: "awaiting_clarification",
		source: "human",
		clarificationQuestions: ["Which branch should I inspect?"],
		createdAt: new Date().toISOString(),
	};
}

function makeDecision(overrides: Partial<Decision> = {}): Decision {
	return {
		id: overrides.id ?? "decision_1",
		intentId: overrides.intentId ?? "intent_1",
		threadId: overrides.threadId ?? "thread_1",
		kind: overrides.kind ?? "clarification",
		summary: overrides.summary ?? "Need branch clarification",
		questions: overrides.questions ?? ["Which branch should I inspect?"],
		status: overrides.status ?? "pending",
		responseMode: overrides.responseMode ?? "free_text",
		options: overrides.options,
		selectedOptionId: overrides.selectedOptionId,
		outcome: overrides.outcome,
		relatedIntentIds: overrides.relatedIntentIds,
		createdAt: overrides.createdAt ?? new Date().toISOString(),
		answerText: overrides.answerText,
		answerMessageId: overrides.answerMessageId,
		answeredAt: overrides.answeredAt,
		resolvedAt: overrides.resolvedAt,
		metadata: overrides.metadata ?? {},
	};
}

beforeEach(() => {
	const db = initDatabase();
	store = new SQLiteDecisionStore(db);
	intentStore = new SQLiteIntentStore(db);
	messageStore = new SQLiteMessageStore(db);
	messageStore.createThread({
		id: "thread_1",
		status: "active",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		metadata: {},
	});
	intentStore.create(makeIntent());
});

describe("SQLiteDecisionStore", () => {
	test("create and getById round-trip", () => {
		store.create(makeDecision());

		const retrieved = store.getById("decision_1");
		expect(retrieved?.questions).toEqual(["Which branch should I inspect?"]);
		expect(retrieved?.status).toBe("pending");
	});

	test("round-trips approval decision metadata", () => {
		store.create(
			makeDecision({
				id: "decision_approval",
				kind: "approval",
				summary: "Approve ambient sync",
				questions: ["Should I sync the release checklist now?"],
				responseMode: "approval",
				selectedOptionId: "approve",
				outcome: "approved",
				status: "resolved",
				relatedIntentIds: ["intent_2"],
				metadata: { source: "ambient", confidence: 0.82 },
			}),
		);

		const retrieved = store.getById("decision_approval");
		expect(retrieved?.kind).toBe("approval");
		expect(retrieved?.responseMode).toBe("approval");
		expect(retrieved?.selectedOptionId).toBe("approve");
		expect(retrieved?.outcome).toBe("approved");
		expect(retrieved?.relatedIntentIds).toEqual(["intent_2"]);
		expect(retrieved?.metadata).toMatchObject({
			source: "ambient",
			confidence: 0.82,
		});
	});

	test("round-trips single-select options for conflict resolution", () => {
		const options: DecisionOption[] = [
			{
				id: "queue_after_current",
				label: "Queue after current work",
				value: "queue_after_current",
				description: "Wait for the current intent to finish.",
				recommended: true,
			},
			{
				id: "cancel_new_intent",
				label: "Cancel new intent",
				value: "cancel_new_intent",
				description: "Drop the new conflicting intent.",
				recommended: false,
			},
		];
		store.create(
			makeDecision({
				id: "decision_conflict",
				kind: "conflict_resolution",
				summary: "Resolve conflicting work",
				questions: ["The new request overlaps with active work."],
				responseMode: "single_select",
				options,
				selectedOptionId: "queue_after_current",
				outcome: "conflict_queue_after_current",
				status: "resolved",
				relatedIntentIds: ["intent_active"],
			}),
		);

		const retrieved = store.getById("decision_conflict");
		expect(retrieved?.responseMode).toBe("single_select");
		expect(retrieved?.options).toEqual(options);
		expect(retrieved?.selectedOptionId).toBe("queue_after_current");
		expect(retrieved?.outcome).toBe("conflict_queue_after_current");
		expect(retrieved?.relatedIntentIds).toEqual(["intent_active"]);
	});

	test("update persists answer and resolution fields", () => {
		store.create(makeDecision());
		store.update("decision_1", {
			status: "resolved",
			answerText: "feature/auth-refresh",
			answerMessageId: "msg_1",
			answeredAt: "2026-03-30T10:00:00.000Z",
			resolvedAt: "2026-03-30T10:00:01.000Z",
		});

		const retrieved = store.getById("decision_1");
		expect(retrieved?.status).toBe("resolved");
		expect(retrieved?.answerText).toBe("feature/auth-refresh");
		expect(retrieved?.answerMessageId).toBe("msg_1");
	});

	test("getPendingByThread and getPendingByIntent filter correctly", () => {
		intentStore.create(makeIntent("intent_2"));
		messageStore.createThread({
			id: "thread_2",
			status: "active",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			metadata: {},
		});
		store.create(makeDecision({ id: "decision_1", status: "pending" }));
		store.create(
			makeDecision({
				id: "decision_2",
				intentId: "intent_2",
				threadId: "thread_2",
				status: "resolved",
			}),
		);
		store.create(
			makeDecision({
				id: "decision_3",
				intentId: "intent_2",
				threadId: "thread_2",
				status: "pending",
			}),
		);

		expect(
			store.getPendingByThread("thread_1").map((decision) => decision.id),
		).toEqual(["decision_1"]);
		expect(
			store.getPendingByIntent("intent_2").map((decision) => decision.id),
		).toEqual(["decision_3"]);
	});

	test("getQueuedByThread returns queued decisions in order", () => {
		store.create(
			makeDecision({
				id: "decision_queued_1",
				status: "queued",
				createdAt: "2026-03-30T10:00:00.000Z",
			}),
		);
		store.create(
			makeDecision({
				id: "decision_queued_2",
				status: "queued",
				createdAt: "2026-03-30T10:00:01.000Z",
			}),
		);

		expect(
			store.getQueuedByThread("thread_1").map((decision) => decision.id),
		).toEqual(["decision_queued_1", "decision_queued_2"]);
	});
});
