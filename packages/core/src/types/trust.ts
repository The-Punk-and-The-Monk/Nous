import type { ISOTimestamp } from "../utils/timestamp.ts";
import type { CapabilitySet } from "./capability.ts";

export type MaturityStage = 0 | 1 | 2 | 3 | 4;

export interface TrustProfile {
	userId: string;
	nousInstanceId: string;

	// User → Nous trust
	reliabilityScore: number;
	judgmentScore: number;
	proactivityScore: number;

	// Derived
	overallTrust: number;
	maturityStage: MaturityStage;

	// Counters
	tasksCompleted: number;
	tasksFailed: number;

	// Timestamp
	lastUpdated: ISOTimestamp;
}

export interface StageTransition {
	id: string;
	fromStage: MaturityStage;
	toStage: MaturityStage;
	proposedAt: ISOTimestamp;
	evidence: TransitionEvidence;
	requiresHumanApproval: boolean;
}

export interface TransitionEvidence {
	tasksCompleted: number;
	reliabilityScore: number;
	judgmentScore: number;
	proactivityScore: number;
}

export interface GrowthCheckpoint {
	id: string;
	proposedStage: MaturityStage;
	evidence: TransitionEvidence;
	capabilityChanges?: {
		added: Partial<CapabilitySet>;
		removed: Partial<CapabilitySet>;
	};
	status: "proposed" | "approved" | "deferred";
}
