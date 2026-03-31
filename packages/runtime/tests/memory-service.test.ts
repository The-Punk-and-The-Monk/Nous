import { describe, expect, test } from "bun:test";
import type {
	EpisodicMemoryMetadata,
	SemanticMemoryMetadata,
} from "@nous/core";
import { SQLiteMemoryStore, initDatabase } from "@nous/persistence";
import { MemoryService } from "../src/memory/service.ts";

describe("MemoryService", () => {
	test("ingests human intents with canonical episodic metadata and provenance", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const entry = service.ingestHumanIntent({
			threadId: "thread_1",
			intentId: "int_1",
			text: "Refactor the auth module",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
				focusedFile: "src/auth.ts",
				labels: ["coding"],
			},
		});

		const stored = store.getById(entry.id);
		const metadata = stored?.metadata as EpisodicMemoryMetadata;
		expect(stored?.tier).toBe("episodic");
		expect(metadata.schemaVersion).toBe("memory.v1");
		expect(metadata.sourceKind).toBe("human_intent");
		expect(metadata.threadId).toBe("thread_1");
		expect(metadata.intentId).toBe("int_1");
		expect(metadata.projectRoot).toBe("/repo/app");
		expect(metadata.provenance.source).toBe("human_intent");
		expect(metadata.provenance.sourceRefs).toEqual([
			{ kind: "thread", id: "thread_1" },
			{ kind: "intent", id: "int_1" },
		]);
	});

	test("retrieves context hints from canonical outcome memories and records access", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const entry = service.ingestIntentOutcome({
			intentId: "int_2",
			intentText: "Fix the authentication login flow",
			outcome: "intent.achieved",
			threadId: "thread_2",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
				focusedFile: "src/auth.ts",
				labels: ["auth"],
			},
			outputs: [
				"Updated the auth token refresh logic and resolved the login regression.",
			],
		});

		const hints = service.retrieveForContext({
			query: "authentication login issue",
			threadId: "thread_2",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
			tiers: ["semantic"],
		});

		const stored = store.getById(entry.id);
		const metadata = stored?.metadata as SemanticMemoryMetadata;
		expect(hints).toHaveLength(1);
		expect(hints[0]).toContain("[semantic intent_outcome");
		expect(hints[0]).toContain("authentication");
		expect(stored?.accessCount).toBe(1);
		expect(stored?.retentionScore).toBeGreaterThan(1.2);
		expect(stored?.embedding?.length).toBeGreaterThan(0);
		expect(metadata.sourceKind).toBe("intent_outcome");
		expect(metadata.factType).toBe("outcome_summary");
		expect(metadata.provenance.evidenceRefs).toEqual([
			{ kind: "intent", id: "int_2", role: "source" },
		]);
	});

	test("stores escalated outcomes as episodic memories", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const entry = service.ingestIntentOutcome({
			intentId: "int_3",
			intentText: "Upgrade the payment flow",
			outcome: "escalation",
			threadId: "thread_3",
		});

		const stored = store.getById(entry.id);
		const metadata = stored?.metadata as EpisodicMemoryMetadata;
		expect(stored?.tier).toBe("episodic");
		expect(stored?.retentionScore).toBe(0.8);
		expect(metadata.outcomeStatus).toBe("escalated");
	});

	test("ingests perception signals and conversation turns with canonical provenance", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const perception = service.ingestPerceptionSignal({
			signalId: "sig_1",
			signalType: "fs.file_changed",
			message: "package.json changed in /repo/app",
			confidence: 0.82,
			threadId: "thread_ambient",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
				focusedFile: "package.json",
			},
			eventId: "evt_1",
		});
		const conversation = service.ingestConversationTurn({
			threadId: "thread_ambient",
			role: "user",
			content: "Please keep this read-only.",
			messageId: "msg_1",
			intentId: "int_1",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
		});

		const perceptionStored = store.getById(perception.id);
		const conversationStored = store.getById(conversation.id);
		const perceptionMeta = perceptionStored?.metadata as EpisodicMemoryMetadata;
		const conversationMeta =
			conversationStored?.metadata as EpisodicMemoryMetadata;

		expect(perceptionMeta.sourceKind).toBe("perception_signal");
		expect(perceptionMeta.provenance.sourceRefs).toEqual([
			{ kind: "sensor_signal", id: "sig_1" },
			{ kind: "event", id: "evt_1" },
			{ kind: "thread", id: "thread_ambient" },
		]);
		expect(conversationMeta.sourceKind).toBe("conversation_turn");
		expect(conversationMeta.provenance.sourceRefs).toEqual([
			{ kind: "thread", id: "thread_ambient" },
			{ kind: "message", id: "msg_1" },
			{ kind: "intent", id: "int_1" },
		]);
	});

	test("ingests prospective commitments into the prospective tier", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const entry = service.ingestProspectiveCommitment({
			title: "Follow up on auth migration",
			detail: "Revisit the auth migration once the dependency update lands.",
			threadId: "thread_1",
			intentId: "int_1",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
			dueAt: "2026-04-01T09:00:00.000Z",
			remindAt: "2026-04-01T08:00:00.000Z",
			blocking: true,
		});

		const stored = store.getById(entry.id);
		expect(stored?.tier).toBe("prospective");
		expect(stored?.content).toContain("Follow up on auth migration");
		expect((stored?.metadata as Record<string, unknown>).sourceKind).toBe(
			"prospective_commitment",
		);
	});

	test("finds due prospective commitments and can update their lifecycle state", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const entry = service.ingestProspectiveCommitment({
			title: "Check auth migration progress",
			threadId: "thread_1",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
			remindAt: "2026-04-01T08:00:00.000Z",
			dueAt: "2026-04-01T09:00:00.000Z",
		});

		const due = service.findDueProspectiveCommitments({
			now: "2026-04-01T07:55:00.000Z",
			lookaheadMs: 10 * 60_000,
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
		});
		expect(due).toHaveLength(1);
		expect(due[0]?.title).toBe("Check auth migration progress");
		expect(due[0]?.reminderKind).toBe("remind_at");

		service.updateProspectiveCommitment(entry.id, {
			fulfillmentStatus: "scheduled",
		});
		expect(
			(store.getById(entry.id)?.metadata as Record<string, unknown>)
				.fulfillmentStatus,
		).toBe("scheduled");
	});

	test("marks linked prospective commitments done when the intent succeeds", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const entry = service.ingestProspectiveCommitment({
			title: "Summarize auth migration",
			threadId: "thread_1",
			intentId: "int_auth",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
		});

		service.ingestIntentOutcome({
			intentId: "int_auth",
			intentText: "Summarize auth migration",
			outcome: "intent.achieved",
			threadId: "thread_1",
		});

		expect(
			(store.getById(entry.id)?.metadata as Record<string, unknown>)
				.fulfillmentStatus,
		).toBe("done");
	});
});
