import type { MemoryEntry } from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { MemoryStore } from "@nous/persistence";

/** Tier 2: Episodic memory — stores session transcripts and task results */
export class EpisodicMemory {
	constructor(
		private store: MemoryStore,
		private agentId: string,
	) {}

	/** Record a task execution episode */
	recordEpisode(
		taskDescription: string,
		result: string,
		toolsUsed: string[],
		success: boolean,
	): MemoryEntry {
		const entry: MemoryEntry = {
			id: prefixedId("mem"),
			tier: "episodic",
			agentId: this.agentId,
			content: `Task: ${taskDescription}\nResult: ${result}\nTools: ${toolsUsed.join(", ")}\nSuccess: ${success}`,
			metadata: {
				taskDescription,
				toolsUsed,
				success,
				recordedAt: now(),
			},
			createdAt: now(),
			lastAccessedAt: now(),
			accessCount: 0,
			retentionScore: 1.0,
		};
		this.store.store(entry);
		return entry;
	}

	/** Get recent episodes for context */
	getRecent(limit = 5): MemoryEntry[] {
		return this.store.query({
			agentId: this.agentId,
			tier: "episodic",
			limit,
		});
	}

	/** Prune old episodes beyond retention window */
	prune(olderThanMs: number): number {
		const cutoff = new Date(Date.now() - olderThanMs).toISOString();
		return this.store.pruneOlderThan("episodic", cutoff);
	}
}
