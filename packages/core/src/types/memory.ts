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

export type MemorySourceKind =
	| "human_intent"
	| "intent_outcome"
	| "tool_result"
	| "decision"
	| "conversation_turn"
	| "perception_signal"
	| "manual_note"
	| "metabolism"
	| "prospective_commitment";

export type MemoryProducerLayer =
	| "dialogue"
	| "daemon"
	| "orchestrator"
	| "runtime"
	| "perception"
	| "evolution"
	| "human";

export type MemorySourceRefKind =
	| "thread"
	| "message"
	| "intent"
	| "task"
	| "decision"
	| "event"
	| "memory"
	| "tool_call"
	| "sensor_signal";

export interface MemorySourceRef {
	kind: MemorySourceRefKind;
	id: string;
}

export interface MemoryEvidenceRef extends MemorySourceRef {
	role?: "source" | "support" | "contradiction" | "rollback";
	summary?: string;
}

export interface MemoryProvenance {
	source: MemorySourceKind;
	observedAt: ISOTimestamp;
	producer: {
		layer: MemoryProducerLayer;
		name: string;
		version?: string;
	};
	sourceRefs?: MemorySourceRef[];
	evidenceRefs?: MemoryEvidenceRef[];
	parentMemoryIds?: string[];
	confidence?: number;
}

export interface BaseMemoryMetadata {
	[key: string]: unknown;
	schemaVersion: "memory.v1";
	sourceKind: MemorySourceKind;
	threadId?: string;
	intentId?: string;
	taskId?: string;
	decisionId?: string;
	projectRoot?: string;
	focusedFile?: string;
	labels?: string[];
	tags?: string[];
	provenance: MemoryProvenance;
}

export interface EpisodicMemoryMetadata extends BaseMemoryMetadata {
	sourceKind:
		| "human_intent"
		| "intent_outcome"
		| "tool_result"
		| "decision"
		| "conversation_turn"
		| "perception_signal";
	outcomeStatus?: "pending" | "achieved" | "escalated" | "failed" | "cancelled";
	toolsUsed?: string[];
	success?: boolean;
}

export interface SemanticMemoryMetadata extends BaseMemoryMetadata {
	sourceKind: "intent_outcome" | "manual_note" | "metabolism";
	factType?:
		| "outcome_summary"
		| "project_fact"
		| "user_preference"
		| "policy"
		| "generalized_pattern";
	derivedFromMemoryIds?: string[];
	confidence?: number;
}

export interface ProspectiveMemoryMetadata extends BaseMemoryMetadata {
	sourceKind: "prospective_commitment" | "decision";
	dueAt?: ISOTimestamp;
	remindAt?: ISOTimestamp;
	fulfillmentStatus?: "pending" | "scheduled" | "done" | "cancelled";
	blocking?: boolean;
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
