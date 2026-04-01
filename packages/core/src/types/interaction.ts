import type { ISOTimestamp } from "../utils/timestamp.ts";

export type InteractionPresentation =
	| "process"
	| "answer"
	| "decision"
	| "system";

export type InteractionPhase = "commentary" | "final";

export type TurnRouteKind =
	| "new_intent"
	| "thread_reply"
	| "clarification_resume"
	| "scope_update"
	| "decision_response"
	| "proactive";

export type ThreadResolutionKind = "created" | "continued" | "ambient";

export interface TurnResolutionSnapshot {
	turnId: string;
	threadId: string;
	threadTitle?: string;
	intentId?: string;
	intentSummary?: string;
	route: TurnRouteKind;
	threadResolution: ThreadResolutionKind;
	projectRoot?: string;
	projectType?: string;
	gitStatus?: string;
	focusedFile?: string;
	memoryHintCount: number;
	activeIntentCount: number;
	scopeLabelCount: number;
	approvalBoundaryCount: number;
	notes?: string[];
	createdAt: ISOTimestamp;
}

export type ProcessItemKind =
	| "trust_receipt"
	| "task_contract"
	| "plan_update"
	| "task_start"
	| "task_result"
	| "tool_call"
	| "tool_result"
	| "decision"
	| "status"
	| "worked";

export type ProcessItemStatus =
	| "info"
	| "running"
	| "completed"
	| "warning"
	| "error";

export interface ProcessItem {
	kind: ProcessItemKind;
	title: string;
	summary?: string;
	details?: string[];
	status?: ProcessItemStatus;
	taskId?: string;
	toolName?: string;
	groupKey?: string;
}

export interface AnswerArtifact {
	summary?: string;
	evidence?: string[];
	risks?: string[];
	nextSteps?: string[];
	mode?: string;
}

export interface DialogueMessageMetadata extends Record<string, unknown> {
	kind?: string;
	presentation?: InteractionPresentation;
	phase?: InteractionPhase;
	turnId?: string;
	intentId?: string;
	decisionId?: string;
	processItem?: ProcessItem;
	answerArtifact?: AnswerArtifact;
	trustReceipt?: TurnResolutionSnapshot;
}
