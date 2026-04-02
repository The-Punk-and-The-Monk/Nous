import type { Intent } from "./intent.ts";

export type PlanningDepth = "none" | "light" | "full";

export type TimeDepth = "foreground" | "background";

export type OrganizationDepth =
	| "single_agent"
	| "serial_specialists"
	| "parallel_specialists";

export type InitiativeMode = "reactive" | "proactive";

export type InterruptionPolicy = "minimal" | "risk_only" | "interactive";

export type DeliveryMode = "concise" | "structured_with_evidence";

export interface UserStateGrounding {
	summary: string;
	activeIntentSummaries: string[];
	recentMemoryHints: string[];
	permissionSummary?: string[];
	channelContext?: {
		workingDirectory?: string;
		projectRoot?: string;
		focusedFile?: string;
	};
	recentThreadMessages?: string[];
}

export interface TaskContract {
	summary: string;
	successCriteria: string[];
	boundaries: string[];
	interruptionPolicy: InterruptionPolicy;
	deliveryMode: DeliveryMode;
}

export interface ExecutionDepthDecision {
	planningDepth: PlanningDepth;
	timeDepth: TimeDepth;
	organizationDepth: OrganizationDepth;
	initiativeMode: InitiativeMode;
	rationale: string;
}

export interface TaskIntake {
	intent: Intent;
	contract: TaskContract;
	executionDepth: ExecutionDepthDecision;
	clarificationQuestions: string[];
	groundingSummary?: string;
}
