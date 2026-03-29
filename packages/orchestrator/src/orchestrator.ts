import type {
	Agent,
	CapabilitySet,
	Event,
	Intent,
	LLMProvider,
	Logger,
	Task,
} from "@nous/core";
import {
	createLogger,
	intersectCapabilities,
	now,
	prefixedId,
} from "@nous/core";
import type { EventStore, IntentStore, TaskStore } from "@nous/persistence";
import { AgentRuntime } from "@nous/runtime";
import type { AgentRuntimeConfig } from "@nous/runtime";
import {
	ToolExecutor,
	ToolRegistry,
	registerBuiltinTools,
} from "@nous/runtime";
import { IntentParser } from "./intent/parser.ts";
import { TaskPlanner } from "./planner/planner.ts";
import { AgentRouter } from "./router/router.ts";
import { TaskScheduler } from "./scheduler/scheduler.ts";

export interface OrchestratorConfig {
	llm: LLMProvider;
	eventStore: EventStore;
	taskStore: TaskStore;
	intentStore: IntentStore;
	heartbeatTimeoutMs?: number;
	pollIntervalMs?: number;
}

export interface ProgressEvent {
	type:
		| "intent.parsed"
		| "tasks.planned"
		| "task.started"
		| "task.completed"
		| "task.failed"
		| "intent.achieved"
		| "escalation";
	data: Record<string, unknown>;
}

export interface IntentExecutionOptions {
	systemPrompt?: string;
	source?: Intent["source"];
	capabilities?: CapabilitySet;
}

export class Orchestrator {
	private parser: IntentParser;
	private planner: TaskPlanner;
	private scheduler: TaskScheduler;
	private router: AgentRouter;
	private llm: LLMProvider;
	private eventStore: EventStore;
	private taskStore: TaskStore;
	private intentStore: IntentStore;
	private readonly intentExecutionOptions = new Map<
		string,
		IntentExecutionOptions
	>();
	private progressListeners: ((event: ProgressEvent) => void)[] = [];
	private log: Logger;

	constructor(config: OrchestratorConfig) {
		this.log = createLogger("orchestrator");
		this.llm = config.llm;
		this.eventStore = config.eventStore;
		this.taskStore = config.taskStore;
		this.intentStore = config.intentStore;

		this.parser = new IntentParser(config.llm);
		this.planner = new TaskPlanner(config.llm);
		this.router = new AgentRouter();

		this.scheduler = new TaskScheduler({
			taskStore: config.taskStore,
			eventStore: config.eventStore,
			heartbeatTimeoutMs: config.heartbeatTimeoutMs,
			pollIntervalMs: config.pollIntervalMs,
			onTaskReady: (task) => this.handleTaskReady(task),
			onEscalation: (task, reason) =>
				this.emitProgress({
					type: "escalation",
					data: { taskId: task.id, reason },
				}),
		});
	}

	/** Register an agent with the orchestrator */
	registerAgent(agent: Agent): void {
		this.router.register(agent);
	}

	/** Submit a natural language intent and wait for it to complete */
	async submitIntent(
		rawText: string,
		options?: IntentExecutionOptions,
	): Promise<Intent> {
		const intent = await this.submitIntentBackground(rawText, options);
		await this.waitForIntent(intent.id);
		return this.intentStore.getById(intent.id) ?? intent;
	}

	/** Submit a natural language intent and return immediately after planning */
	async submitIntentBackground(
		rawText: string,
		options?: IntentExecutionOptions,
	): Promise<Intent> {
		this.log.info("Submitting intent", { raw: rawText.slice(0, 100) });

		// 1. Parse intent
		const intent = await this.parser.parse(rawText);
		this.log.debug("Intent parsed", {
			intentId: intent.id,
			goal: intent.goal.summary,
		});
		const normalizedIntent: Intent = {
			...intent,
			source: options?.source ?? intent.source,
		};
		this.intentStore.create(normalizedIntent);
		this.intentExecutionOptions.set(normalizedIntent.id, options ?? {});
		this.emitEvent("intent.created", "intent", intent.id, { raw: rawText });
		this.emitProgress({
			type: "intent.parsed",
			data: { intentId: normalizedIntent.id, goal: normalizedIntent.goal },
		});

		// 2. Plan tasks
		const tasks = await this.planner.plan(normalizedIntent);
		for (const task of tasks) {
			this.taskStore.create(task);
			this.emitEvent("task.created", "task", task.id, {
				intentId: normalizedIntent.id,
				description: task.description,
			});
		}
		this.emitProgress({
			type: "tasks.planned",
			data: {
				intentId: normalizedIntent.id,
				taskCount: tasks.length,
				tasks: tasks.map((t) => ({ id: t.id, description: t.description })),
			},
		});

		// 3. Ensure scheduler is running, then return immediately
		this.scheduler.start();
		return normalizedIntent;
	}

	async waitForIntent(intentId: string, timeoutMs = 300000): Promise<void> {
		return new Promise<void>((resolve) => {
			const completionListener = (event: ProgressEvent) => {
				const eventIntentId = String(event.data.intentId ?? "");
				if (eventIntentId !== intentId) return;
				if (event.type === "intent.achieved" || event.type === "escalation") {
					queueMicrotask(() => {
						const idx = this.progressListeners.indexOf(completionListener);
						if (idx >= 0) this.progressListeners.splice(idx, 1);
					});
					clearTimeout(timeout);
					resolve();
				}
			};

			this.progressListeners.push(completionListener);

			const timeout = setTimeout(() => {
				const idx = this.progressListeners.indexOf(completionListener);
				if (idx >= 0) this.progressListeners.splice(idx, 1);
				resolve();
			}, timeoutMs);
		});
	}

	/** Handle a task that is ready to be assigned */
	private async handleTaskReady(task: Task): Promise<void> {
		const agent = this.router.findAgent(task);
		if (!agent) {
			this.log.debug("No agent available for task", { taskId: task.id });
			return;
		}
		this.log.info("Assigning task to agent", {
			taskId: task.id,
			agentId: agent.id,
		});

		// Assign task
		this.taskStore.update(task.id, {
			status: "assigned",
			assignedAgentId: agent.id,
		});
		this.router.updateStatus(agent.id, "working");
		this.emitEvent("task.assigned", "task", task.id, { agentId: agent.id });

		// Set up tools
		const toolRegistry = new ToolRegistry();
		const toolExecutor = new ToolExecutor();
		registerBuiltinTools(toolRegistry, toolExecutor);

		// Create runtime and execute
		const effectiveCapabilities = this.intentExecutionOptions.get(task.intentId)
			?.capabilities
			? intersectCapabilities(
					agent.capabilities,
					this.intentExecutionOptions.get(task.intentId)?.capabilities ??
						agent.capabilities,
				)
			: agent.capabilities;

		const runtime = new AgentRuntime({
			llm: this.llm,
			eventStore: this.eventStore,
			taskStore: this.taskStore,
			toolRegistry,
			toolExecutor,
			agentId: agent.id,
			capabilities: effectiveCapabilities,
			systemPrompt: this.intentExecutionOptions.get(task.intentId)
				?.systemPrompt,
		});

		this.emitProgress({
			type: "task.started",
			data: { taskId: task.id, agentId: agent.id, intentId: task.intentId },
		});

		const result = await runtime.executeTask(task);

		this.router.updateStatus(agent.id, "idle");

		if (result.success) {
			this.emitProgress({
				type: "task.completed",
				data: {
					taskId: task.id,
					output: result.output,
					intentId: task.intentId,
				},
			});
		} else {
			this.emitProgress({
				type: "task.failed",
				data: {
					taskId: task.id,
					error: result.output,
					intentId: task.intentId,
				},
			});
		}

		// Check if all tasks for this intent are done
		this.checkIntentCompletion(task.intentId);
	}

	/** Check if all tasks for an intent are done */
	private checkIntentCompletion(intentId: string): void {
		const tasks = this.taskStore.getByIntent(intentId);
		const allDone = tasks.every((t) => t.status === "done");
		const anyAbandoned = tasks.some((t) => t.status === "abandoned");

		if (allDone) {
			this.intentStore.update(intentId, {
				status: "achieved",
				achievedAt: now(),
			});
			this.intentExecutionOptions.delete(intentId);
			this.emitEvent("intent.achieved", "intent", intentId, {});
			this.emitProgress({ type: "intent.achieved", data: { intentId } });
		} else if (anyAbandoned) {
			this.intentStore.update(intentId, { status: "abandoned" });
			this.intentExecutionOptions.delete(intentId);
			this.emitEvent("intent.abandoned", "intent", intentId, {});
			this.emitProgress({
				type: "escalation",
				data: { intentId, reason: "intent_abandoned" },
			});
		}
	}

	onProgress(listener: (event: ProgressEvent) => void): void {
		this.progressListeners.push(listener);
	}

	private emitProgress(event: ProgressEvent): void {
		for (const listener of this.progressListeners) {
			listener(event);
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
		};
		this.eventStore.append(event);
	}

	stop(): void {
		this.scheduler.stop();
	}

	getRouter(): AgentRouter {
		return this.router;
	}
}
