import type { ISOTimestamp } from "../utils/timestamp.ts";

export type MemoryTier =
	| "working" // Tier 1: context window
	| "episodic" // Tier 2: session transcripts
	| "semantic" // Tier 3: facts and knowledge
	| "procedural" // Tier 4: learned execution paths
	| "prospective"; // Tier 5: future commitments

export interface MemoryEntry {
	id: string;
	tier: MemoryTier;
	agentId: string;
	content: string;
	metadata: Record<string, unknown>;
	embedding?: number[];
	createdAt: ISOTimestamp;
	lastAccessedAt: ISOTimestamp;
	accessCount: number;
	retentionScore: number;
	digestedFrom?: string[];
}

export interface ProceduralStep {
	order: number;
	description: string;
	toolName?: string;
	toolArgs?: Record<string, unknown>;
	expectedOutcome: string;
}

export interface ProceduralMemory extends MemoryEntry {
	tier: "procedural";
	taskTypeTags: string[];
	steps: ProceduralStep[];
	successCount: number;
	failureCount: number;
	contentHash: string;
	sourceEpisodeIds: string[];
}
