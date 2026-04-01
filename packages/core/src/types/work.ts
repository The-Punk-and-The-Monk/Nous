import type { ISOTimestamp } from "../utils/timestamp.ts";
import type { PlanningDepth } from "./task-intake.ts";

export type FlowKind =
	| "explicit_request"
	| "proactive_followup"
	| "maintenance"
	| "ambient_watch";

export type FlowSource = "human" | "ambient" | "scheduler";

export type FlowStatus =
	| "active"
	| "blocked"
	| "quiet"
	| "completed"
	| "abandoned";

export interface Flow {
	id: string;
	kind: FlowKind;
	title: string;
	summary: string;
	ownerThreadId?: string;
	status: FlowStatus;
	source: FlowSource;
	priority: number;
	createdAt: ISOTimestamp;
	updatedAt: ISOTimestamp;
	blockedReason?: string;
	primaryIntentId?: string;
	relatedIntentIds: string[];
	relatedTaskIds: string[];
	metadata?: Record<string, unknown>;
}

export type PlanGraphTopology = "single" | "serial" | "parallel" | "dag";

export type PlanGraphStatus =
	| "draft"
	| "active"
	| "superseded"
	| "completed";

export interface PlanGraph {
	id: string;
	intentId: string;
	flowId: string;
	status: PlanGraphStatus;
	topology: PlanGraphTopology;
	planningDepth: PlanningDepth;
	createdAt: ISOTimestamp;
	updatedAt: ISOTimestamp;
	metadata?: Record<string, unknown>;
}

export type WorkObjectKind = "flow" | "intent" | "plan_graph" | "task" | "thread";

export type WorkRelationKind =
	| "hard_dependency"
	| "soft_dependency"
	| "blocks"
	| "supersedes"
	| "duplicate_candidate"
	| "same_flow"
	| "same_deliverable";

export interface WorkRelation {
	id: string;
	fromKind: WorkObjectKind;
	fromId: string;
	toKind: WorkObjectKind;
	toId: string;
	kind: WorkRelationKind;
	flowId?: string;
	planGraphId?: string;
	rationale?: string;
	confidence?: number;
	createdAt: ISOTimestamp;
	metadata?: Record<string, unknown>;
}

export type MergeCandidateAction =
	| "merge"
	| "supersede"
	| "keep_separate"
	| "link_only";

export type MergeCandidateProducer =
	| "attention_filter"
	| "reflection"
	| "conflict_analyzer"
	| "manual";

export type MergeCandidateStatus =
	| "proposed"
	| "accepted"
	| "rejected"
	| "expired";

export interface MergeCandidate {
	id: string;
	leftKind: WorkObjectKind;
	leftId: string;
	rightKind: WorkObjectKind;
	rightId: string;
	proposedAction: MergeCandidateAction;
	rationale: string;
	confidence: number;
	producedBy: MergeCandidateProducer;
	status: MergeCandidateStatus;
	createdAt: ISOTimestamp;
	metadata?: Record<string, unknown>;
}

export type FlowThreadBindingRole =
	| "primary"
	| "ambient"
	| "decision_surface"
	| "delivery_surface";

export interface FlowThreadBinding {
	flowId: string;
	threadId: string;
	role: FlowThreadBindingRole;
	createdAt: ISOTimestamp;
	metadata?: Record<string, unknown>;
}
