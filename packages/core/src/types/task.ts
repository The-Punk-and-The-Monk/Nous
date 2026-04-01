import type { CognitiveOperation } from "./inference.ts";
import type { ISOTimestamp } from "../utils/timestamp.ts";

export type TaskStatus =
	| "created"
	| "queued"
	| "assigned"
	| "running"
	| "done"
	| "cancelled"
	| "failed"
	| "timeout"
	| "escalated"
	| "abandoned";

export interface Task {
	id: string;
	intentId: string;
	flowId?: string;
	planGraphId?: string;
	parentTaskId?: string;
	dependsOn: string[];

	description: string;
	assignedAgentId?: string;
	capabilitiesRequired: string[];
	cognitiveOperation?: CognitiveOperation;

	status: TaskStatus;
	retries: number;
	maxRetries: number;
	backoffSeconds: number;

	createdAt: ISOTimestamp;
	queuedAt?: ISOTimestamp;
	startedAt?: ISOTimestamp;
	lastHeartbeat?: ISOTimestamp;
	completedAt?: ISOTimestamp;

	result?: unknown;
	error?: string;
	escalationReason?: string;
}

/** Valid state transitions for the Task state machine */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
	created: ["queued", "cancelled"],
	queued: ["assigned", "cancelled"],
	assigned: ["running", "cancelled"],
	running: ["done", "cancelled", "failed", "timeout"],
	done: [],
	cancelled: [],
	failed: ["queued", "escalated", "cancelled"],
	timeout: ["queued", "escalated", "cancelled"],
	escalated: ["queued", "abandoned", "cancelled"],
	abandoned: [],
};

/** Terminal states — no further transitions possible */
export const TERMINAL_STATES: ReadonlySet<TaskStatus> = new Set([
	"done",
	"cancelled",
	"abandoned",
]);
