import { describe, expect, test } from "bun:test";
import { type MemoryEntry, now, prefixedId } from "@nous/core";
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
			metadata: { projectRoot: "/repo/app", tags: ["auth", "fix"] },
		});
		storeMemory(store, {
			content: "Updated README documentation for installation.",
			metadata: { projectRoot: "/repo/app", tags: ["documentation"] },
		});
		storeMemory(store, {
			content: "Investigated flaky payment test in another project.",
			metadata: { projectRoot: "/repo/other", tags: ["test", "payment"] },
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

	test("renders compact memory hints for context assembly", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		storeMemory(store, {
			content:
				"Refactored the daemon attach flow so a single connected client can receive live notification pushes over the same socket.",
			metadata: { projectRoot: "/repo/app", tags: ["daemon", "attach"] },
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
		expect(hints[0]).toContain("[episodic");
		expect(hints[0]).toContain("daemon attach flow");
	});
});
