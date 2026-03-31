import type { ISOTimestamp } from "../utils/timestamp.ts";

export type ValidationState = "proposed" | "validated";

export interface ExecutionTrace {
	id: string;
	intentId: string;
	threadId?: string;
	intentText: string;
	status: "achieved" | "escalated";
	projectRoot?: string;
	focusedFile?: string;
	outputs: string[];
	taskSummaries?: string[];
	usedToolNames?: string[];
	riskyToolNames?: string[];
	createdAt: ISOTimestamp;
}

export interface ProcedureCandidate {
	id: string;
	fingerprint: string;
	title: string;
	sampleIntent: string;
	attemptCount?: number;
	successCount: number;
	traceIds: string[];
	taskSummaries?: string[];
	toolNames?: string[];
	riskyToolNames?: string[];
	validationState: ValidationState;
	lastUpdatedAt: ISOTimestamp;
}
