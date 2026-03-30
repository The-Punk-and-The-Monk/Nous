// @nous/core — Core abstractions for the Nous agent framework

// Types
export type {
	Intent,
	AmbientIntent,
	IntentStatus,
	StructuredGoal,
	Constraint,
	CheckpointPolicy,
	IntentRevisionApplyMode,
	IntentRevisionRecord,
	PendingIntentRevision,
	PendingIntentCancellation,
	PendingIntentPause,
	IntentExecutionDirectiveStatus,
	ScopeRevisionDirective,
	CancellationDirective,
	PauseDirective,
	ResumeDirective,
	ApprovalWaitDirective,
	IntentExecutionDirective,
} from "./types/intent.ts";

export type {
	Task,
	TaskStatus,
} from "./types/task.ts";
export { TASK_TRANSITIONS, TERMINAL_STATES } from "./types/task.ts";

export type {
	Agent,
	AgentRole,
	AgentStatus,
	AgentPersonality,
} from "./types/agent.ts";

export type {
	Event,
	EventType,
	EventEntityType,
} from "./types/event.ts";

export type {
	ToolDef,
	ToolResult,
	ToolInterruptibility,
	ToolRollbackPolicy,
	ToolRollbackPlan,
	RollbackExecutionResult,
} from "./types/tool.ts";

export type {
	MemoryEntry,
	MemoryTier,
	MemorySourceKind,
	MemoryProducerLayer,
	MemorySourceRefKind,
	MemorySourceRef,
	MemoryEvidenceRef,
	MemoryProvenance,
	BaseMemoryMetadata,
	EpisodicMemoryMetadata,
	SemanticMemoryMetadata,
	ProspectiveMemoryMetadata,
	ProceduralMemory,
	ProceduralStep,
} from "./types/memory.ts";

export type {
	CapabilitySet,
	CapabilityName,
} from "./types/capability.ts";
export {
	hasCapability,
	intersectCapabilities,
	DENY_ALL,
} from "./types/capability.ts";

export type {
	TrustProfile,
	MaturityStage,
	GrowthCheckpoint,
	StageTransition,
	TransitionEvidence,
} from "./types/trust.ts";

export type {
	Sensor,
	PerceptionSignal,
	AttentionResult,
} from "./types/sensor.ts";
export type {
	AssembledContext,
	EnvironmentContext,
	ProjectContext,
	UserContext,
} from "./types/context.ts";
export type {
	ExecutionTrace,
	ProcedureCandidate,
	ValidationState,
} from "./types/evolution.ts";
export type {
	PlanningDepth,
	TimeDepth,
	OrganizationDepth,
	InitiativeMode,
	InterruptionPolicy,
	DeliveryMode,
	UserStateGrounding,
	TaskContract,
	ExecutionDepthDecision,
	TaskIntake,
} from "./types/task-intake.ts";
export type {
	Decision,
	DecisionKind,
	DecisionStatus,
	DecisionResponseMode,
	DecisionOutcome,
	DecisionOption,
} from "./types/decision.ts";
export type {
	ArtifactKind,
	ArtifactOwner,
	ArtifactRiskClass,
	ArtifactStatus,
	ArtifactValidationState,
	ArtifactScope,
	ArtifactSourceType,
	ArtifactTrustLevel,
	ArtifactRef,
	EvidenceRef,
	ArtifactMetric,
	ArtifactProvenance,
	GovernedArtifact,
	ModelHint,
	PromptAsset,
	ToolSideEffectClass,
	ToolIdempotency,
	ToolApprovalMode,
	ToolAdapterType,
	ToolRetryPolicy,
	ToolArtifact,
	ArtifactCostProfile,
	ArtifactLatencyProfile,
	SubagentProfileRef,
	SkillArtifact,
	HarnessScenarioType,
	FixtureRef,
	AssertionRule,
	FaultRule,
	HarnessArtifact,
	OperationalArtifact,
} from "./types/artifact.ts";

export type {
	NousMessage,
	NousMessageType,
	CommunicationPolicy,
} from "./types/communication.ts";
export { DEFAULT_COMMUNICATION_POLICY } from "./types/communication.ts";
export type {
	DialogueThread,
	DialogueThreadStatus,
	DialogueMessage,
	DialogueRole,
	DialogueDirection,
	OutboxEntry,
	OutboxStatus,
} from "./types/dialogue.ts";
export type {
	Channel,
	ChannelType,
	ChannelStatus,
	ChannelScope,
} from "./types/channel.ts";
export type {
	ClientMessageType,
	DaemonMessageType,
	ClientEnvelope,
	DaemonEnvelope,
	AttachPayload,
	AttachAckPayload,
	SubmitIntentPayload,
	SubmitIntentAckPayload,
	SendMessagePayload,
	SendMessageAckPayload,
	ApproveDecisionPayload,
	ApproveDecisionAckPayload,
	CancelIntentPayload,
	CancelIntentAckPayload,
	ThreadSnapshot,
	GetThreadPayload,
	StatusSnapshot,
} from "./types/protocol.ts";

// State machines
export {
	transitionTask,
	canTransition,
	validTransitions,
	InvalidTransitionError,
} from "./state-machines/task-state-machine.ts";

export {
	transitionIntent,
	canTransitionIntent,
	InvalidIntentTransitionError,
} from "./state-machines/intent-state-machine.ts";

// Errors
export {
	NousError,
	CapabilityDeniedError,
	TaskNotFoundError,
	AgentNotFoundError,
	IntentNotFoundError,
	HeartbeatTimeoutError,
} from "./errors.ts";

// LLM abstractions
export type {
	LLMMessage,
	ContentBlock,
	TextBlock,
	ToolUseBlock,
	ToolResultBlock,
	LLMToolDef,
	LLMRequest,
	LLMResponseFormat,
	LLMResponse,
	LLMStructuredOutputMode,
	StreamChunk,
} from "./llm/types.ts";
export type {
	LLMProvider,
	LLMProviderCapabilities,
} from "./llm/provider.ts";
export {
	LLMError,
	RateLimitError,
	ContextOverflowError,
} from "./llm/errors.ts";

// Utilities
export { ulid, prefixedId } from "./utils/id.ts";
export { now, parse, diffMs, isOlderThan } from "./utils/timestamp.ts";
export type { ISOTimestamp } from "./utils/timestamp.ts";

// Logger
export { createLogger, setLogLevel, getLogLevel } from "./utils/logger.ts";
export type { Logger, LogLevel } from "./utils/logger.ts";
