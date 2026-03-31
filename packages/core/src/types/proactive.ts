import type { ChannelScope } from "./channel.ts";

export type ProactiveCandidateKind =
	| "check_in"
	| "celebration"
	| "reminder"
	| "suggestion"
	| "offer"
	| "ambient_intent"
	| "protective_intervention"
	| "silent_watchpoint";

export type ProactiveCandidateUrgency = "low" | "normal" | "high";

export type ProactiveDeliveryMode =
	| "silent"
	| "async_notify"
	| "ask_first"
	| "auto_execute";

export type ProactiveCandidateStatus =
	| "candidate"
	| "queued"
	| "delivered"
	| "converted"
	| "dismissed"
	| "expired";

export interface ProactiveCandidate {
	id: string;
	kind: ProactiveCandidateKind;
	summary: string;
	messageDraft: string;
	rationale: string;
	proposedIntentText?: string;
	confidence: number;
	valueScore: number;
	interruptionCost: number;
	urgency: ProactiveCandidateUrgency;
	recommendedMode: ProactiveDeliveryMode;
	requiresApproval: boolean;
	cooldownKey?: string;
	expiresAt?: string;
	sourceSignalIds: string[];
	sourceMemoryIds: string[];
	sourceIntentIds: string[];
	sourceThreadIds: string[];
	sourceAgendaItemIds: string[];
	status: ProactiveCandidateStatus;
	scope?: ChannelScope;
	createdAt: string;
}

export type ReflectionAgendaCategory =
	| "closure"
	| "deadline"
	| "friction"
	| "progress"
	| "environment_change"
	| "wellbeing"
	| "follow_up"
	| "relationship";

export type ReflectionBudgetClass = "cheap" | "standard" | "deep";

export type ReflectionAgendaStatus =
	| "queued"
	| "leased"
	| "synthesized"
	| "dismissed"
	| "expired";

export interface ReflectionAgendaItem {
	id: string;
	category: ReflectionAgendaCategory;
	summary: string;
	drivingQuestion: string;
	priority: number;
	dedupeKey: string;
	dueAt?: string;
	cooldownUntil?: string;
	budgetClass: ReflectionBudgetClass;
	sourceSignalIds: string[];
	sourceMemoryIds: string[];
	sourceIntentIds: string[];
	sourceThreadIds: string[];
	status: ReflectionAgendaStatus;
	scope?: ChannelScope;
	createdAt: string;
}

export type ReflectionRunOutcome =
	| "no_action"
	| "candidate_emitted"
	| "deferred";

export interface ReflectionRun {
	id: string;
	agendaItemIds: string[];
	retrievedMemoryIds: string[];
	producedCandidateIds: string[];
	modelClass: "fast" | "strong";
	maxTokensBudget: number;
	tokensUsed: number;
	outcome: ReflectionRunOutcome;
	startedAt: string;
	finishedAt?: string;
}

export interface RelationshipBoundary {
	assistantStyle: {
		warmth: "low" | "balanced" | "high";
		directness: "low" | "balanced" | "high";
	};
	proactivityPolicy: {
		initiativeLevel: "minimal" | "balanced" | "high";
		allowedKinds: ProactiveCandidateKind[];
		blockedKinds: ProactiveCandidateKind[];
		requireApprovalForKinds: ProactiveCandidateKind[];
	};
	interruptionPolicy: {
		maxUnpromptedMessagesPerDay: number;
		preferredDelivery: "thread" | "notification" | "digest";
	};
	autonomyPolicy: {
		allowOffersWithoutPrompt: boolean;
		allowAmbientAutoExecution: boolean;
	};
}
