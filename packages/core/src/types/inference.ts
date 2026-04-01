import type { ISOTimestamp } from "../utils/timestamp.ts";

export type CognitiveOperation =
	| "control_routing"
	| "thread_scope_routing"
	| "decision_interpretation"
	| "intent_parse"
	| "task_contract"
	| "plan_generation"
	| "plan_revision"
	| "execution_main"
	| "execution_review"
	| "reflection"
	| "memory_digest"
	| "merge_assessment"
	| "media_describe_image"
	| "media_transcribe_audio"
	| "media_describe_video";

export type ModelModality =
	| "text"
	| "image"
	| "audio"
	| "video"
	| "file"
	| "screen";

export type ModelLatencyClass = "realtime" | "interactive" | "background";

export type ModelCostClass = "low" | "medium" | "high";

export type ModelTrustTier = "low" | "medium" | "high";

export interface ModelCapabilityProfile {
	id: string;
	provider: string;
	model: string;
	inputModalities: ModelModality[];
	outputModalities: ModelModality[];
	supportsTools: boolean;
	supportsStructuredOutput: boolean;
	supportsReasoningEffort: boolean;
	maxContextTokens?: number;
	maxOutputTokens?: number;
	latencyClass: ModelLatencyClass;
	costClass: ModelCostClass;
	trustTier: ModelTrustTier;
	metadata?: Record<string, unknown>;
}

export type InferenceAllocationMode =
	| "single_model"
	| "fallback_chain"
	| "serial_team"
	| "parallel_team"
	| "dag_team";

export interface InferenceWorkerAssignment {
	role: string;
	profileId: string;
	responsibility: string;
	dependsOnRoles?: string[];
}

export interface InferenceAllocationPlan {
	id: string;
	operation: CognitiveOperation;
	mode: InferenceAllocationMode;
	primaryProfileId: string;
	fallbackProfileIds?: string[];
	workerAssignments?: InferenceWorkerAssignment[];
	rationale: string;
	createdAt: ISOTimestamp;
	metadata?: Record<string, unknown>;
}
