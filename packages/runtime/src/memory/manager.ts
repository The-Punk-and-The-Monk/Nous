import type { MemoryEntry } from "@nous/core";
import type { MemoryStore } from "@nous/persistence";
import { EpisodicMemory } from "./episodic.ts";
import { SemanticMemory } from "./semantic.ts";
import { WorkingMemory } from "./working.ts";

/** Unified memory manager across all tiers */
export class MemoryManager {
	readonly working: WorkingMemory;
	readonly episodic: EpisodicMemory;
	readonly semantic: SemanticMemory;

	constructor(store: MemoryStore, agentId: string) {
		this.working = new WorkingMemory();
		this.episodic = new EpisodicMemory(store, agentId);
		this.semantic = new SemanticMemory(store, agentId);
	}

	/** Retrieve relevant context for a task from all tiers */
	getContextForTask(taskDescription: string): string {
		const parts: string[] = [];

		// Recent episodes
		const recentEpisodes = this.episodic.getRecent(3);
		if (recentEpisodes.length > 0) {
			parts.push("## Recent Task History");
			for (const ep of recentEpisodes) {
				parts.push(`- ${ep.content.split("\n")[0]}`);
			}
		}

		// Relevant semantic memories
		const relevantFacts = this.semantic.search(taskDescription, 5);
		if (relevantFacts.length > 0) {
			parts.push("\n## Relevant Knowledge");
			for (const fact of relevantFacts) {
				parts.push(`- ${fact.content}`);
				// Boost retention for accessed memories
				this.semantic.recordAccess(fact.id);
			}
		}

		return parts.join("\n");
	}

	/** Record the completion of a task as an episode */
	recordTaskCompletion(
		taskDescription: string,
		result: string,
		toolsUsed: string[],
		success: boolean,
	): MemoryEntry {
		return this.episodic.recordEpisode(
			taskDescription,
			result,
			toolsUsed,
			success,
		);
	}
}
