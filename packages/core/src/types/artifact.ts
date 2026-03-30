import type { ISOTimestamp } from "../utils/timestamp.ts";

export type ArtifactKind = "prompt_asset" | "tool" | "skill" | "harness";

export type ArtifactOwner = "system" | "user" | "evolution";

export type ArtifactRiskClass = "low" | "medium" | "high";

export type ArtifactStatus =
	| "draft"
	| "candidate"
	| "active"
	| "disabled"
	| "deprecated"
	| "revoked";

export type ArtifactValidationState =
	| "draft"
	| "candidate"
	| "validated"
	| "deprecated"
	| "revoked";

export type ArtifactScope =
	| { kind: "task"; id: string }
	| { kind: "thread"; id: string }
	| { kind: "project"; id: string }
	| { kind: "user"; id: string }
	| {
			kind: "exportable";
			policy: "review_required" | "shareable";
	  };

export type ArtifactSourceType =
	| "human"
	| "runtime"
	| "sensor"
	| "imported_instance"
	| "evolution";

export type ArtifactTrustLevel =
	| "local"
	| "reviewed"
	| "validated"
	| "external_untrusted";

export interface ArtifactRef {
	kind: ArtifactKind;
	id: string;
	version?: number;
}

export interface EvidenceRef {
	type:
		| "execution_trace"
		| "task_result"
		| "user_feedback"
		| "harness_run"
		| "eval_run"
		| "memory_entry"
		| "event";
	id: string;
}

export interface ArtifactMetric {
	name: string;
	value: number;
	unit?: string;
	window?: string;
}

export interface ArtifactProvenance {
	sourceType: ArtifactSourceType;
	sourceId: string;
	derivedFrom: string[];
	evidenceIds: string[];
	confidence: number;
	trustLevel: ArtifactTrustLevel;
	exportable: boolean;
}

export interface GovernedArtifact {
	id: string;
	kind: ArtifactKind;
	name: string;
	version: number;
	description: string;
	scope: ArtifactScope;
	provenance: ArtifactProvenance;
	validationState: ArtifactValidationState;
	owner: ArtifactOwner;
	riskClass: ArtifactRiskClass;
	status: ArtifactStatus;
	dependencies: ArtifactRef[];
	evidence: EvidenceRef[];
	metrics?: ArtifactMetric[];
	createdAt: ISOTimestamp;
	updatedAt: ISOTimestamp;
}

export interface ModelHint {
	provider?: string;
	model?: string;
	structuredOutputPreferred?: boolean;
	maxInputTokens?: number;
}

export interface PromptAsset extends GovernedArtifact {
	kind: "prompt_asset";
	template: string;
	variables: string[];
	modelHints?: ModelHint[];
	intendedUse:
		| "system"
		| "planner"
		| "tool_calling"
		| "review"
		| "subagent";
}

export type ToolSideEffectClass = "read_only" | "write" | "destructive";

export type ToolIdempotency =
	| "idempotent"
	| "best_effort"
	| "non_idempotent";

export type ToolApprovalMode = "auto" | "ask" | "deny";

export type ToolAdapterType = "builtin" | "mcp" | "evolved";

export interface ToolRetryPolicy {
	maxAttempts: number;
	backoffMs: number;
	retryOnTimeout: boolean;
	retryOnTransientError: boolean;
}

export interface ToolArtifact extends GovernedArtifact {
	kind: "tool";
	inputSchema: Record<string, unknown>;
	outputSchema?: Record<string, unknown>;
	sideEffectClass: ToolSideEffectClass;
	idempotency: ToolIdempotency;
	timeoutMs: number;
	retryPolicy?: ToolRetryPolicy;
	approvalMode: ToolApprovalMode;
	adapterType: ToolAdapterType;
	outputBudgetChars?: number;
}

export interface ArtifactCostProfile {
	estimatedInputTokens?: number;
	estimatedOutputTokens?: number;
	expectedToolCalls?: number;
}

export interface ArtifactLatencyProfile {
	p50Ms?: number;
	p95Ms?: number;
	timeoutMs?: number;
}

export interface SubagentProfileRef {
	id: string;
	name?: string;
}

export interface SkillArtifact extends GovernedArtifact {
	kind: "skill";
	triggerConditions: string[];
	applicabilityRules: string[];
	antiPatterns?: string[];
	promptAssets?: ArtifactRef[];
	preferredTools?: ArtifactRef[];
	preferredMcpServers?: ArtifactRef[];
	subagentProfile?: SubagentProfileRef;
	expectedCost?: ArtifactCostProfile;
	expectedLatency?: ArtifactLatencyProfile;
}

export type HarnessScenarioType =
	| "golden_path"
	| "regression"
	| "failure_injection"
	| "approval_flow";

export interface FixtureRef {
	type: "file" | "memory" | "event" | "message" | "artifact";
	id: string;
}

export interface AssertionRule {
	type:
		| "state_transition"
		| "artifact_created"
		| "tool_call_count"
		| "output_contains"
		| "approval_required"
		| "memory_hit"
		| "cost_budget";
	target?: string;
	expected?: unknown;
}

export interface FaultRule {
	type:
		| "tool_timeout"
		| "tool_error"
		| "mcp_disconnect"
		| "permission_denied"
		| "daemon_restart";
	target?: string;
	payload?: Record<string, unknown>;
}

export interface HarnessArtifact extends GovernedArtifact {
	kind: "harness";
	scenarioType: HarnessScenarioType;
	inputFixtures: FixtureRef[];
	expectedAssertions: AssertionRule[];
	modelPolicy?: {
		provider?: string;
		model?: string;
		temperature?: number;
	};
	toolPolicy?: {
		allowedToolIds?: string[];
		denyWriteTools?: boolean;
	};
	faultInjection?: FaultRule[];
}

export type OperationalArtifact =
	| PromptAsset
	| ToolArtifact
	| SkillArtifact
	| HarnessArtifact;
