import type { ISOTimestamp } from "../utils/timestamp.ts";
import type { ExecutionDepthDecision, TaskContract } from "./task-intake.ts";

export type IntentStatus =
	| "active"
	| "paused"
	| "awaiting_clarification"
	| "awaiting_decision"
	| "achieved"
	| "abandoned";

export interface StructuredGoal {
	summary: string;
	successCriteria: string[];
}

export interface Constraint {
	type: "forbidden_action" | "resource_limit" | "time_limit" | "scope_limit";
	description: string;
	value?: unknown;
}

export type CheckpointPolicy = "always" | "irreversible_only" | "never";

export type IntentRevisionApplyMode =
	| "pre_plan_revise"
	| "immediate_replan"
	| "deferred_replan";

export interface IntentRevisionRecord {
	id: string;
	kind: "scope_update";
	requestedText: string;
	requestedAt: ISOTimestamp;
	status: "requested" | "applied" | "superseded";
	applyMode: IntentRevisionApplyMode;
	appliedAt?: ISOTimestamp;
	notes?: string[];
}

export interface PendingIntentRevision {
	kind: "scope_update";
	revisionText: string;
	requestedAt: ISOTimestamp;
	applyPolicy: "next_execution_boundary";
	revisionIds?: string[];
	sourceMessageIds?: string[];
}

export interface PendingIntentCancellation {
	requestedAt: ISOTimestamp;
	reason?: string;
	mode: "immediate_if_safe" | "after_current_boundary";
}

export interface PendingIntentPause {
	requestedAt: ISOTimestamp;
	reason?: string;
	mode: "immediate" | "after_current_task";
	resumeStatus: "active" | "awaiting_clarification" | "awaiting_decision";
}

export type IntentExecutionDirectiveStatus =
	| "requested"
	| "applied"
	| "superseded";

interface BaseIntentExecutionDirective {
	id: string;
	requestedAt: ISOTimestamp;
	status: IntentExecutionDirectiveStatus;
	sourceMessageIds?: string[];
	notes?: string[];
	appliedAt?: ISOTimestamp;
}

export interface ScopeRevisionDirective extends BaseIntentExecutionDirective {
	kind: "scope_revision";
	revisionText: string;
	applyMode: IntentRevisionApplyMode;
	applyPolicy: "immediate" | "next_execution_boundary";
	revisionIds?: string[];
}

export interface CancellationDirective extends BaseIntentExecutionDirective {
	kind: "cancellation";
	reason?: string;
	mode: "immediate_if_safe" | "after_current_boundary";
}

export interface PauseDirective extends BaseIntentExecutionDirective {
	kind: "pause";
	reason?: string;
	mode: "immediate" | "after_current_task";
	resumeStatus: "active" | "awaiting_clarification" | "awaiting_decision";
}

export interface ResumeDirective extends BaseIntentExecutionDirective {
	kind: "resume";
	reason?: string;
}

export interface ApprovalWaitDirective extends BaseIntentExecutionDirective {
	kind: "approval_wait";
	reason: string;
	taskId?: string;
	toolNames?: string[];
	rollbackAvailable: boolean;
}

export type IntentExecutionDirective =
	| ScopeRevisionDirective
	| CancellationDirective
	| PauseDirective
	| ResumeDirective
	| ApprovalWaitDirective;

export interface Intent {
	id: string;
	flowId?: string;
	planGraphId?: string;
	sourceEnvelopeId?: string;
	raw: string;
	workingText?: string;
	goal: StructuredGoal;
	constraints: Constraint[];
	priority: number;
	humanCheckpoints: CheckpointPolicy;
	contract?: TaskContract;
	executionDepth?: ExecutionDepthDecision;
	clarificationQuestions?: string[];
	revisionHistory?: IntentRevisionRecord[];
	executionDirectives?: IntentExecutionDirective[];
	pendingRevision?: PendingIntentRevision;
	pendingCancellation?: PendingIntentCancellation;
	pendingPause?: PendingIntentPause;
	status: IntentStatus;
	source: "human" | "ambient";
	createdAt: ISOTimestamp;
	achievedAt?: ISOTimestamp;
}

export interface AmbientIntent extends Intent {
	source: "ambient";
	triggerSignalIds: string[];
	confidence: number;
	requiresApproval: boolean;
}
