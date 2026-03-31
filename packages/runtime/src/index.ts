// LLM providers
export { AnthropicProvider } from "./llm/anthropic.ts";
export type { AnthropicProviderOptions } from "./llm/anthropic.ts";
export { OpenAIProvider } from "./llm/openai.ts";
export type { OpenAIProviderOptions } from "./llm/openai.ts";
export { OpenAICompatProvider } from "./llm/openai-compat.ts";
export type { OpenAICompatProviderOptions } from "./llm/openai-compat.ts";
export { ClaudeCliProvider } from "./llm/claude-cli.ts";
export type { ClaudeCliProviderOptions } from "./llm/claude-cli.ts";
export {
	StructuredGenerationEngine,
	StructuredGenerationError,
	extractJson,
} from "./llm/structured.ts";
export type {
	StructuredGenerationInput,
	StructuredOutputSpec,
	StructuredOutputStrictness,
} from "./llm/structured.ts";

// Tool system
export { ToolRegistry } from "./tools/registry.ts";
export { ToolExecutor } from "./tools/executor.ts";
export { ToolInterruptedError } from "./tools/executor.ts";
export type {
	ToolExecutionContext,
	ToolExecutionOptions,
	ToolHandlerOutput,
	ToolHandlerResult,
	ToolHandler,
} from "./tools/executor.ts";
export {
	assertCapabilities,
	assertPathAccess,
	assertDomainAccess,
} from "./tools/capability-guard.ts";
export { registerBuiltinTools } from "./tools/builtin/index.ts";

// Agent runtime
export { AgentRuntime } from "./agent/runtime.ts";
export type {
	AgentRuntimeConfig,
	AgentResult,
	RuntimeInterruptRequest,
} from "./agent/runtime.ts";
export { ContextManager } from "./agent/context.ts";
export { HeartbeatEmitter } from "./agent/heartbeat.ts";
export {
	ContextAssembler,
	renderContextForSystemPrompt,
} from "./context/assembly.ts";
export { snapshotFiles } from "./context/assembly.ts";
export type {
	ContextAssemblyInput,
	FileSnapshotEntry,
} from "./context/assembly.ts";

// Memory system
export { MemoryManager } from "./memory/manager.ts";
export { WorkingMemory } from "./memory/working.ts";
export { EpisodicMemory } from "./memory/episodic.ts";
export { SemanticMemory } from "./memory/semantic.ts";
export { MemoryService } from "./memory/service.ts";
export {
	HybridMemoryRetriever,
	LocalEmbeddingModel,
	renderMemoryHints,
} from "./memory/retrieval.ts";
export type {
	MemoryRetrievalInput,
	RetrievedMemory,
} from "./memory/retrieval.ts";
export type {
	IngestHumanIntentInput,
	IngestIntentOutcomeInput,
	IngestConversationTurnInput,
	IngestPerceptionSignalInput,
	IngestProspectiveCommitmentInput,
	MemoryContextQuery,
	MemoryServiceOptions,
} from "./memory/service.ts";
export {
	ReflectionService,
	createDefaultRelationshipBoundary,
} from "./proactive/reflection.ts";
export type {
	ReflectSignalInput,
	ReflectionOutcome,
	ReflectionServiceOptions,
} from "./proactive/reflection.ts";

// Growth engine
export { GrowthEngine } from "./growth/engine.ts";
export { TrustCalculator } from "./growth/trust.ts";
export type { TaskOutcome } from "./growth/trust.ts";
export { GrowthCheckpointManager } from "./growth/checkpoint.ts";
export { FeedbackCollector } from "./growth/feedback.ts";
export type { FeedbackSignal } from "./growth/feedback.ts";
