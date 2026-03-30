import type { ISOTimestamp } from "../utils/timestamp.ts";

export type DecisionKind =
	| "clarification"
	| "approval"
	| "scope_confirmation"
	| "conflict_resolution";

export type DecisionStatus =
	| "queued"
	| "pending"
	| "answered"
	| "resolved"
	| "cancelled"
	| "superseded";

export type DecisionResponseMode = "free_text" | "single_select" | "approval";

export type DecisionOutcome =
	| "clarified"
	| "approved"
	| "rejected"
	| "scope_current_intent"
	| "scope_new_intent"
	| "conflict_queue_after_current"
	| "conflict_cancelled";

export interface DecisionOption {
	id: string;
	label: string;
	description?: string;
	value: string;
	recommended?: boolean;
}

export interface Decision {
	id: string;
	intentId: string;
	threadId: string;
	kind: DecisionKind;
	summary: string;
	questions: string[];
	status: DecisionStatus;
	responseMode: DecisionResponseMode;
	options?: DecisionOption[];
	selectedOptionId?: string;
	outcome?: DecisionOutcome;
	relatedIntentIds?: string[];
	answerText?: string;
	answerMessageId?: string;
	createdAt: ISOTimestamp;
	answeredAt?: ISOTimestamp;
	resolvedAt?: ISOTimestamp;
	metadata?: Record<string, unknown>;
}
