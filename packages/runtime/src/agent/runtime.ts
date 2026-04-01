import type {
	CapabilitySet,
	ContentBlock,
	Event,
	LLMMessage,
	LLMProvider,
	Logger,
	PermissionCallback,
	Task,
	ThinkingConfig,
	ToolDef,
	ToolResult,
	ToolUseBlock,
} from "@nous/core";
import { createLogger, now, prefixedId } from "@nous/core";
import type { EventStore, TaskStore } from "@nous/persistence";
import { ToolInterruptedError } from "../tools/executor.ts";
import type { ToolExecutor } from "../tools/executor.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import { ContextManager } from "./context.ts";
import { HeartbeatEmitter } from "./heartbeat.ts";

export interface AgentRuntimeConfig {
	llm: LLMProvider;
	eventStore: EventStore;
	taskStore: TaskStore;
	toolRegistry: ToolRegistry;
	toolExecutor: ToolExecutor;
	agentId: string;
	capabilities: CapabilitySet;
	maxIterations?: number;
	maxTokens?: number;
	systemPrompt?: string;
	thinkingConfig?: ThinkingConfig;
	onPermissionNeeded?: PermissionCallback;
	onRuntimeEvent?: (event: Event) => void;
}

export interface AgentResult {
	success: boolean;
	cancelled?: boolean;
	output: string;
	iterations: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	toolResults: ToolResult[];
	usedToolNames: string[];
	riskyToolNames: string[];
	rollbackPlans: NonNullable<ToolResult["rollbackPlan"]>[];
}

export interface RuntimeInterruptRequest {
	accepted: boolean;
	mode: "immediate" | "after_tool";
	activeToolName?: string;
}

interface RuntimeInterruptState {
	requestedAt: string;
	reason: string;
	mode: "immediate" | "after_tool";
}

interface ActiveToolExecution {
	tool: ToolDef;
	toolUseId: string;
	controller: AbortController;
}

/** The core ReAct execution loop for an agent */
export class AgentRuntime {
	private llm: LLMProvider;
	private eventStore: EventStore;
	private taskStore: TaskStore;
	private toolRegistry: ToolRegistry;
	private toolExecutor: ToolExecutor;
	private context: ContextManager;
	private agentId: string;
	private capabilities: CapabilitySet;
	private maxIterations: number;
	private maxTokens: number;
	private systemPrompt: string;
	private thinkingConfig?: ThinkingConfig;
	private pendingInterrupt?: RuntimeInterruptState;
	private activeToolExecution?: ActiveToolExecution;
	private currentTaskId?: string;
	private onPermissionNeeded?: PermissionCallback;
	private onRuntimeEvent?: (event: Event) => void;

	private log: Logger;

	constructor(config: AgentRuntimeConfig) {
		this.llm = config.llm;
		this.eventStore = config.eventStore;
		this.taskStore = config.taskStore;
		this.toolRegistry = config.toolRegistry;
		this.toolExecutor = config.toolExecutor;
		this.agentId = config.agentId;
		this.capabilities = config.capabilities;
		this.maxIterations = config.maxIterations ?? 25;
		this.maxTokens = config.maxTokens ?? 4096;
		this.context = new ContextManager();
		this.thinkingConfig = config.thinkingConfig;
		this.onPermissionNeeded = config.onPermissionNeeded;
		this.onRuntimeEvent = config.onRuntimeEvent;
		this.systemPrompt =
			config.systemPrompt ??
			"You are a capable agent. Complete the assigned task using the available tools. When done, provide your final answer as text (without tool calls).";
		this.log = createLogger(`agent:${config.agentId}`);
	}

	requestInterrupt(reason: string): RuntimeInterruptRequest {
		const activeTool = this.activeToolExecution?.tool;
		const mode =
			activeTool && !canInterruptToolImmediately(activeTool)
				? "after_tool"
				: "immediate";
		const next = this.pendingInterrupt ?? {
			requestedAt: now(),
			reason,
			mode,
		};
		this.pendingInterrupt = next;
		if (this.currentTaskId) {
			this.emitEvent("task.cancel_requested", "task", this.currentTaskId, {
				reason,
				mode,
			});
			if (this.activeToolExecution) {
				this.emitEvent("tool.cancel_requested", "task", this.currentTaskId, {
					toolName: this.activeToolExecution.tool.name,
					reason,
					mode,
				});
			}
		}

		if (mode === "immediate" && this.activeToolExecution) {
			this.activeToolExecution.controller.abort(reason);
		}

		return {
			accepted: true,
			mode,
			activeToolName: this.activeToolExecution?.tool.name,
		};
	}

	/** Execute a task through the ReAct loop */
	async executeTask(task: Task): Promise<AgentResult> {
		this.currentTaskId = task.id;
		const heartbeat = new HeartbeatEmitter(
			this.eventStore,
			this.agentId,
			task.id,
		);

		// Update task status to running
		this.taskStore.update(task.id, {
			status: "running",
			startedAt: now(),
			assignedAgentId: this.agentId,
			lastHeartbeat: now(),
		});

		this.emitEvent("task.started", "task", task.id, { agentId: this.agentId });
		this.log.info("Starting task execution", {
			taskId: task.id,
			description: task.description.slice(0, 80),
		});

		heartbeat.start();

		const messages: LLMMessage[] = [
			{
				role: "user",
				content: `Task: ${task.description}`,
			},
		];

		let iterations = 0;
		let totalInputTokens = 0;
		let totalOutputTokens = 0;
		const toolResults: ToolResult[] = [];

		try {
			const tools = this.toolRegistry.toLLMTools(this.capabilities);

			while (iterations < this.maxIterations) {
				iterations++;

				// Compact if needed
				if (this.context.needsCompaction()) {
					const compacted = this.context.compact(messages);
					messages.length = 0;
					messages.push(...compacted);
				}

				// Call LLM
				this.log.debug("Calling LLM", {
					iteration: iterations,
					messageCount: messages.length,
				});
				const response = await this.llm.chat({
					system: this.systemPrompt,
					messages,
					tools: tools.length > 0 ? tools : undefined,
					maxTokens: this.maxTokens,
					thinking: this.thinkingConfig,
				});

				totalInputTokens += response.usage.inputTokens;
				totalOutputTokens += response.usage.outputTokens;
				this.context.updateUsage(
					response.usage.inputTokens,
					response.usage.outputTokens,
				);

				// Emit thinking event if thinking blocks are present
				const thinkingBlocks = response.content.filter(
					(b) => b.type === "thinking",
				);
				if (thinkingBlocks.length > 0) {
					this.emitEvent("agent.thinking", "agent", this.agentId, {
						taskId: task.id,
						thinking: thinkingBlocks
							.map((b) => (b as { thinking: string }).thinking)
							.join("\n"),
						thinkingTokens: response.usage.thinkingTokens,
						iteration: iterations,
					});
				}

				// Update heartbeat
				this.taskStore.update(task.id, { lastHeartbeat: now() });

				// Add assistant message
				messages.push({ role: "assistant", content: response.content });

				if (this.pendingInterrupt) {
					heartbeat.stop();
					return this.finalizeCancelledTask(
						task,
						this.pendingInterrupt.reason,
						this.pendingInterrupt.mode,
						iterations,
						totalInputTokens,
						totalOutputTokens,
						toolResults,
					);
				}

				// Check stop reason
				if (
					response.stopReason === "end_turn" ||
					response.stopReason === "stop_sequence"
				) {
					// Agent is done — extract text output
					const textOutput = extractText(response.content);
					this.log.info("Task completed", {
						taskId: task.id,
						iterations,
						inputTokens: totalInputTokens,
						outputTokens: totalOutputTokens,
					});
					this.taskStore.update(task.id, {
						status: "done",
						completedAt: now(),
						result: textOutput,
					});
					this.emitEvent("task.completed", "task", task.id, {
						result: textOutput,
						iterations,
					});

					heartbeat.stop();
					return buildAgentResult({
						success: true,
						output: textOutput,
						iterations,
						totalInputTokens,
						totalOutputTokens,
						toolResults,
					});
				}

				if (response.stopReason === "tool_use") {
					// Execute all tool calls
					this.log.debug("Tool use requested");
					const toolUseBlocks = response.content.filter(
						(b): b is ToolUseBlock => b.type === "tool_use",
					);

					const resultBlocks: ContentBlock[] = [];

					for (const toolUse of toolUseBlocks) {
						this.log.debug("Executing tool", { tool: toolUse.name });
						const toolDef = this.toolRegistry.get(toolUse.name);
						if (!toolDef) {
							this.log.warn("Unknown tool requested", { tool: toolUse.name });
							resultBlocks.push({
								type: "tool_result",
								toolUseId: toolUse.id,
								content: `Unknown tool: ${toolUse.name}`,
								isError: true,
							});
							continue;
						}

						this.emitEvent("tool.called", "task", task.id, {
							toolName: toolUse.name,
							input: toolUse.input,
						});

						const controller = new AbortController();
						this.activeToolExecution = {
							tool: toolDef,
							toolUseId: toolUse.id,
							controller,
						};
						const currentInterrupt = this.getPendingInterrupt();
						const interruptReason = currentInterrupt?.reason;
						const interruptMode = currentInterrupt?.mode;
						if (interruptReason && canInterruptToolImmediately(toolDef)) {
							controller.abort(interruptReason);
						}

						const result = await this.toolExecutor.execute(
							toolDef,
							toolUse.input,
							this.capabilities,
							{
								signal: controller.signal,
								onPermissionNeeded: this.onPermissionNeeded,
							},
						);
						this.activeToolExecution = undefined;
						toolResults.push(result);

						if (result.interrupted) {
							this.emitEvent("tool.cancelled", "task", task.id, {
								toolName: toolUse.name,
								durationMs: result.durationMs,
								rollbackHint: result.rollbackHint,
								sideEffectClass: result.sideEffectClass,
								outputPreview: truncateForEvent(result.output),
							});
							if (interruptReason && interruptMode) {
								heartbeat.stop();
								return this.finalizeCancelledTask(
									task,
									interruptReason,
									interruptMode,
									iterations,
									totalInputTokens,
									totalOutputTokens,
									toolResults,
								);
							}
						} else {
							this.emitEvent("tool.executed", "task", task.id, {
								toolName: toolUse.name,
								success: result.success,
								durationMs: result.durationMs,
								sideEffectClass: result.sideEffectClass,
								outputPreview: truncateForEvent(result.output),
							});
						}

						resultBlocks.push({
							type: "tool_result",
							toolUseId: toolUse.id,
							content: result.output,
							isError: !result.success,
						});

						if (interruptReason && interruptMode) {
							heartbeat.stop();
							return this.finalizeCancelledTask(
								task,
								interruptReason,
								interruptMode,
								iterations,
								totalInputTokens,
								totalOutputTokens,
								toolResults,
							);
						}
					}

					messages.push({ role: "user", content: resultBlocks });
				}

				if (response.stopReason === "max_tokens") {
					// Context full — compact and continue
					const compacted = this.context.compact(messages);
					messages.length = 0;
					messages.push(...compacted);
				}
			}

			// Exceeded max iterations
			const timeoutMsg = `Agent exceeded maximum iterations (${this.maxIterations})`;
			this.taskStore.update(task.id, {
				status: "timeout",
				error: timeoutMsg,
			});
			this.emitEvent("task.timeout", "task", task.id, {
				reason: timeoutMsg,
				iterations,
			});

			heartbeat.stop();
			return {
				...buildAgentResult({
					success: false,
					output: timeoutMsg,
					iterations,
					totalInputTokens,
					totalOutputTokens,
					toolResults,
				}),
			};
		} catch (err) {
			if (err instanceof ToolInterruptedError && this.pendingInterrupt) {
				heartbeat.stop();
				return this.finalizeCancelledTask(
					task,
					this.pendingInterrupt.reason,
					this.pendingInterrupt.mode,
					iterations,
					totalInputTokens,
					totalOutputTokens,
					toolResults,
				);
			}
			const errorMsg = (err as Error).message;
			this.log.error("Task execution failed", {
				taskId: task.id,
				error: errorMsg,
				iterations,
			});
			this.taskStore.update(task.id, {
				status: "failed",
				error: errorMsg,
			});
			this.emitEvent("task.failed", "task", task.id, {
				error: errorMsg,
				iterations,
			});

			heartbeat.stop();
			return buildAgentResult({
				success: false,
				output: errorMsg,
				iterations,
				totalInputTokens,
				totalOutputTokens,
				toolResults,
			});
		} finally {
			this.currentTaskId = undefined;
			this.activeToolExecution = undefined;
			this.pendingInterrupt = undefined;
		}
	}

	private finalizeCancelledTask(
		task: Task,
		reason: string,
		mode: RuntimeInterruptState["mode"],
		iterations: number,
		totalInputTokens: number,
		totalOutputTokens: number,
		toolResults: ToolResult[],
	): AgentResult {
		const output = `Task cancelled: ${reason}`;
		this.taskStore.update(task.id, {
			status: "cancelled",
			completedAt: now(),
			error: reason,
		});
		this.emitEvent("task.cancelled", "task", task.id, {
			reason,
			mode,
			activeToolName: this.activeToolExecution?.tool.name,
		});
		return {
			...buildAgentResult({
				success: false,
				output,
				iterations,
				totalInputTokens,
				totalOutputTokens,
				toolResults,
			}),
			cancelled: true,
		};
	}

	private getPendingInterrupt(): RuntimeInterruptState | undefined {
		return this.pendingInterrupt;
	}

	private emitEvent(
		type: string,
		entityType: string,
		entityId: string,
		payload: Record<string, unknown>,
	): void {
		const event: Event = {
			id: prefixedId("evt"),
			timestamp: now(),
			type: type as Event["type"],
			entityType: entityType as Event["entityType"],
			entityId,
			payload,
			agentId: this.agentId,
		};
		this.eventStore.append(event);
		this.onRuntimeEvent?.(event);
	}
}

function extractText(content: ContentBlock[]): string {
	return content
		.filter((b) => b.type === "text")
		.map((b) => (b as { text: string }).text)
		.join("\n");
}

function canInterruptToolImmediately(tool: ToolDef): boolean {
	return (
		tool.interruptibility === "cooperative" &&
		tool.sideEffectClass === "read_only"
	);
}

function buildAgentResult(params: {
	success: boolean;
	output: string;
	iterations: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	toolResults: ToolResult[];
}): AgentResult {
	const usedToolNames = dedupeStrings(
		params.toolResults.map((result) => result.toolName),
	);
	const riskyToolNames = dedupeStrings(
		params.toolResults
			.filter((result) => result.sideEffectClass !== "read_only")
			.map((result) => result.toolName),
	);
	const rollbackPlans = params.toolResults
		.map((result) => result.rollbackPlan)
		.filter((plan): plan is NonNullable<ToolResult["rollbackPlan"]> =>
			Boolean(plan),
		);

	return {
		success: params.success,
		output: params.output,
		iterations: params.iterations,
		totalInputTokens: params.totalInputTokens,
		totalOutputTokens: params.totalOutputTokens,
		toolResults: params.toolResults,
		usedToolNames,
		riskyToolNames,
		rollbackPlans,
	};
}

function dedupeStrings(values: string[]): string[] {
	return [...new Set(values)];
}

function truncateForEvent(value: string, maxLength = 200): string {
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length <= maxLength) {
		return compact;
	}
	return `${compact.slice(0, maxLength - 3)}...`;
}
