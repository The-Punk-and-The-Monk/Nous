import type {
	CapabilitySet,
	ContentBlock,
	Event,
	LLMMessage,
	LLMProvider,
	Logger,
	Task,
	ToolUseBlock,
} from "@nous/core";
import { createLogger, now, prefixedId } from "@nous/core";
import type { EventStore, TaskStore } from "@nous/persistence";
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
}

export interface AgentResult {
	success: boolean;
	output: string;
	iterations: number;
	totalInputTokens: number;
	totalOutputTokens: number;
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
		this.systemPrompt =
			config.systemPrompt ??
			"You are a capable agent. Complete the assigned task using the available tools. When done, provide your final answer as text (without tool calls).";
		this.log = createLogger(`agent:${config.agentId}`);
	}

	/** Execute a task through the ReAct loop */
	async executeTask(task: Task): Promise<AgentResult> {
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
				});

				totalInputTokens += response.usage.inputTokens;
				totalOutputTokens += response.usage.outputTokens;
				this.context.updateUsage(
					response.usage.inputTokens,
					response.usage.outputTokens,
				);

				// Update heartbeat
				this.taskStore.update(task.id, { lastHeartbeat: now() });

				// Add assistant message
				messages.push({ role: "assistant", content: response.content });

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
					return {
						success: true,
						output: textOutput,
						iterations,
						totalInputTokens,
						totalOutputTokens,
					};
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

						const result = await this.toolExecutor.execute(
							toolDef,
							toolUse.input,
							this.capabilities,
						);

						this.emitEvent("tool.executed", "task", task.id, {
							toolName: toolUse.name,
							success: result.success,
							durationMs: result.durationMs,
						});

						resultBlocks.push({
							type: "tool_result",
							toolUseId: toolUse.id,
							content: result.output,
							isError: !result.success,
						});
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
				success: false,
				output: timeoutMsg,
				iterations,
				totalInputTokens,
				totalOutputTokens,
			};
		} catch (err) {
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
			return {
				success: false,
				output: errorMsg,
				iterations,
				totalInputTokens,
				totalOutputTokens,
			};
		}
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
	}
}

function extractText(content: ContentBlock[]): string {
	return content
		.filter((b) => b.type === "text")
		.map((b) => (b as { text: string }).text)
		.join("\n");
}
