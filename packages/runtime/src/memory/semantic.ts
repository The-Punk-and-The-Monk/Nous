import type { MemoryEntry } from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { MemoryStore } from "@nous/persistence";

/** Tier 3: Semantic memory — facts and knowledge extracted from episodes */
export class SemanticMemory {
	constructor(
		private store: MemoryStore,
		private agentId: string,
	) {}

	/** Store a fact or piece of knowledge */
	storeFact(content: string, tags: string[] = []): MemoryEntry {
		const entry: MemoryEntry = {
			id: prefixedId("mem"),
			tier: "semantic",
			agentId: this.agentId,
			content,
			metadata: { tags },
			createdAt: now(),
			lastAccessedAt: now(),
			accessCount: 0,
			retentionScore: 1.0,
		};
		this.store.store(entry);
		return entry;
	}

	/** Search for relevant facts using full-text search */
	search(query: string, limit = 10): MemoryEntry[] {
		return this.store.search(this.agentId, query, limit);
	}

	/** Get all semantic memories for this agent */
	getAll(): MemoryEntry[] {
		return this.store.getByTier(this.agentId, "semantic");
	}

	/** Record an access to boost retention */
	recordAccess(memoryId: string): void {
		const entry = this.store.getById(memoryId);
		if (entry) {
			this.store.update(memoryId, {
				lastAccessedAt: now(),
				accessCount: entry.accessCount + 1,
				retentionScore: Math.min(entry.retentionScore + 0.1, 2.0),
			});
		}
	}
}
