import type {
	Agent,
	ApprovalWaitDirective,
	CancellationDirective,
	CapabilitySet,
	Event,
	ExecutionDepthDecision,
	Intent,
	IntentExecutionDirective,
	IntentRevisionApplyMode,
	IntentRevisionRecord,
	LLMProvider,
	Logger,
	PauseDirective,
	PendingIntentCancellation,
	PendingIntentPause,
	PendingIntentRevision,
	PermissionCallback,
	ResumeDirective,
	ScopeRevisionDirective,
	Task,
	TaskContract,
	UserStateGrounding,
} from "@nous/core";
import {
	createLogger,
	intersectCapabilities,
	now,
	prefixedId,
} from "@nous/core";
import type { EventStore, IntentStore, MemoryStore, TaskStore } from "@nous/persistence";
import { AgentRuntime, MemoryService } from "@nous/runtime";
import type { RuntimeInterruptRequest } from "@nous/runtime";
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
	memoryStore?: MemoryStore;
	heartbeatTimeoutMs?: number;
	pollIntervalMs?: number;
}

export interface ProgressEvent {
	type:
		| "intent.intake"
		| "intent.clarification_needed"
		| "intent.resumed"
		| "intent.revision_queued"
		| "intent.replanned"
		| "intent.pause_requested"
		| "intent.paused"
		| "intent.cancel_requested"
		| "intent.approval_requested"
		| "intent.cancelled"
		| "intent.parsed"
		| "tasks.planned"
		| "task.started"
		| "task.completed"
		| "task.cancelled"
		| "task.failed"
		| "tool.called"
		| "tool.executed"
		| "tool.cancelled"
		| "intent.achieved"
		| "escalation";
	data: Record<string, unknown>;
}

export interface IntentExecutionOptions {
	systemPrompt?: string;
	source?: Intent["source"];
	capabilities?: CapabilitySet;
	grounding?: UserStateGrounding;
	deferExecution?: boolean;
	onIntentCreated?: (intent: Intent) => void;
	onPermissionNeeded?: PermissionCallback;
}

export interface IntentScopeUpdateResult {
	intent: Intent;
	mode: IntentRevisionApplyMode;
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
	private memory?: MemoryService;
	private readonly intentExecutionOptions = new Map<
		string,
		IntentExecutionOptions
	>();
	private readonly runningRuntimes = new Map<string, AgentRuntime>();
	private progressListeners: ((event: ProgressEvent) => void)[] = [];
	private log: Logger;

	constructor(config: OrchestratorConfig) {
		this.log = createLogger("orchestrator");
		this.llm = config.llm;
		this.eventStore = config.eventStore;
		this.taskStore = config.taskStore;
		this.intentStore = config.intentStore;
		this.memory = config.memoryStore
			? new MemoryService({
					store: config.memoryStore,
					agentId: "nous",
				})
			: undefined;

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
			shouldDispatchTask: (task) => {
				const intent = this.intentStore.getById(task.intentId);
				return canDispatchIntent(intent);
			},
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

		// 1. Analyze intake + parse intent
		const intake = await this.parser.analyze(rawText, {
			grounding: options?.grounding,
			source: options?.source,
		});
		const intent: Intent = {
			...intake.intent,
			workingText: rawText,
			status:
				intake.clarificationQuestions.length > 0
					? "awaiting_clarification"
					: intake.intent.status,
		};
		this.log.debug("Intent parsed", {
			intentId: intent.id,
			goal: intent.goal.summary,
		});
		this.intentStore.create(intent);
		this.intentExecutionOptions.set(intent.id, options ?? {});
		options?.onIntentCreated?.(intent);
		this.emitEvent("intent.created", "intent", intent.id, { raw: rawText });
		this.emitProgress({
			type: "intent.intake",
			data: {
				intentId: intent.id,
				contract: intake.contract,
				executionDepth: intake.executionDepth,
				clarificationQuestions: intake.clarificationQuestions,
				groundingSummary: intake.groundingSummary,
			},
		});

		if (intake.clarificationQuestions.length > 0) {
			this.emitEvent("intent.clarification_needed", "intent", intent.id, {
				questions: intake.clarificationQuestions,
			});
			this.emitProgress({
				type: "intent.clarification_needed",
				data: {
					intentId: intent.id,
					clarificationQuestions: intake.clarificationQuestions,
				},
			});
			return intent;
		}

		if (options?.deferExecution) {
			return intent;
		}

		await this.planIntent(intent);
		return intent;
	}

	async respondToClarification(
		intentId: string,
		responseText: string,
		options?: IntentExecutionOptions,
	): Promise<Intent> {
		const existing = this.intentStore.getById(intentId);
		if (!existing) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (existing.status !== "awaiting_clarification") {
			throw new Error(`Intent ${intentId} is not awaiting clarification`);
		}

		const workingText = composeClarifiedWorkingText(existing, responseText);
		const intake = await this.parser.analyze(workingText, {
			grounding: options?.grounding,
			source: existing.source,
		});
		const nextStatus =
			intake.clarificationQuestions.length > 0
				? "awaiting_clarification"
				: "active";

		this.intentStore.update(intentId, {
			workingText,
			goal: intake.intent.goal,
			constraints: intake.intent.constraints,
			priority: intake.intent.priority,
			humanCheckpoints: intake.intent.humanCheckpoints,
			contract: intake.contract,
			executionDepth: intake.executionDepth,
			clarificationQuestions: intake.clarificationQuestions,
			status: nextStatus,
		});

		const revised = this.intentStore.getById(intentId);
		if (!revised) {
			throw new Error(`Intent ${intentId} disappeared after clarification`);
		}

		const previousOptions = this.intentExecutionOptions.get(intentId) ?? {};
		const mergedOptions = { ...previousOptions, ...(options ?? {}) };
		this.intentExecutionOptions.set(intentId, mergedOptions);

		if (nextStatus === "awaiting_clarification") {
			this.emitEvent("intent.clarification_needed", "intent", intentId, {
				questions: intake.clarificationQuestions,
				responseText,
			});
			this.emitProgress({
				type: "intent.clarification_needed",
				data: {
					intentId,
					clarificationQuestions: intake.clarificationQuestions,
				},
			});
			return revised;
		}

		this.emitEvent("intent.resumed", "intent", intentId, {
			responseText,
		});
		this.emitProgress({
			type: "intent.resumed",
			data: {
				intentId,
				contract: revised.contract,
				executionDepth: revised.executionDepth,
			},
		});

		await this.planIntent(revised);
		return this.intentStore.getById(intentId) ?? revised;
	}

	async reviseIntentBeforePlanning(
		intentId: string,
		revisionText: string,
		options?: IntentExecutionOptions,
	): Promise<Intent> {
		const existing = this.intentStore.getById(intentId);
		if (!existing) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (
			existing.status !== "active" &&
			existing.status !== "awaiting_decision"
		) {
			throw new Error(
				`Intent ${intentId} cannot be revised before planning from ${existing.status}`,
			);
		}

		const tasks = this.taskStore.getByIntent(intentId);
		if (tasks.length > 0) {
			throw new Error(
				`Intent ${intentId} already has planned tasks; pre-plan scope revision is no longer safe`,
			);
		}

		const workingText = composeScopeUpdatedWorkingText(existing, revisionText);
		const intake = await this.parser.analyze(workingText, {
			grounding: options?.grounding,
			source: existing.source,
		});
		return this.applyParsedIntentState(intentId, existing, intake, options, {
			workingText,
			pendingRevision: undefined,
		});
	}

	async applyIntentScopeUpdate(
		intentId: string,
		revisionText: string,
		options?: IntentExecutionOptions,
	): Promise<IntentScopeUpdateResult> {
		const existing = this.intentStore.getById(intentId);
		if (!existing) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (
			existing.status !== "active" &&
			existing.status !== "awaiting_decision"
		) {
			throw new Error(
				`Intent ${intentId} cannot accept a scope update from ${existing.status}`,
			);
		}
		if (existing.pendingCancellation) {
			throw new Error(
				`Intent ${intentId} already has a pending cancellation request`,
			);
		}

		const tasks = this.taskStore.getByIntent(intentId);
		if (tasks.length === 0) {
			const revisionRecord = buildIntentRevisionRecord(
				revisionText,
				"pre_plan_revise",
				"applied",
			);
			const revised = await this.reviseIntentBeforePlanning(
				intentId,
				revisionText,
				options,
			);
			this.intentStore.update(intentId, {
				revisionHistory: appendRevisionHistory(
					revised.revisionHistory,
					revisionRecord,
				),
				executionDirectives: appendExecutionDirective(
					revised.executionDirectives,
					buildScopeRevisionDirective(
						revisionText,
						revisionRecord,
						"immediate",
					),
				),
			});
			if (revised.status === "active") {
				await this.planIntent(revised);
			}
			return {
				intent: this.intentStore.getById(intentId) ?? revised,
				mode: "pre_plan_revise",
			};
		}

		const activeTasks = tasks.filter((task) =>
			["assigned", "running"].includes(task.status),
		);
		if (activeTasks.length > 0) {
			const revisionRecord = buildIntentRevisionRecord(
				revisionText,
				"deferred_replan",
				"requested",
			);
			const pendingRevision = mergePendingIntentRevision(
				existing.pendingRevision,
				revisionRecord,
				revisionText,
			);
			this.intentStore.update(intentId, {
				pendingRevision,
				revisionHistory: appendRevisionHistory(
					existing.revisionHistory,
					revisionRecord,
				),
				executionDirectives: appendExecutionDirective(
					existing.executionDirectives,
					buildScopeRevisionDirective(
						revisionText,
						revisionRecord,
						"next_execution_boundary",
					),
				),
			});
			const updated = this.intentStore.getById(intentId) ?? {
				...existing,
				pendingRevision,
			};
			this.emitEvent("intent.revision_requested", "intent", intentId, {
				applyPolicy: pendingRevision.applyPolicy,
				requestedAt: pendingRevision.requestedAt,
			});
			this.emitProgress({
				type: "intent.revision_queued",
				data: {
					intentId,
					applyPolicy: pendingRevision.applyPolicy,
					requestedAt: pendingRevision.requestedAt,
				},
			});
			return {
				intent: updated,
				mode: "deferred_replan",
			};
		}

		const revised = await this.replanIntentAtExecutionBoundary(
			intentId,
			revisionText,
			options,
			"immediate_replan",
		);
		return {
			intent: revised,
			mode: "immediate_replan",
		};
	}

	async maybeApplyPendingIntentRevisionIfSafe(
		intentId: string,
	): Promise<Intent | undefined> {
		const intent = this.intentStore.getById(intentId);
		const pendingRevision = intent?.pendingRevision;
		if (!intent || !pendingRevision) {
			return undefined;
		}
		if (intent.status !== "active" && intent.status !== "awaiting_decision") {
			return undefined;
		}
		if (intent.pendingCancellation || intent.pendingPause) {
			return undefined;
		}

		const tasks = this.taskStore.getByIntent(intentId);
		const hasActiveTask = tasks.some((task) =>
			["assigned", "running"].includes(task.status),
		);
		if (hasActiveTask) {
			return undefined;
		}

		return this.replanIntentAtExecutionBoundary(
			intentId,
			pendingRevision.revisionText,
			this.intentExecutionOptions.get(intentId),
			"deferred_replan",
		);
	}

	pauseIntent(
		intentId: string,
		reason = "Paused by user",
	): {
		intent: Intent;
		mode: "paused_immediately" | "awaiting_boundary";
	} {
		const intent = this.intentStore.getById(intentId);
		if (!intent) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (
			intent.status === "achieved" ||
			intent.status === "abandoned" ||
			intent.status === "paused"
		) {
			return {
				intent,
				mode: "paused_immediately",
			};
		}
		if (intent.pendingCancellation) {
			throw new Error(
				`Intent ${intentId} has a pending cancellation request and cannot be paused`,
			);
		}
		if (intent.pendingPause) {
			return {
				intent,
				mode:
					intent.pendingPause.mode === "after_current_task"
						? "awaiting_boundary"
						: "paused_immediately",
			};
		}

		const resumeStatus = derivePauseResumeStatus(intent.status);
		const activeTasks = this.taskStore
			.getByIntent(intentId)
			.filter((task) => ["assigned", "running"].includes(task.status));

		if (activeTasks.length > 0) {
			const pendingPause: PendingIntentPause = {
				requestedAt: now(),
				reason,
				mode: "after_current_task",
				resumeStatus,
			};
			this.intentStore.update(intentId, {
				pendingPause,
				executionDirectives: appendExecutionDirective(
					intent.executionDirectives,
					buildPauseDirective(pendingPause, "requested"),
				),
			});
			this.emitEvent("intent.pause_requested", "intent", intentId, {
				reason,
				requestedAt: pendingPause.requestedAt,
				resumeStatus,
			});
			this.emitProgress({
				type: "intent.pause_requested",
				data: {
					intentId,
					reason,
					requestedAt: pendingPause.requestedAt,
					resumeStatus,
				},
			});
			return {
				intent: this.intentStore.getById(intentId) ?? intent,
				mode: "awaiting_boundary",
			};
		}

		const requestedAt = now();
		this.intentStore.update(intentId, {
			status: "paused",
			pendingPause: undefined,
			executionDirectives: appendExecutionDirective(
				supersedeLatestRequestedApprovalWaitDirective(
					intent.executionDirectives,
					"Superseded because the intent was paused before continuation.",
				),
				buildPauseDirective(
					{
						requestedAt,
						reason,
						mode: "immediate",
						resumeStatus,
					},
					"applied",
				),
			),
		});
		this.emitEvent("intent.paused", "intent", intentId, {
			reason,
			requestedAt,
			resumeStatus,
		});
		this.emitProgress({
			type: "intent.paused",
			data: {
				intentId,
				reason,
				requestedAt,
				resumeStatus,
			},
		});
		return {
			intent: this.intentStore.getById(intentId) ?? intent,
			mode: "paused_immediately",
		};
	}

	cancelIntent(
		intentId: string,
		reason = "Cancelled by user",
	): {
		intent: Intent;
		mode: "cancelled_immediately" | "awaiting_boundary";
		runtimeInterrupts: RuntimeInterruptRequest[];
	} {
		const intent = this.intentStore.getById(intentId);
		if (!intent) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (intent.status === "achieved" || intent.status === "abandoned") {
			return {
				intent,
				mode: "cancelled_immediately",
				runtimeInterrupts: [],
			};
		}
		if (intent.pendingCancellation) {
			return {
				intent,
				mode:
					intent.pendingCancellation.mode === "after_current_boundary"
						? "awaiting_boundary"
						: "cancelled_immediately",
				runtimeInterrupts: [],
			};
		}

		const pendingCancellation: PendingIntentCancellation = {
			requestedAt: now(),
			reason,
			mode: "immediate_if_safe",
		};
		this.intentStore.update(intentId, {
			pendingCancellation,
			executionDirectives: appendExecutionDirective(
				intent.executionDirectives,
				buildCancellationDirective(pendingCancellation),
			),
		});
		this.emitEvent("intent.cancel_requested", "intent", intentId, {
			reason,
			requestedAt: pendingCancellation.requestedAt,
		});
		this.emitProgress({
			type: "intent.cancel_requested",
			data: {
				intentId,
				reason,
				requestedAt: pendingCancellation.requestedAt,
			},
		});

		const runtimeInterrupts: RuntimeInterruptRequest[] = [];
		let hasRunningTask = false;
		for (const task of this.taskStore.getByIntent(intentId)) {
			if (
				task.status === "done" ||
				task.status === "abandoned" ||
				task.status === "cancelled"
			) {
				continue;
			}

			if (task.status === "running") {
				hasRunningTask = true;
				this.emitEvent("task.cancel_requested", "task", task.id, { reason });
				const runtime = this.runningRuntimes.get(task.id);
				if (runtime) {
					runtimeInterrupts.push(runtime.requestInterrupt(reason));
				}
				continue;
			}

			if (task.status === "assigned") {
				this.cancelTaskImmediately(task, reason);
				continue;
			}

			this.cancelTaskImmediately(task, reason);
		}

		if (runtimeInterrupts.some((request) => request.mode === "after_tool")) {
			const boundaryCancellation: PendingIntentCancellation = {
				...pendingCancellation,
				mode: "after_current_boundary",
			};
			this.intentStore.update(intentId, {
				pendingCancellation: boundaryCancellation,
				executionDirectives: updateLatestCancellationDirective(
					this.intentStore.getById(intentId)?.executionDirectives,
					boundaryCancellation,
				),
			});
		}

		if (!hasRunningTask) {
			this.finalizeIntentCancellation(intentId, reason);
			return {
				intent: this.intentStore.getById(intentId) ?? intent,
				mode: "cancelled_immediately",
				runtimeInterrupts,
			};
		}

		return {
			intent: this.intentStore.getById(intentId) ?? intent,
			mode: "awaiting_boundary",
			runtimeInterrupts,
		};
	}

	async approveRiskBoundaryContinuation(
		intentId: string,
		reason = "Approval received",
	): Promise<Intent> {
		const intent = this.intentStore.getById(intentId);
		if (!intent) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (intent.pendingCancellation) {
			throw new Error(
				`Intent ${intentId} has a pending cancellation request and cannot resume`,
			);
		}
		if (
			intent.status !== "awaiting_decision" &&
			!hasRequestedApprovalWaitDirective(intent.executionDirectives)
		) {
			throw new Error(
				`Intent ${intentId} is not awaiting risky-boundary approval`,
			);
		}

		this.intentStore.update(intentId, {
			status: "active",
			executionDirectives: markLatestRequestedApprovalWaitDirectiveApplied(
				intent.executionDirectives,
			),
		});
		this.emitEvent("intent.resumed", "intent", intentId, {
			reason,
			resumeType: "approval_boundary",
		});
		this.emitProgress({
			type: "intent.resumed",
			data: {
				intentId,
				reason,
				resumeType: "approval_boundary",
				contract: intent.contract,
				executionDepth: intent.executionDepth,
			},
		});

		const revised = await this.maybeApplyPendingIntentRevisionIfSafe(intentId);
		return this.intentStore.getById(intentId) ?? revised ?? intent;
	}

	async resumeIntent(
		intentId: string,
		reason = "Resumed by user",
	): Promise<Intent> {
		const intent = this.intentStore.getById(intentId);
		if (!intent) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (intent.pendingCancellation) {
			throw new Error(
				`Intent ${intentId} has a pending cancellation request and cannot resume`,
			);
		}

		if (intent.status === "paused") {
			const nextStatus =
				findLatestAppliedPauseResumeStatus(intent.executionDirectives) ??
				"active";
			this.intentStore.update(intentId, {
				status: nextStatus,
				executionDirectives: appendExecutionDirective(
					intent.executionDirectives,
					buildResumeDirective(reason),
				),
			});
			this.emitEvent("intent.resumed", "intent", intentId, {
				reason,
				resumeType: "pause_resume",
				nextStatus,
			});
			this.emitProgress({
				type: "intent.resumed",
				data: {
					intentId,
					reason,
					resumeType: "pause_resume",
					nextStatus,
					contract: intent.contract,
					executionDepth: intent.executionDepth,
				},
			});
		}

		const revised = await this.maybeApplyPendingIntentRevisionIfSafe(intentId);
		if (revised) {
			return this.intentStore.getById(intentId) ?? revised;
		}

		const resumed = this.intentStore.getById(intentId);
		if (!resumed) {
			throw new Error(`Unknown intent: ${intentId}`);
		}
		if (resumed.status !== "active") {
			return resumed;
		}

		const tasks = this.taskStore.getByIntent(intentId);
		if (tasks.length > 0) {
			const unfinished = tasks.some((task) =>
				["created", "queued", "assigned", "running"].includes(task.status),
			);
			if (unfinished) {
				return resumed;
			}
			return resumed;
		}

		await this.planIntent(resumed);
		return this.intentStore.getById(intentId) ?? resumed;
	}

	async waitForIntent(intentId: string, timeoutMs = 300000): Promise<void> {
		return new Promise<void>((resolve) => {
			let settled = false;
			const completionListener = (event: ProgressEvent) => {
				const eventIntentId = String(event.data.intentId ?? "");
				if (eventIntentId !== intentId) return;
				if (
					event.type === "intent.achieved" ||
					event.type === "intent.cancelled" ||
					event.type === "escalation" ||
					event.type === "intent.clarification_needed" ||
					event.type === "intent.paused" ||
					event.type === "intent.approval_requested"
				) {
					finish();
				}
			};
			const timeout = setTimeout(() => {
				finish();
			}, timeoutMs);
			const finish = () => {
				if (settled) return;
				settled = true;
				const idx = this.progressListeners.indexOf(completionListener);
				if (idx >= 0) this.progressListeners.splice(idx, 1);
				clearTimeout(timeout);
				resolve();
			};

			this.progressListeners.push(completionListener);
			const existing = this.intentStore.getById(intentId);
			if (
				existing?.status === "achieved" ||
				existing?.status === "abandoned" ||
				existing?.status === "paused" ||
				existing?.status === "awaiting_clarification" ||
				existing?.status === "awaiting_decision"
			) {
				finish();
				return;
			}
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
		registerBuiltinTools(toolRegistry, toolExecutor, {
			memory: this.memory,
		});

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
			systemPrompt: mergeSystemPrompt(
				this.intentExecutionOptions.get(task.intentId)?.systemPrompt,
				this.intentStore.getById(task.intentId)?.contract,
				this.intentStore.getById(task.intentId)?.executionDepth,
			),
			onPermissionNeeded: this.intentExecutionOptions.get(task.intentId)
				?.onPermissionNeeded,
			onRuntimeEvent: (event) => this.handleRuntimeEvent(task, event),
		});
		this.runningRuntimes.set(task.id, runtime);

		this.emitProgress({
			type: "task.started",
			data: { taskId: task.id, agentId: agent.id, intentId: task.intentId },
		});

		let result: Awaited<ReturnType<AgentRuntime["executeTask"]>>;
		try {
			result = await runtime.executeTask(task);
		} finally {
			this.runningRuntimes.delete(task.id);
			this.router.updateStatus(agent.id, "idle");
		}

		if (result.success) {
			this.emitProgress({
				type: "task.completed",
				data: {
					taskId: task.id,
					taskDescription: task.description,
					output: result.output,
					usedToolNames: result.usedToolNames,
					riskyToolNames: result.riskyToolNames,
					iterations: result.iterations,
					intentId: task.intentId,
				},
			});
		} else if (result.cancelled) {
			this.emitProgress({
				type: "task.cancelled",
				data: {
					taskId: task.id,
					taskDescription: task.description,
					reason: result.output,
					usedToolNames: result.usedToolNames,
					riskyToolNames: result.riskyToolNames,
					iterations: result.iterations,
					intentId: task.intentId,
				},
			});
		} else {
			this.emitProgress({
				type: "task.failed",
				data: {
					taskId: task.id,
					taskDescription: task.description,
					error: result.output,
					usedToolNames: result.usedToolNames,
					riskyToolNames: result.riskyToolNames,
					iterations: result.iterations,
					intentId: task.intentId,
				},
			});
		}

		if (this.maybeFinalizeIntentCancellation(task.intentId)) {
			return;
		}
		if (this.maybeFinalizeIntentPause(task.intentId)) {
			return;
		}
		if (result.success) {
			const approvalWait = this.enterApprovalWaitAfterRiskBoundary(
				task.intentId,
				task.id,
				result,
			);
			if (approvalWait) {
				return;
			}
		}
		const revised = await this.maybeApplyPendingIntentRevisionIfSafe(
			task.intentId,
		);
		if (revised) {
			return;
		}

		// Check if all tasks for this intent are done
		this.checkIntentCompletion(task.intentId);
	}

	/** Check if all tasks for an intent are done */
	private checkIntentCompletion(intentId: string): void {
		if (this.maybeFinalizeIntentCancellation(intentId)) {
			return;
		}
		if (this.maybeFinalizeIntentPause(intentId)) {
			return;
		}
		const tasks = this.taskStore.getByIntent(intentId);
		const allDone = tasks.every((t) => t.status === "done");
		const anyAbandoned = tasks.some((t) => t.status === "abandoned");

		if (allDone) {
			const intent = this.intentStore.getById(intentId);
			const delivery = buildIntentDelivery(intent, tasks);
			this.intentStore.update(intentId, {
				status: "achieved",
				achievedAt: now(),
			});
			this.intentExecutionOptions.delete(intentId);
			this.emitEvent("intent.achieved", "intent", intentId, { delivery });
			this.emitProgress({
				type: "intent.achieved",
				data: { intentId, delivery },
			});
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

	private async planIntent(intent: Intent): Promise<void> {
		if (
			intent.status !== "active" ||
			intent.pendingCancellation ||
			intent.pendingPause
		) {
			return;
		}
		this.emitProgress({
			type: "intent.parsed",
			data: { intentId: intent.id, goal: intent.goal },
		});

		const tasks = await this.planner.plan(intent, {
			contract: intent.contract,
			executionDepth: intent.executionDepth,
		});
		for (const task of tasks) {
			this.taskStore.create(task);
			this.emitEvent("task.created", "task", task.id, {
				intentId: intent.id,
				description: task.description,
			});
		}
		this.emitProgress({
			type: "tasks.planned",
			data: {
				intentId: intent.id,
				taskCount: tasks.length,
				tasks: tasks.map((task) => ({
					id: task.id,
					description: task.description,
				})),
			},
		});

		this.scheduler.start();
	}

	private async replanIntentAtExecutionBoundary(
		intentId: string,
		revisionText: string,
		options?: IntentExecutionOptions,
		applyMode: IntentRevisionApplyMode = "immediate_replan",
	): Promise<Intent> {
		const existing = this.intentStore.getById(intentId);
		if (!existing) {
			throw new Error(`Unknown intent: ${intentId}`);
		}

		const tasks = this.taskStore.getByIntent(intentId);
		const hasActiveTask = tasks.some((task) =>
			["assigned", "running"].includes(task.status),
		);
		if (hasActiveTask) {
			throw new Error(
				`Intent ${intentId} still has active tasks; boundary replan is not safe yet`,
			);
		}

		const completedTaskEvidence = summarizeCompletedTasks(tasks);
		this.removeOutstandingTasks(tasks);

		const workingText = composeScopeUpdatedWorkingText(existing, revisionText, {
			completedTaskEvidence,
		});
		const intake = await this.parser.analyze(workingText, {
			grounding: options?.grounding,
			source: existing.source,
		});
		const revised = this.applyParsedIntentState(
			intentId,
			existing,
			intake,
			options,
			{
				workingText,
				pendingRevision: undefined,
				revisionHistory: buildAppliedRevisionHistory(
					existing,
					revisionText,
					applyMode,
				),
				executionDirectives: buildAppliedExecutionDirectives(
					existing,
					revisionText,
					applyMode,
				),
			},
		);

		this.emitEvent("intent.replanned", "intent", intentId, {
			revisionText,
			completedTaskCount: completedTaskEvidence.length,
		});
		this.emitProgress({
			type: "intent.replanned",
			data: {
				intentId,
				contract: revised.contract,
				executionDepth: revised.executionDepth,
				completedTaskCount: completedTaskEvidence.length,
			},
		});

		if (revised.status === "active") {
			await this.planIntent(revised);
		}
		return this.intentStore.getById(intentId) ?? revised;
	}

	private applyParsedIntentState(
		intentId: string,
		existing: Intent,
		intake: Awaited<ReturnType<IntentParser["analyze"]>>,
		options: IntentExecutionOptions | undefined,
		overrides: {
			workingText: string;
			pendingRevision?: PendingIntentRevision;
			revisionHistory?: IntentRevisionRecord[];
			executionDirectives?: IntentExecutionDirective[];
		},
	): Intent {
		const nextStatus =
			intake.clarificationQuestions.length > 0
				? "awaiting_clarification"
				: "active";

		this.intentStore.update(intentId, {
			workingText: overrides.workingText,
			goal: intake.intent.goal,
			constraints: intake.intent.constraints,
			priority: intake.intent.priority,
			humanCheckpoints: intake.intent.humanCheckpoints,
			contract: intake.contract,
			executionDepth: intake.executionDepth,
			clarificationQuestions: intake.clarificationQuestions,
			revisionHistory: overrides.revisionHistory ?? existing.revisionHistory,
			executionDirectives:
				overrides.executionDirectives ?? existing.executionDirectives,
			pendingRevision: overrides.pendingRevision,
			pendingCancellation: existing.pendingCancellation,
			pendingPause: existing.pendingPause,
			status: nextStatus,
		});

		const revised = this.intentStore.getById(intentId);
		if (!revised) {
			throw new Error(`Intent ${intentId} disappeared after scope revision`);
		}

		const previousOptions = this.intentExecutionOptions.get(intentId) ?? {};
		const mergedOptions = { ...previousOptions, ...(options ?? {}) };
		this.intentExecutionOptions.set(intentId, mergedOptions);

		if (nextStatus === "awaiting_clarification") {
			this.emitEvent("intent.clarification_needed", "intent", intentId, {
				questions: intake.clarificationQuestions,
			});
			this.emitProgress({
				type: "intent.clarification_needed",
				data: {
					intentId,
					clarificationQuestions: intake.clarificationQuestions,
				},
			});
		}

		return revised;
	}

	private removeOutstandingTasks(tasks: Task[]): void {
		for (const task of tasks) {
			if (
				task.status === "done" ||
				task.status === "abandoned" ||
				task.status === "cancelled"
			) {
				continue;
			}
			this.taskStore.delete(task.id);
		}
	}

	private cancelTaskImmediately(task: Task, reason: string): void {
		this.taskStore.update(task.id, {
			status: "cancelled",
			completedAt: now(),
			error: reason,
		});
		this.emitEvent("task.cancelled", "task", task.id, { reason });
		this.emitProgress({
			type: "task.cancelled",
			data: {
				taskId: task.id,
				intentId: task.intentId,
				reason,
			},
		});
	}

	private maybeFinalizeIntentPause(intentId: string): boolean {
		const intent = this.intentStore.getById(intentId);
		if (!intent?.pendingPause) {
			return false;
		}

		const tasks = this.taskStore.getByIntent(intentId);
		const hasActiveTask = tasks.some((task) =>
			["assigned", "running"].includes(task.status),
		);
		if (hasActiveTask) {
			return false;
		}

		this.intentStore.update(intentId, {
			status: "paused",
			pendingPause: undefined,
			executionDirectives: markLatestRequestedPauseDirectiveApplied(
				intent.executionDirectives,
			),
		});
		this.emitEvent("intent.paused", "intent", intentId, {
			reason: intent.pendingPause.reason,
			requestedAt: intent.pendingPause.requestedAt,
			resumeStatus: intent.pendingPause.resumeStatus,
		});
		this.emitProgress({
			type: "intent.paused",
			data: {
				intentId,
				reason: intent.pendingPause.reason,
				requestedAt: intent.pendingPause.requestedAt,
				resumeStatus: intent.pendingPause.resumeStatus,
			},
		});
		return true;
	}

	private enterApprovalWaitAfterRiskBoundary(
		intentId: string,
		taskId: string,
		result: Awaited<ReturnType<AgentRuntime["executeTask"]>>,
	): boolean {
		const intent = this.intentStore.getById(intentId);
		if (!intent || intent.status !== "active") {
			return false;
		}
		if (intent.pendingCancellation || intent.pendingPause) {
			return false;
		}

		const remainingTasks = this.taskStore
			.getByIntent(intentId)
			.filter((task) => !isFinishedTaskStatus(task.status));
		if (remainingTasks.length === 0) {
			return false;
		}
		if (intent.humanCheckpoints === "never") {
			return false;
		}

		const riskyResults = result.toolResults.filter(isRiskyToolResult);
		if (riskyResults.length === 0) {
			return false;
		}

		const irreversibleRisk = riskyResults.some(isIrreversibleRiskyToolResult);
		if (intent.humanCheckpoints === "irreversible_only" && !irreversibleRisk) {
			return false;
		}

		const toolNames = dedupeStrings(
			riskyResults.map((toolResult) => toolResult.toolName),
		);
		const rollbackAvailable = riskyResults.some(hasAutomaticRollbackPlan);
		const rollbackKinds = dedupeStrings(
			riskyResults
				.map((toolResult) => toolResult.rollbackPlan)
				.filter(
					(
						plan,
					): plan is NonNullable<
						Awaited<
							ReturnType<AgentRuntime["executeTask"]>
						>["toolResults"][number]["rollbackPlan"]
					> => Boolean(plan),
				)
				.map((plan) => plan.kind),
		);
		const directive = buildApprovalWaitDirective({
			taskId,
			reason:
				intent.humanCheckpoints === "always"
					? "Reached a human checkpoint after a risky task boundary."
					: "Reached an irreversible risky task boundary that requires approval before continuing.",
			toolNames,
			rollbackAvailable,
		});

		this.intentStore.update(intentId, {
			status: "awaiting_decision",
			executionDirectives: appendExecutionDirective(
				intent.executionDirectives,
				directive,
			),
		});
		this.emitEvent("intent.approval_requested", "intent", intentId, {
			taskId,
			toolNames,
			rollbackAvailable,
			rollbackKinds,
			irreversibleRisk,
		});
		this.emitProgress({
			type: "intent.approval_requested",
			data: {
				intentId,
				taskId,
				reason: directive.reason,
				toolNames,
				rollbackAvailable,
				rollbackKinds,
				irreversibleRisk,
				producer: "risky_boundary",
			},
		});
		return true;
	}

	private maybeFinalizeIntentCancellation(intentId: string): boolean {
		const intent = this.intentStore.getById(intentId);
		if (!intent?.pendingCancellation) {
			return false;
		}

		const tasks = this.taskStore.getByIntent(intentId);
		const hasRunningTask = tasks.some((task) =>
			["assigned", "running"].includes(task.status),
		);
		if (hasRunningTask) {
			return false;
		}

		this.finalizeIntentCancellation(
			intentId,
			intent.pendingCancellation.reason ?? "Cancelled by user",
		);
		return true;
	}

	private finalizeIntentCancellation(intentId: string, reason: string): void {
		const intent = this.intentStore.getById(intentId);
		for (const task of this.taskStore.getByIntent(intentId)) {
			if (
				task.status === "done" ||
				task.status === "abandoned" ||
				task.status === "cancelled"
			) {
				continue;
			}
			this.cancelTaskImmediately(task, reason);
		}

		this.intentStore.update(intentId, {
			status: "abandoned",
			pendingCancellation: undefined,
			pendingRevision: undefined,
			pendingPause: undefined,
			executionDirectives: finalizeCancellationExecutionDirectives(
				intent?.executionDirectives,
				intent?.pendingRevision?.revisionIds,
			),
		});
		this.intentExecutionOptions.delete(intentId);
		this.emitEvent("intent.cancelled", "intent", intentId, { reason });
		this.emitProgress({
			type: "intent.cancelled",
			data: { intentId, reason },
		});
	}

	private emitProgress(event: ProgressEvent): void {
		for (const listener of this.progressListeners) {
			listener(event);
		}
	}

	private handleRuntimeEvent(task: Task, event: Event): void {
		switch (event.type) {
			case "tool.called":
				this.emitProgress({
					type: "tool.called",
					data: {
						intentId: task.intentId,
						taskId: task.id,
						...(event.payload as Record<string, unknown>),
					},
				});
				return;
			case "tool.executed":
				this.emitProgress({
					type: "tool.executed",
					data: {
						intentId: task.intentId,
						taskId: task.id,
						...(event.payload as Record<string, unknown>),
					},
				});
				return;
			case "tool.cancelled":
				this.emitProgress({
					type: "tool.cancelled",
					data: {
						intentId: task.intentId,
						taskId: task.id,
						...(event.payload as Record<string, unknown>),
					},
				});
				return;
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

	start(): void {
		this.scheduler.start();
	}

	stop(): void {
		this.scheduler.stop();
	}

	getRouter(): AgentRouter {
		return this.router;
	}
}

interface IntentDelivery {
	mode: TaskContract["deliveryMode"];
	summary: string;
	evidence: string[];
	risks: string[];
	nextSteps: string[];
}

function mergeSystemPrompt(
	basePrompt: string | undefined,
	contract: TaskContract | undefined,
	executionDepth: ExecutionDepthDecision | undefined,
): string | undefined {
	const segments = [basePrompt?.trim()].filter((value): value is string =>
		Boolean(value),
	);

	if (contract) {
		segments.push(
			[
				"Task contract:",
				`- Summary: ${contract.summary}`,
				`- Success criteria: ${contract.successCriteria.join("; ") || "none specified"}`,
				`- Boundaries: ${contract.boundaries.join("; ") || "none specified"}`,
				`- Interruption policy: ${contract.interruptionPolicy}`,
				`- Delivery mode: ${contract.deliveryMode}`,
			].join("\n"),
		);
	}

	if (executionDepth) {
		segments.push(
			[
				"Execution depth:",
				`- Planning depth: ${executionDepth.planningDepth}`,
				`- Time depth: ${executionDepth.timeDepth}`,
				`- Organization depth: ${executionDepth.organizationDepth}`,
				`- Initiative mode: ${executionDepth.initiativeMode}`,
				`- Rationale: ${executionDepth.rationale}`,
			].join("\n"),
		);
	}

	if (segments.length === 0) return undefined;
	return segments.join("\n\n");
}

function buildIntentDelivery(
	intent: Intent | undefined,
	tasks: Task[],
): IntentDelivery {
	const mode = intent?.contract?.deliveryMode ?? "structured_with_evidence";
	const successfulTaskCount = tasks.filter(
		(task) => task.status === "done",
	).length;
	const evidence = tasks
		.filter((task) => task.status === "done")
		.map((task) => {
			const output = stringifyTaskResult(task.result);
			if (!output) {
				return `${task.description}`;
			}
			return `${task.description}: ${truncate(output, 220)}`;
		})
		.filter(Boolean)
		.slice(0, 5);
	const summary =
		evidence[0] ??
		(intent?.goal.summary
			? `Completed intent: ${intent.goal.summary}`
			: `Completed ${successfulTaskCount} task(s).`);
	const risks =
		evidence.length === 0
			? ["Tasks completed without captured output evidence."]
			: [];
	const nextSteps =
		intent?.executionDepth?.timeDepth === "background"
			? ["Continue monitoring for follow-up work or user feedback."]
			: [];

	return {
		mode,
		summary,
		evidence,
		risks,
		nextSteps,
	};
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}

function stringifyTaskResult(result: Task["result"]): string {
	if (typeof result === "string") {
		return result.trim();
	}
	if (result === undefined || result === null) {
		return "";
	}
	try {
		return JSON.stringify(result).trim();
	} catch {
		return String(result).trim();
	}
}

function composeClarifiedWorkingText(
	intent: Intent,
	responseText: string,
): string {
	const currentRequest = intent.workingText ?? intent.raw;
	const questions =
		intent.clarificationQuestions && intent.clarificationQuestions.length > 0
			? intent.clarificationQuestions
					.map((question) => `- ${question}`)
					.join("\n")
			: "- none recorded";

	return [
		"Original request:",
		intent.raw,
		intent.workingText && intent.workingText !== intent.raw
			? `Current executable understanding:\n${currentRequest}`
			: undefined,
		`Pending clarification questions:\n${questions}`,
		`User clarification response:\n${responseText}`,
	]
		.filter(Boolean)
		.join("\n\n");
}

function composeScopeUpdatedWorkingText(
	intent: Intent,
	revisionText: string,
	options: {
		completedTaskEvidence?: string[];
	} = {},
): string {
	const currentRequest = intent.workingText ?? intent.raw;

	return [
		"Original request:",
		intent.raw,
		intent.workingText && intent.workingText !== intent.raw
			? `Current executable understanding:\n${currentRequest}`
			: undefined,
		intent.contract?.summary
			? `Current task contract:\n${intent.contract.summary}`
			: undefined,
		options.completedTaskEvidence && options.completedTaskEvidence.length > 0
			? `Completed work already finished:\n${options.completedTaskEvidence.map((item) => `- ${item}`).join("\n")}`
			: undefined,
		`User scope update:\n${revisionText}`,
	]
		.filter(Boolean)
		.join("\n\n");
}

function summarizeCompletedTasks(tasks: Task[]): string[] {
	return tasks
		.filter((task) => task.status === "done")
		.map((task) => {
			const output = stringifyTaskResult(task.result);
			return output
				? `${task.description}: ${truncate(output, 160)}`
				: task.description;
		});
}

function mergePendingIntentRevision(
	current: PendingIntentRevision | undefined,
	record: IntentRevisionRecord,
	revisionText: string,
): PendingIntentRevision {
	const nextText = revisionText.trim();
	if (!nextText) {
		throw new Error("Scope update text cannot be empty");
	}

	if (!current) {
		return {
			kind: "scope_update",
			revisionText: nextText,
			requestedAt: now(),
			applyPolicy: "next_execution_boundary",
			revisionIds: [record.id],
		};
	}

	return {
		kind: "scope_update",
		revisionText: [
			current.revisionText.trim(),
			`Additional scope update:\n${nextText}`,
		]
			.filter(Boolean)
			.join("\n\n"),
		requestedAt: now(),
		applyPolicy: "next_execution_boundary",
		revisionIds: [...(current.revisionIds ?? []), record.id],
		sourceMessageIds: current.sourceMessageIds,
	};
}

function appendRevisionHistory(
	current: IntentRevisionRecord[] | undefined,
	record: IntentRevisionRecord,
): IntentRevisionRecord[] {
	return [...(current ?? []), record];
}

function buildIntentRevisionRecord(
	revisionText: string,
	applyMode: IntentRevisionApplyMode,
	status: IntentRevisionRecord["status"],
): IntentRevisionRecord {
	const timestamp = now();
	return {
		id: prefixedId("rev"),
		kind: "scope_update",
		requestedText: revisionText.trim(),
		requestedAt: timestamp,
		status,
		applyMode,
		appliedAt: status === "applied" ? timestamp : undefined,
	};
}

function appendExecutionDirective(
	current: IntentExecutionDirective[] | undefined,
	directive: IntentExecutionDirective,
): IntentExecutionDirective[] {
	return [...(current ?? []), directive];
}

function buildScopeRevisionDirective(
	revisionText: string,
	record: IntentRevisionRecord,
	applyPolicy: ScopeRevisionDirective["applyPolicy"],
): ScopeRevisionDirective {
	return {
		id: prefixedId("dir"),
		kind: "scope_revision",
		revisionText: revisionText.trim(),
		requestedAt: record.requestedAt,
		status: record.status,
		applyMode: record.applyMode,
		applyPolicy,
		revisionIds: [record.id],
		appliedAt: record.appliedAt,
		notes: record.notes,
	};
}

function buildCancellationDirective(
	pendingCancellation: PendingIntentCancellation,
): CancellationDirective {
	return {
		id: prefixedId("dir"),
		kind: "cancellation",
		requestedAt: pendingCancellation.requestedAt,
		status: "requested",
		reason: pendingCancellation.reason,
		mode: pendingCancellation.mode,
	};
}

function buildPauseDirective(
	pendingPause: PendingIntentPause,
	status: PauseDirective["status"],
): PauseDirective {
	return {
		id: prefixedId("dir"),
		kind: "pause",
		requestedAt: pendingPause.requestedAt,
		status,
		reason: pendingPause.reason,
		mode: pendingPause.mode,
		resumeStatus: pendingPause.resumeStatus,
		appliedAt: status === "applied" ? now() : undefined,
	};
}

function buildResumeDirective(reason?: string): ResumeDirective {
	return {
		id: prefixedId("dir"),
		kind: "resume",
		requestedAt: now(),
		status: "applied",
		reason,
		appliedAt: now(),
	};
}

function buildApprovalWaitDirective(params: {
	taskId: string;
	reason: string;
	toolNames: string[];
	rollbackAvailable: boolean;
}): ApprovalWaitDirective {
	return {
		id: prefixedId("dir"),
		kind: "approval_wait",
		requestedAt: now(),
		status: "requested",
		reason: params.reason,
		taskId: params.taskId,
		toolNames: params.toolNames,
		rollbackAvailable: params.rollbackAvailable,
	};
}

function canDispatchIntent(intent: Intent | undefined): boolean {
	if (!intent) {
		return false;
	}
	if (intent.status !== "active") {
		return false;
	}
	if (
		intent.pendingRevision ||
		intent.pendingCancellation ||
		intent.pendingPause
	) {
		return false;
	}
	return !(intent.executionDirectives ?? []).some(
		(directive) =>
			directive.status === "requested" &&
			(directive.kind === "scope_revision" ||
				directive.kind === "cancellation" ||
				directive.kind === "pause" ||
				directive.kind === "approval_wait"),
	);
}

function buildAppliedExecutionDirectives(
	intent: Intent,
	revisionText: string,
	applyMode: IntentRevisionApplyMode,
): IntentExecutionDirective[] | undefined {
	if (intent.pendingRevision?.revisionIds?.length) {
		return markScopeRevisionDirectivesApplied(
			intent.executionDirectives,
			intent.pendingRevision.revisionIds,
		);
	}

	const timestamp = now();
	return appendExecutionDirective(intent.executionDirectives, {
		id: prefixedId("dir"),
		kind: "scope_revision",
		revisionText: revisionText.trim(),
		requestedAt: timestamp,
		status: "applied",
		applyMode,
		applyPolicy: "immediate",
		appliedAt: timestamp,
	});
}

function markScopeRevisionDirectivesApplied(
	current: IntentExecutionDirective[] | undefined,
	revisionIds: string[] | undefined,
): IntentExecutionDirective[] | undefined {
	if (
		!current ||
		current.length === 0 ||
		!revisionIds ||
		revisionIds.length === 0
	) {
		return current;
	}

	const appliedAt = now();
	const revisionIdSet = new Set(revisionIds);
	return current.map((directive) => {
		if (
			directive.kind !== "scope_revision" ||
			directive.status !== "requested" ||
			!directive.revisionIds?.some((id) => revisionIdSet.has(id))
		) {
			return directive;
		}

		return {
			...directive,
			status: "applied",
			appliedAt,
		};
	});
}

function updateLatestCancellationDirective(
	current: IntentExecutionDirective[] | undefined,
	pendingCancellation: PendingIntentCancellation,
): IntentExecutionDirective[] | undefined {
	if (!current || current.length === 0) {
		return current;
	}

	let updated = false;
	return current.map((directive, index) => {
		const isTarget =
			!updated &&
			directive.kind === "cancellation" &&
			directive.status === "requested" &&
			index === findLatestRequestedDirectiveIndex(current, "cancellation");
		if (!isTarget) {
			return directive;
		}
		updated = true;
		return {
			...directive,
			reason: pendingCancellation.reason,
			mode: pendingCancellation.mode,
		};
	});
}

function findLatestRequestedDirectiveIndex(
	current: IntentExecutionDirective[],
	kind: IntentExecutionDirective["kind"],
): number {
	for (let index = current.length - 1; index >= 0; index -= 1) {
		const directive = current[index];
		if (directive?.kind === kind && directive.status === "requested") {
			return index;
		}
	}
	return -1;
}

function markLatestRequestedPauseDirectiveApplied(
	current: IntentExecutionDirective[] | undefined,
): IntentExecutionDirective[] | undefined {
	if (!current?.length) {
		return current;
	}
	const targetIndex = findLatestRequestedDirectiveIndex(current, "pause");
	if (targetIndex < 0) {
		return current;
	}
	const appliedAt = now();
	return current.map((directive, index) =>
		index === targetIndex && directive.kind === "pause"
			? {
					...directive,
					status: "applied",
					appliedAt,
				}
			: directive,
	);
}

function markLatestRequestedApprovalWaitDirectiveApplied(
	current: IntentExecutionDirective[] | undefined,
): IntentExecutionDirective[] | undefined {
	if (!current?.length) {
		return current;
	}
	const targetIndex = findLatestRequestedDirectiveIndex(
		current,
		"approval_wait",
	);
	if (targetIndex < 0) {
		return current;
	}
	const appliedAt = now();
	return current.map((directive, index) =>
		index === targetIndex && directive.kind === "approval_wait"
			? {
					...directive,
					status: "applied",
					appliedAt,
				}
			: directive,
	);
}

function supersedeLatestRequestedApprovalWaitDirective(
	current: IntentExecutionDirective[] | undefined,
	reason: string,
): IntentExecutionDirective[] | undefined {
	if (!current?.length) {
		return current;
	}
	const targetIndex = findLatestRequestedDirectiveIndex(
		current,
		"approval_wait",
	);
	if (targetIndex < 0) {
		return current;
	}
	const appliedAt = now();
	return current.map((directive, index) =>
		index === targetIndex && directive.kind === "approval_wait"
			? {
					...directive,
					status: "superseded",
					appliedAt,
					notes: appendDirectiveNote(directive.notes, reason),
				}
			: directive,
	);
}

function hasRequestedApprovalWaitDirective(
	current: IntentExecutionDirective[] | undefined,
): boolean {
	return findLatestRequestedDirectiveIndex(current ?? [], "approval_wait") >= 0;
}

function findLatestAppliedPauseResumeStatus(
	current: IntentExecutionDirective[] | undefined,
): "active" | "awaiting_clarification" | "awaiting_decision" | undefined {
	if (!current?.length) {
		return undefined;
	}
	for (let index = current.length - 1; index >= 0; index -= 1) {
		const directive = current[index];
		if (directive?.kind === "pause" && directive.status === "applied") {
			return directive.resumeStatus;
		}
	}
	return undefined;
}

function derivePauseResumeStatus(
	status: Intent["status"],
): "active" | "awaiting_clarification" | "awaiting_decision" {
	if (status === "awaiting_clarification") {
		return "awaiting_clarification";
	}
	if (status === "awaiting_decision") {
		return "awaiting_decision";
	}
	return "active";
}

function finalizeCancellationExecutionDirectives(
	current: IntentExecutionDirective[] | undefined,
	pendingRevisionIds: string[] | undefined,
): IntentExecutionDirective[] | undefined {
	if (!current || current.length === 0) {
		return current;
	}

	const appliedAt = now();
	const revisionIdSet = new Set(pendingRevisionIds ?? []);
	return current.map((directive) => {
		if (directive.kind === "cancellation" && directive.status === "requested") {
			return {
				...directive,
				status: "applied",
				appliedAt,
			};
		}

		if (
			(directive.kind === "pause" || directive.kind === "approval_wait") &&
			directive.status === "requested"
		) {
			return {
				...directive,
				status: "superseded",
				appliedAt,
				notes: appendDirectiveNote(
					directive.notes,
					"Superseded because the owning intent was cancelled.",
				),
			};
		}

		if (
			directive.kind === "scope_revision" &&
			directive.status === "requested" &&
			(revisionIdSet.size === 0 ||
				directive.revisionIds?.some((id) => revisionIdSet.has(id)))
		) {
			return {
				...directive,
				status: "superseded",
				appliedAt,
				notes: appendDirectiveNote(
					directive.notes,
					"Superseded because the owning intent was cancelled.",
				),
			};
		}

		return directive;
	});
}

function appendDirectiveNote(
	current: string[] | undefined,
	note: string,
): string[] {
	return [...(current ?? []), note];
}

function markPendingRevisionsApplied(
	history: IntentRevisionRecord[] | undefined,
	revisionIds: string[] | undefined,
): IntentRevisionRecord[] | undefined {
	if (
		!history ||
		history.length === 0 ||
		!revisionIds ||
		revisionIds.length === 0
	) {
		return history;
	}

	const appliedAt = now();
	const revisionIdSet = new Set(revisionIds);
	return history.map((record) =>
		revisionIdSet.has(record.id)
			? {
					...record,
					status: "applied",
					appliedAt,
				}
			: record,
	);
}

function buildAppliedRevisionHistory(
	intent: Intent,
	revisionText: string,
	applyMode: IntentRevisionApplyMode,
): IntentRevisionRecord[] {
	if (intent.pendingRevision?.revisionIds?.length) {
		return (
			markPendingRevisionsApplied(
				intent.revisionHistory,
				intent.pendingRevision.revisionIds,
			) ?? []
		);
	}

	return appendRevisionHistory(
		intent.revisionHistory,
		buildIntentRevisionRecord(revisionText, applyMode, "applied"),
	);
}

function isFinishedTaskStatus(taskStatus: Task["status"]): boolean {
	return (
		taskStatus === "done" ||
		taskStatus === "cancelled" ||
		taskStatus === "abandoned"
	);
}

function isRiskyToolResult(
	result: Awaited<
		ReturnType<AgentRuntime["executeTask"]>
	>["toolResults"][number],
): boolean {
	return result.sideEffectClass !== "read_only";
}

function hasAutomaticRollbackPlan(
	result: Awaited<
		ReturnType<AgentRuntime["executeTask"]>
	>["toolResults"][number],
): boolean {
	return (
		result.rollbackPlan?.kind === "restore_file" ||
		result.rollbackPlan?.kind === "delete_file"
	);
}

function isIrreversibleRiskyToolResult(
	result: Awaited<
		ReturnType<AgentRuntime["executeTask"]>
	>["toolResults"][number],
): boolean {
	if (result.sideEffectClass === "destructive") {
		return true;
	}
	if (!result.rollbackPlan) {
		return true;
	}
	return result.rollbackPlan.kind === "manual";
}

function dedupeStrings(values: string[]): string[] {
	return [...new Set(values)];
}
