import { describe, expect, test } from "bun:test";
import {
	DEFAULT_NOUS_MATCHING_CONFIG,
	type MemoryEntry,
	now,
	prefixedId,
} from "@nous/core";
import { SQLiteMemoryStore, initDatabase } from "@nous/persistence";
import {
	HybridMemoryRetriever,
	renderMemoryHints,
} from "../src/memory/retrieval.ts";

function storeMemory(
	store: SQLiteMemoryStore,
	overrides: Partial<MemoryEntry> & Pick<MemoryEntry, "content">,
): MemoryEntry {
	const entry: MemoryEntry = {
		id: prefixedId("mem"),
		tier: "episodic",
		agentId: "nous",
		content: overrides.content,
		metadata: overrides.metadata ?? {},
		createdAt: now(),
		lastAccessedAt: now(),
		accessCount: 0,
		retentionScore: 1,
		...overrides,
	};
	store.store(entry);
	return entry;
}

describe("HybridMemoryRetriever", () => {
	test("retrieves semantically related memories with scope boost", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		storeMemory(store, {
			content:
				"Fixed auth login failure by updating the authentication token flow.",
			metadata: {
				projectRoot: "/repo/app",
				tags: ["auth", "fix"],
				sourceKind: "intent_outcome",
				provenance: { confidence: 0.9, evidenceRefs: [{ kind: "intent" }] },
			},
		});
		storeMemory(store, {
			content: "Updated README documentation for installation.",
			metadata: {
				projectRoot: "/repo/app",
				tags: ["documentation"],
				sourceKind: "manual_note",
				provenance: { confidence: 0.6 },
			},
		});
		storeMemory(store, {
			content: "Investigated flaky payment test in another project.",
			metadata: {
				projectRoot: "/repo/other",
				tags: ["test", "payment"],
				sourceKind: "conversation_turn",
				provenance: { confidence: 0.4 },
			},
		});

		const retriever = new HybridMemoryRetriever(store);
		const results = retriever.retrieve({
			agentId: "nous",
			query: "authentication login issue",
			scope: { projectRoot: "/repo/app" },
			limit: 2,
		});

		expect(results).toHaveLength(2);
		expect(results[0]?.entry.content).toContain("auth login failure");
		expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
		expect(results[0]?.entry.embedding?.length).toBeGreaterThan(0);
	});

	test("selects the most relevant chunk from a long memory entry", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const prefix = Array.from(
			{ length: 140 },
			(_, index) => `preface${index}`,
		).join(" ");
		storeMemory(store, {
			content: `${prefix} later in the execution trace the daemon attach reconnection path was fixed so pending outbox deliveries flush correctly after reconnect and the socket push stream resumes without duplicating messages.`,
			metadata: {
				projectRoot: "/repo/app",
				threadId: "thread_1",
				sourceKind: "intent_outcome",
				provenance: { confidence: 0.85 },
			},
		});

		const retriever = new HybridMemoryRetriever(store);
		const results = retriever.retrieve({
			agentId: "nous",
			query: "attach reconnect pending outbox flush",
			scope: { projectRoot: "/repo/app" },
			threadId: "thread_1",
			limit: 1,
		});

		expect(results).toHaveLength(1);
		expect(results[0]?.chunkCount).toBeGreaterThan(1);
		expect(results[0]?.excerpt).toContain("pending outbox deliveries flush");
	});

	test("renders compact memory hints for context assembly", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		storeMemory(store, {
			content:
				"Refactored the daemon attach flow so a single connected client can receive live notification pushes over the same socket.",
			metadata: {
				projectRoot: "/repo/app",
				tags: ["daemon", "attach"],
				sourceKind: "intent_outcome",
				provenance: { confidence: 0.8 },
			},
		});

		const retriever = new HybridMemoryRetriever(store);
		const hints = renderMemoryHints(
			retriever.retrieve({
				agentId: "nous",
				query: "daemon attach push notifications",
				scope: { projectRoot: "/repo/app" },
			}),
		);

		expect(hints).toHaveLength(1);
		expect(hints[0]).toContain("[episodic intent_outcome");
		expect(hints[0]).toContain("daemon attach flow");
	});

	test("matcher policy can tilt ranking between lexical and semantic/structured signals", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		storeMemory(store, {
			content: "auth login issue quick note",
			metadata: {
				projectRoot: "/repo/other",
				sourceKind: "manual_note",
				provenance: { confidence: 0.4 },
			},
		});
		storeMemory(store, {
			content: "auth login failure fixed via token refresh flow",
			metadata: {
				projectRoot: "/repo/app",
				sourceKind: "intent_outcome",
				provenance: { confidence: 0.95, evidenceRefs: [{ kind: "intent" }] },
			},
		});

		const heuristicRetriever = new HybridMemoryRetriever(store, undefined, {
			...DEFAULT_NOUS_MATCHING_CONFIG.memoryRetrieval,
			mode: "heuristic_only",
		});
		const semanticRetriever = new HybridMemoryRetriever(store, undefined, {
			...DEFAULT_NOUS_MATCHING_CONFIG.memoryRetrieval,
			mode: "semantic_only",
		});

		const heuristicResults = heuristicRetriever.retrieve({
			agentId: "nous",
			query: "auth login issue",
			scope: { projectRoot: "/repo/app" },
			limit: 2,
		});
		const semanticResults = semanticRetriever.retrieve({
			agentId: "nous",
			query: "auth login issue",
			scope: { projectRoot: "/repo/app" },
			limit: 2,
		});

		expect(
			(heuristicResults[0]?.entry.metadata as { projectRoot?: string })
				?.projectRoot,
		).toBe("/repo/other");
		expect(
			(semanticResults[0]?.entry.metadata as { projectRoot?: string })
				?.projectRoot,
		).toBe("/repo/app");
	});
});
