import type { ISOTimestamp } from "../utils/timestamp.ts";

export type IntentStatus = "active" | "achieved" | "abandoned";

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

export interface Intent {
	id: string;
	raw: string;
	goal: StructuredGoal;
	constraints: Constraint[];
	priority: number;
	humanCheckpoints: CheckpointPolicy;
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
