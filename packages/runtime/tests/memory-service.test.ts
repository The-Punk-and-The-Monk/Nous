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
		expect(hints[0]).toContain("[semantic");
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
});
