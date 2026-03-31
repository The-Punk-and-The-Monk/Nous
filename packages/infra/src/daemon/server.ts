import { rmSync, unlinkSync, writeFileSync } from "node:fs";
import { type Socket, createServer } from "node:net";
import type {
	Channel,
	ClientEnvelope,
	DaemonEnvelope,
	Decision,
	LLMProvider,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import { Orchestrator } from "@nous/orchestrator";
import type { ProgressEvent } from "@nous/orchestrator";
import { createPersistenceBackend } from "@nous/persistence";
import {
	ContextAssembler,
	MemoryService,
	renderContextForSystemPrompt,
} from "@nous/runtime";
import { createGeneralAgent } from "../agents/general.ts";
import { loadNousConfig } from "../config/home.ts";
import {
	describePermissionBoundary,
	loadPermissionPolicy,
	resolvePermissionCapabilities,
} from "../config/permissions.ts";
import { LocalProcedureSeedStore } from "../evolution/local-procedure-seed.ts";
import { DecisionResponseInterpreter } from "../intake/decision-response-interpreter.ts";
import { buildUserStateGrounding } from "../intake/grounding.ts";
import {
	type ThreadInputDisposition,
	ThreadInputRouter,
} from "../intake/thread-input-router.ts";
import { ThreadScopeRouter } from "../intake/thread-scope-router.ts";
import { ProcessSupervisor } from "../supervisor/supervisor.ts";
import {
	type ConflictDecision,
	StaticIntentConflictManager,
} from "./conflict-manager.ts";
import { DaemonController } from "./controller.ts";
import { DialogueService } from "./dialogue-service.ts";
import { getDaemonPaths } from "./paths.ts";
import { PerceptionService } from "./perception.ts";

export interface NousDaemonOptions {
	llm: LLMProvider;
}

export class NousDaemon {
	private readonly paths = getDaemonPaths();
	private readonly nousConfig = loadNousConfig();
	private readonly backend = createPersistenceBackend(this.paths.dbPath);
	private readonly orchestrator: Orchestrator;
	private readonly dialogue: DialogueService;
	private readonly controller: DaemonController;
	private readonly supervisor: ProcessSupervisor;
	private readonly conflicts = new StaticIntentConflictManager();
	private readonly contextAssembler = new ContextAssembler();
	private readonly memory = new MemoryService({
		store: this.backend.memory,
		agentId: "nous",
	});
	private readonly perception: PerceptionService;
	private readonly threadInputRouter: ThreadInputRouter;
	private readonly threadScopeRouter: ThreadScopeRouter;
	private readonly decisionResponseInterpreter: DecisionResponseInterpreter;
	private readonly threadByIntentId = new Map<string, string>();
	private readonly intentTextById = new Map<string, string>();
	private readonly intentScopeById = new Map<string, Channel["scope"]>();
	private readonly intentOutputsById = new Map<string, string[]>();
	private readonly scheduledIntentExecutions = new Set<string>();
	private readonly procedureSeeds = new LocalProcedureSeedStore();
	private readonly sessions = new Map<Socket, ConnectionState>();
	private server?: ReturnType<typeof createServer>;
	private isShuttingDown = false;

	constructor(private readonly options: NousDaemonOptions) {
		this.orchestrator = new Orchestrator({
			llm: options.llm,
			eventStore: this.backend.events,
			taskStore: this.backend.tasks,
			intentStore: this.backend.intents,
		});
		this.orchestrator.registerAgent(createGeneralAgent());
		this.threadInputRouter = new ThreadInputRouter(options.llm);
		this.threadScopeRouter = new ThreadScopeRouter(options.llm);
		this.decisionResponseInterpreter = new DecisionResponseInterpreter(
			options.llm,
		);

		this.dialogue = new DialogueService({
			messageStore: this.backend.messages,
			intentStore: this.backend.intents,
			taskStore: this.backend.tasks,
			onSubmitIntent: (payload) => this.handleIntentSubmission(payload),
			onSendMessage: (payload) => this.handleThreadMessage(payload),
			onApproveDecision: (payload) => this.handleApproveDecision(payload),
			onCancelIntent: (payload) => this.handleCancelIntent(payload),
		});
		this.controller = new DaemonController(this.dialogue);
		this.supervisor = new ProcessSupervisor({
			taskStore: this.backend.tasks,
			eventStore: this.backend.events,
		});
		this.perception = new PerceptionService({
			eventStore: this.backend.events,
			intentStore: this.backend.intents,
			pollIntervalMs: this.nousConfig.sensors.pollIntervalMs,
			cooldownMs: this.nousConfig.sensors.cooldownMs,
			idleOnly: this.nousConfig.ambient.idleOnly,
			onPromoted: async (promotion) => {
				const rootDir = String(
					(promotion.signal.payload as { rootDir?: string }).rootDir ??
						process.cwd(),
				);
				const thread = this.dialogue.ensureThread({
					threadId: this.getAmbientThreadId(rootDir),
					title: this.getAmbientThreadTitle(rootDir),
					channelId: "daemon",
				});
				this.dialogue.enqueueAssistantMessage({
					threadId: thread.id,
					content: promotion.message,
					kind: "notification",
					metadata: {
						source: "perception",
						confidence: promotion.confidence,
						autoSubmit: promotion.autoSubmit,
					},
				});
				if (this.nousConfig.ambient.enabled && promotion.suggestedIntentText) {
					const scope = {
						workingDirectory: rootDir,
						projectRoot: rootDir,
					};
					if (this.nousConfig.ambient.autoSubmit && promotion.autoSubmit) {
						this.dialogue.enqueueAssistantMessage({
							threadId: thread.id,
							content: `Auto-submitting ambient intent: ${promotion.suggestedIntentText}`,
							kind: "notification",
							metadata: { source: "ambient_intent_strategy" },
						});
						await this.submitAmbientIntent(
							thread.id,
							promotion.suggestedIntentText,
							scope,
						);
					} else {
						await this.queueAmbientIntentForApproval(
							thread.id,
							promotion.suggestedIntentText,
							scope,
							promotion.message,
							promotion.confidence,
						);
					}
				}
				await this.flushPendingDeliveriesForThread(thread.id);
			},
		});

		this.orchestrator.onProgress((event) => this.handleProgress(event));
	}

	async start(): Promise<void> {
		cleanupSocket(this.paths.socketPath);
		this.supervisor.start();
		if (this.nousConfig.sensors.enabled) {
			this.perception.start();
		}
		writeFileSync(this.paths.pidPath, String(process.pid));

		this.server = createServer((socket) => this.handleConnection(socket));
		await this.listen();

		process.on(
			"SIGTERM",
			() => void this.shutdown().finally(() => process.exit(0)),
		);
		process.on(
			"SIGINT",
			() => void this.shutdown().finally(() => process.exit(0)),
		);
	}

	async shutdown(): Promise<void> {
		if (this.isShuttingDown) return;
		this.isShuttingDown = true;

		this.orchestrator.stop();
		this.supervisor.stop();
		if (this.nousConfig.sensors.enabled) {
			this.perception.stop();
		}

		await new Promise<void>((resolve) => {
			if (!this.server) {
				resolve();
				return;
			}
			this.server.close(() => resolve());
		});

		this.backend.close();
		this.sessions.clear();
		cleanupSocket(this.paths.socketPath);
		rmSync(this.paths.pidPath, { force: true });
		rmSync(this.paths.statePath, { force: true });
	}

	private handleConnection(socket: Socket): void {
		this.sessions.set(socket, {});
		let buffer = "";

		socket.on("data", async (chunk) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					const message = JSON.parse(trimmed) as ClientEnvelope;
					if (this.nousConfig.sensors.enabled) {
						this.perception.observeScope(message.channel.scope);
					}
					const response = await this.controller.handle(message);
					if (response) {
						this.updateSessionState(socket, message, response);
						socket.write(`${JSON.stringify(response)}\n`);
						if (message.type === "attach") {
							const threadId = getAttachedThreadId(message, response);
							await this.flushPendingDeliveries(socket, threadId);
						}
					}
				} catch (error) {
					socket.write(
						`${JSON.stringify({
							type: "error",
							timestamp: now(),
							payload: { message: (error as Error).message },
						})}\n`,
					);
				}
			}
		});

		socket.on("close", () => {
			const session = this.sessions.get(socket);
			if (session?.channelId) {
				this.dialogue.detach(session.channelId);
			}
			this.sessions.delete(socket);
		});
	}

	private handleProgress(event: ProgressEvent): void {
		const intentId = String(event.data.intentId ?? "");
		if (!intentId) return;
		const threadId = this.threadByIntentId.get(intentId);
		if (!threadId) return;
		if (event.type === "intent.approval_requested") {
			void this.handleRiskBoundaryApprovalRequested(event, threadId);
			return;
		}

		const delivery = progressEventToDelivery(event);
		if (!delivery) return;
		if (event.type === "task.completed") {
			const outputs = this.intentOutputsById.get(intentId) ?? [];
			const output = String(event.data.output ?? "").trim();
			if (output) {
				outputs.push(output);
				this.intentOutputsById.set(intentId, outputs);
			}
		}
		if (event.type === "intent.achieved" || event.type === "escalation") {
			this.storeIntentOutcomeMemory(intentId, event.type);
		}
		this.dialogue.enqueueAssistantMessage({
			threadId,
			content: delivery.content,
			kind: delivery.kind,
			metadata: { eventType: event.type, intentId },
		});
		void this.flushPendingDeliveriesForThread(threadId);
	}

	private async handleIntentSubmission(payload: {
		threadId: string;
		messageId: string;
		text: string;
		channel: Channel;
	}): Promise<void> {
		await this.startIntentExecution(payload);
	}

	private async handleApproveDecision(payload: {
		decisionId: string;
		threadId?: string;
		messageId?: string;
		approved?: boolean;
		optionId?: string;
		note?: string;
		channel: Channel;
	}): Promise<void> {
		const decision = this.backend.decisions.getById(payload.decisionId);
		if (!decision) {
			throw new Error(`Unknown decision: ${payload.decisionId}`);
		}
		if (decision.status !== "pending") {
			return;
		}

		switch (decision.kind) {
			case "clarification":
				throw new Error(
					"Clarification decisions require a text reply in the original thread",
				);
			case "approval":
				await this.handleApprovalDecisionExplicitResponse(
					decision,
					payload.approved,
					payload.messageId,
					payload.note,
					payload.channel.scope,
				);
				return;
			case "conflict_resolution":
				await this.handleConflictDecisionExplicitResponse(
					decision,
					payload.approved,
					payload.optionId,
					payload.messageId,
					payload.note,
					payload.channel.scope,
				);
				return;
			case "scope_confirmation":
				await this.handleScopeConfirmationExplicitResponse(
					decision,
					payload.optionId,
					payload.messageId,
					payload.note,
					payload.channel.scope,
				);
				return;
		}
	}

	private async handleCancelIntent(payload: {
		intentId?: string;
		threadId?: string;
		reason?: string;
		channel: Channel;
	}): Promise<void> {
		const intent =
			(payload.intentId
				? this.backend.intents.getById(payload.intentId)
				: payload.threadId
					? this.getLatestTrackedIntentForThread(payload.threadId)
					: undefined) ?? undefined;
		if (!intent) {
			throw new Error("No cancellable intent could be resolved");
		}

		await this.requestIntentCancellation({
			intentId: intent.id,
			threadId: payload.threadId ?? this.threadByIntentId.get(intent.id),
			reason: payload.reason?.trim() || "Cancelled by user",
		});
	}

	private async requestIntentCancellation(params: {
		intentId: string;
		threadId?: string;
		reason: string;
	}): Promise<void> {
		const result = this.orchestrator.cancelIntent(
			params.intentId,
			params.reason,
		);
		const threadId =
			params.threadId ?? this.threadByIntentId.get(params.intentId);
		if (threadId) {
			this.cancelOutstandingDecisionsForIntent(
				params.intentId,
				"intent_cancel_requested",
			);
			await this.activateNextQueuedDecision(threadId);
			if (result.mode === "awaiting_boundary") {
				await this.flushPendingDeliveriesForThread(threadId);
			}
		}
	}

	private async requestIntentPause(params: {
		intentId: string;
		threadId?: string;
		reason: string;
	}): Promise<void> {
		this.orchestrator.pauseIntent(params.intentId, params.reason);
		const threadId =
			params.threadId ?? this.threadByIntentId.get(params.intentId);
		if (threadId) {
			this.requeueOutstandingDecisionsForIntent(
				params.intentId,
				"intent_paused",
			);
			await this.activateNextQueuedDecision(threadId);
			await this.flushPendingDeliveriesForThread(threadId);
		}
	}

	private async requestIntentResume(params: {
		intentId: string;
		threadId?: string;
		reason: string;
	}): Promise<void> {
		const resumed = await this.orchestrator.resumeIntent(
			params.intentId,
			params.reason,
		);
		const threadId =
			params.threadId ?? this.threadByIntentId.get(params.intentId);
		if (!threadId) {
			return;
		}

		if (this.hasQueuedDecisionForIntent(threadId, params.intentId)) {
			await this.activateNextQueuedDecision(threadId);
			await this.flushPendingDeliveriesForThread(threadId);
			return;
		}

		if (resumed.status !== "active") {
			await this.flushPendingDeliveriesForThread(threadId);
			return;
		}

		const scope = this.intentScopeById.get(params.intentId);
		if (!scope) {
			await this.flushPendingDeliveriesForThread(threadId);
			return;
		}

		this.refreshTrackedIntentContext(params.intentId, threadId, scope);
		this.scheduleIntentExecution({
			intentId: params.intentId,
			threadId,
			text:
				this.intentTextById.get(params.intentId) ??
				resumed.workingText ??
				resumed.raw,
			scope,
		});
		await this.flushPendingDeliveriesForThread(threadId);
	}

	private async handleThreadMessage(payload: {
		threadId: string;
		messageId: string;
		text: string;
		channel: Channel;
	}): Promise<void> {
		const pending = this.backend.decisions.getPendingByThread(payload.threadId);
		if (pending.length === 0) {
			if (await this.tryHandleScopeSensitiveThreadMessage(payload)) {
				return;
			}
			await this.startIntentExecution(payload);
			return;
		}

		if (pending.length > 1) {
			this.dialogue.enqueueAssistantMessage({
				threadId: payload.threadId,
				content:
					"There are multiple pending decisions in this thread. Please resolve them one at a time.",
				kind: "decision_needed",
				metadata: { reason: "multiple_pending_decisions" },
			});
			await this.flushPendingDeliveriesForThread(payload.threadId);
			return;
		}

		const decision = pending[0] as Decision;
		const intent = this.backend.intents.getById(decision.intentId);
		if (!intent) {
			this.backend.decisions.update(decision.id, {
				status: "superseded",
				resolvedAt: now(),
				metadata: { reason: "missing_intent" },
			});
			await this.startIntentExecution(payload);
			return;
		}

		const routing = await this.threadInputRouter.route({
			text: payload.text,
			intent,
			decision,
			recentThreadMessages: this.backend.messages
				.getMessagesByThread(payload.threadId)
				.slice(-8)
				.map((message) => ({
					role: message.role,
					content: message.content,
				})),
		});

		if (routing.disposition === "decision_response") {
			await this.handleDecisionTextResponse(payload, decision);
			return;
		}

		if (routing.disposition === "pause_current_intent") {
			await this.requestIntentPause({
				intentId: decision.intentId,
				threadId: payload.threadId,
				reason: payload.text.trim() || "Paused by user",
			});
			return;
		}

		if (routing.disposition === "cancel_current_intent") {
			await this.requestIntentCancellation({
				intentId: decision.intentId,
				threadId: payload.threadId,
				reason: payload.text.trim() || "Cancelled by user",
			});
			return;
		}

		if (routing.disposition === "mixed" || routing.disposition === "unclear") {
			await this.handleAmbiguousThreadInput(
				payload.threadId,
				routing.disposition,
			);
			return;
		}

		await this.startIntentExecution(payload);
	}

	private async tryHandleScopeSensitiveThreadMessage(payload: {
		threadId: string;
		messageId: string;
		text: string;
		channel: Channel;
	}): Promise<boolean> {
		const controllableIntent = this.getLatestControllableIntentForThread(
			payload.threadId,
		);
		if (!controllableIntent) {
			return false;
		}

		const routing = await this.threadScopeRouter.route({
			text: payload.text,
			intent: controllableIntent,
			recentThreadMessages: this.backend.messages
				.getMessagesByThread(payload.threadId)
				.slice(-8)
				.map((message) => ({
					role: message.role,
					content: message.content,
				})),
		});

		if (routing.disposition === "new_intent") {
			return false;
		}

		if (routing.disposition === "pause_current_intent") {
			await this.requestIntentPause({
				intentId: controllableIntent.id,
				threadId: payload.threadId,
				reason: payload.text.trim() || "Paused by user",
			});
			return true;
		}

		if (routing.disposition === "resume_current_intent") {
			await this.requestIntentResume({
				intentId: controllableIntent.id,
				threadId: payload.threadId,
				reason: payload.text.trim() || "Resumed by user",
			});
			return true;
		}

		if (routing.disposition === "cancel_current_intent") {
			await this.requestIntentCancellation({
				intentId: controllableIntent.id,
				threadId: payload.threadId,
				reason: payload.text.trim() || "Cancelled by user",
			});
			return true;
		}

		if (routing.disposition === "current_intent") {
			if (controllableIntent.status === "paused") {
				this.dialogue.enqueueAssistantMessage({
					threadId: payload.threadId,
					content:
						"The current intent is paused. Say resume/继续 if you want me to continue it, or send a separate new request.",
					kind: "notification",
					metadata: {
						intentId: controllableIntent.id,
						reason: "paused_intent_needs_resume",
					},
				});
				await this.flushPendingDeliveriesForThread(payload.threadId);
				return true;
			}
			await this.applyScopeUpdateToCurrentIntent({
				intentId: controllableIntent.id,
				threadId: payload.threadId,
				messageId: payload.messageId,
				text: payload.text,
				scope: payload.channel.scope,
			});
			return true;
		}

		if (controllableIntent.status === "paused") {
			this.dialogue.enqueueAssistantMessage({
				threadId: payload.threadId,
				content:
					"The current intent is paused, so I need you to either resume it or send a clearly separate new request.",
				kind: "notification",
				metadata: {
					intentId: controllableIntent.id,
					reason: "paused_intent_ambiguous_scope",
				},
			});
			await this.flushPendingDeliveriesForThread(payload.threadId);
			return true;
		}

		this.backend.intents.update(controllableIntent.id, {
			status: "awaiting_decision",
		});
		await this.createScopeConfirmationDecision(
			controllableIntent,
			payload,
			routing.rationale,
		);
		return true;
	}

	private async startIntentExecution(payload: {
		threadId: string;
		messageId: string;
		text: string;
		channel: Channel;
	}): Promise<void> {
		const executionContext = this.buildExecutionContext(payload);
		this.dialogue.enqueueAssistantMessage({
			threadId: payload.threadId,
			content: `Context assembled for ${executionContext.assembledContext.project.rootDir} (${executionContext.assembledContext.project.type}, git: ${executionContext.assembledContext.project.gitStatus ?? "unknown"}).`,
			kind: "notification",
			metadata: {
				source: "context_assembly",
				projectRoot: executionContext.assembledContext.project.rootDir,
			},
		});
		await this.flushPendingDeliveriesForThread(payload.threadId);

		const intent = await this.orchestrator.submitIntentBackground(
			payload.text,
			{
				systemPrompt: executionContext.systemPrompt,
				capabilities: executionContext.permissionCapabilities,
				grounding: executionContext.grounding,
				deferExecution: true,
				onIntentCreated: (intent) =>
					this.trackIntentForThread(
						intent.id,
						payload.threadId,
						payload.text,
						payload.channel.scope,
					),
			},
		);

		this.storeIntentRequestMemory({
			...payload,
			intentId: intent.id,
		});

		if (intent.status === "awaiting_clarification") {
			await this.createClarificationDecision(intent, payload.threadId);
			return;
		}

		const conflict = this.conflicts.analyze({
			intentId: intent.id,
			text: payload.text,
			scope: payload.channel.scope,
		});
		if (conflict.requiresReview && conflict.verdict === "conflicting") {
			this.backend.intents.update(intent.id, { status: "awaiting_decision" });
			await this.createConflictResolutionDecision(
				intent,
				payload.threadId,
				conflict,
			);
			return;
		}

		this.scheduleIntentExecution({
			intentId: intent.id,
			threadId: payload.threadId,
			text: payload.text,
			scope: payload.channel.scope,
		});
	}

	private async handleDecisionTextResponse(
		payload: {
			threadId: string;
			messageId: string;
			text: string;
			channel: Channel;
		},
		decision: Decision,
	): Promise<void> {
		switch (decision.kind) {
			case "clarification":
				await this.handleClarificationDecisionResponse(payload, decision);
				return;
			case "approval":
				await this.handleApprovalDecisionTextResponse(payload, decision);
				return;
			case "conflict_resolution":
				await this.handleConflictDecisionTextResponse(payload, decision);
				return;
			case "scope_confirmation":
				await this.handleScopeConfirmationTextResponse(payload, decision);
				return;
		}
	}

	private async handleClarificationDecisionResponse(
		payload: {
			threadId: string;
			messageId: string;
			text: string;
			channel: Channel;
		},
		decision: Decision,
	): Promise<void> {
		this.backend.decisions.update(decision.id, {
			status: "answered",
			answerText: payload.text,
			answerMessageId: payload.messageId,
			answeredAt: now(),
		});

		const executionContext = this.buildExecutionContext(payload);
		const intent = await this.orchestrator.respondToClarification(
			decision.intentId,
			payload.text,
			{
				systemPrompt: executionContext.systemPrompt,
				capabilities: executionContext.permissionCapabilities,
				grounding: executionContext.grounding,
			},
		);

		if (intent.status === "awaiting_clarification") {
			this.backend.decisions.update(decision.id, {
				status: "superseded",
				resolvedAt: now(),
			});
			await this.createClarificationDecision(intent, payload.threadId);
			return;
		}

		this.backend.decisions.update(decision.id, {
			status: "resolved",
			resolvedAt: now(),
			outcome: "clarified",
		});
		this.refreshTrackedIntentContext(
			intent.id,
			payload.threadId,
			payload.channel.scope,
		);
		await this.activateNextQueuedDecision(payload.threadId);
		void this.orchestrator.waitForIntent(intent.id).catch((error) => {
			this.dialogue.enqueueAssistantMessage({
				threadId: payload.threadId,
				content: `Intent resume failed: ${(error as Error).message}`,
				kind: "notification",
				metadata: { reason: "intent_resume_failed", intentId: intent.id },
			});
			void this.flushPendingDeliveriesForThread(payload.threadId);
		});
	}

	private async handleApprovalDecisionTextResponse(
		payload: {
			threadId: string;
			messageId: string;
			text: string;
			channel: Channel;
		},
		decision: Decision,
	): Promise<void> {
		const interpreted = await this.decisionResponseInterpreter.interpret({
			decision,
			text: payload.text,
		});
		if (interpreted.resolution === "approved") {
			await this.resolveApprovalDecision(
				decision,
				true,
				payload.text,
				payload.messageId,
				payload.channel.scope,
			);
			return;
		}
		if (interpreted.resolution === "rejected") {
			await this.resolveApprovalDecision(
				decision,
				false,
				payload.text,
				payload.messageId,
				payload.channel.scope,
			);
			return;
		}
		await this.promptDecisionRetry(
			decision,
			"I still need a clear approval response. Please reply yes/no, or use approve_decision.",
		);
	}

	private async handleApprovalDecisionExplicitResponse(
		decision: Decision,
		approved: boolean | undefined,
		messageId: string | undefined,
		answerText: string | undefined,
		scope: Channel["scope"],
	): Promise<void> {
		if (approved === undefined) {
			throw new Error("Approval decisions require approved=true/false");
		}
		await this.resolveApprovalDecision(
			decision,
			approved,
			answerText,
			messageId,
			scope,
		);
	}

	private async resolveApprovalDecision(
		decision: Decision,
		approved: boolean,
		answerText: string | undefined,
		answerMessageId: string | undefined,
		scope: Channel["scope"],
	): Promise<void> {
		this.backend.decisions.update(decision.id, {
			status: "answered",
			answerText,
			answerMessageId,
			answeredAt: now(),
			selectedOptionId: approved ? "approve" : "reject",
			outcome: approved ? "approved" : "rejected",
		});
		this.backend.decisions.update(decision.id, {
			status: "resolved",
			resolvedAt: now(),
			selectedOptionId: approved ? "approve" : "reject",
			outcome: approved ? "approved" : "rejected",
		});

		const rejectionPolicy =
			typeof decision.metadata?.rejectionPolicy === "string"
				? decision.metadata.rejectionPolicy
				: undefined;
		const approvalProducer =
			typeof decision.metadata?.producer === "string"
				? decision.metadata.producer
				: undefined;

		if (approved) {
			if (approvalProducer === "risky_boundary") {
				await this.orchestrator.approveRiskBoundaryContinuation(
					decision.intentId,
					answerText,
				);
			} else {
				this.backend.intents.update(decision.intentId, { status: "active" });
			}
			this.refreshTrackedIntentContext(
				decision.intentId,
				decision.threadId,
				scope,
			);
			this.dialogue.enqueueAssistantMessage({
				threadId: decision.threadId,
				content: "Approval received. Continuing the intent.",
				kind: "notification",
				metadata: { decisionId: decision.id, intentId: decision.intentId },
			});
			await this.flushPendingDeliveriesForThread(decision.threadId);
			this.scheduleIntentExecution({
				intentId: decision.intentId,
				threadId: decision.threadId,
				text:
					this.intentTextById.get(decision.intentId) ??
					this.backend.intents.getById(decision.intentId)?.raw ??
					answerText ??
					"",
				scope,
			});
			await this.activateNextQueuedDecision(decision.threadId);
			return;
		}

		if (rejectionPolicy === "pause_intent") {
			await this.requestIntentPause({
				intentId: decision.intentId,
				threadId: decision.threadId,
				reason:
					answerText?.trim() ||
					"Paused because continuation approval was not granted",
			});
			return;
		}

		await this.finalizeAbandonedIntent(
			decision.intentId,
			decision.threadId,
			"Approval rejected. I will not continue that intent.",
		);
	}

	private async handleConflictDecisionTextResponse(
		payload: {
			threadId: string;
			messageId: string;
			text: string;
			channel: Channel;
		},
		decision: Decision,
	): Promise<void> {
		const interpreted = await this.decisionResponseInterpreter.interpret({
			decision,
			text: payload.text,
		});
		if (
			interpreted.resolution !== "selected" ||
			!interpreted.selectedOptionId
		) {
			await this.promptDecisionRetry(
				decision,
				"I still need a conflict-resolution choice. Please choose one of the listed options, or use approve_decision.",
			);
			return;
		}
		await this.resolveConflictDecision(
			decision,
			interpreted.selectedOptionId,
			payload.text,
			payload.messageId,
			payload.channel.scope,
		);
	}

	private async handleConflictDecisionExplicitResponse(
		decision: Decision,
		approved: boolean | undefined,
		optionId: string | undefined,
		messageId: string | undefined,
		answerText: string | undefined,
		scope: Channel["scope"],
	): Promise<void> {
		const selectedOptionId =
			optionId ??
			(approved === true
				? "queue_after_current"
				: approved === false
					? "cancel_new_intent"
					: undefined);
		if (!selectedOptionId) {
			throw new Error(
				"Conflict-resolution decisions require optionId or approved=true/false",
			);
		}
		await this.resolveConflictDecision(
			decision,
			selectedOptionId,
			answerText,
			messageId,
			scope,
		);
	}

	private async resolveConflictDecision(
		decision: Decision,
		selectedOptionId: string,
		answerText: string | undefined,
		answerMessageId: string | undefined,
		scope: Channel["scope"],
	): Promise<void> {
		const validOptionIds = new Set(
			(decision.options ?? []).map((option) => option.id),
		);
		if (!validOptionIds.has(selectedOptionId)) {
			await this.promptDecisionRetry(
				decision,
				"That option does not match the current conflict-resolution choices.",
			);
			return;
		}

		const outcome =
			selectedOptionId === "queue_after_current"
				? "conflict_queue_after_current"
				: "conflict_cancelled";
		this.backend.decisions.update(decision.id, {
			status: "answered",
			answerText,
			answerMessageId,
			answeredAt: now(),
			selectedOptionId,
			outcome,
		});
		this.backend.decisions.update(decision.id, {
			status: "resolved",
			resolvedAt: now(),
			selectedOptionId,
			outcome,
		});

		if (selectedOptionId === "queue_after_current") {
			this.backend.intents.update(decision.intentId, { status: "active" });
			this.refreshTrackedIntentContext(
				decision.intentId,
				decision.threadId,
				scope,
			);
			this.dialogue.enqueueAssistantMessage({
				threadId: decision.threadId,
				content:
					"Conflict acknowledged. I will keep the new intent queued behind the active work.",
				kind: "notification",
				metadata: { decisionId: decision.id, intentId: decision.intentId },
			});
			await this.flushPendingDeliveriesForThread(decision.threadId);
			this.scheduleIntentExecution({
				intentId: decision.intentId,
				threadId: decision.threadId,
				text:
					this.intentTextById.get(decision.intentId) ??
					this.backend.intents.getById(decision.intentId)?.raw ??
					answerText ??
					"",
				scope,
			});
			await this.activateNextQueuedDecision(decision.threadId);
			return;
		}

		await this.finalizeAbandonedIntent(
			decision.intentId,
			decision.threadId,
			"Understood. I will drop the new conflicting intent instead of queuing it.",
		);
	}

	private async handleScopeConfirmationTextResponse(
		payload: {
			threadId: string;
			messageId: string;
			text: string;
			channel: Channel;
		},
		decision: Decision,
	): Promise<void> {
		const interpreted = await this.decisionResponseInterpreter.interpret({
			decision,
			text: payload.text,
		});
		if (
			interpreted.resolution !== "selected" ||
			!interpreted.selectedOptionId
		) {
			await this.promptDecisionRetry(
				decision,
				"I still need a scope-confirmation choice. Please choose one of the listed options.",
			);
			return;
		}
		await this.resolveScopeConfirmationDecision(
			decision,
			interpreted.selectedOptionId,
			payload.text,
			payload.messageId,
			payload.channel.scope,
		);
	}

	private async handleScopeConfirmationExplicitResponse(
		decision: Decision,
		optionId: string | undefined,
		messageId: string | undefined,
		answerText: string | undefined,
		scope: Channel["scope"],
	): Promise<void> {
		if (!optionId) {
			throw new Error("Scope-confirmation decisions require an optionId");
		}
		await this.resolveScopeConfirmationDecision(
			decision,
			optionId,
			answerText,
			messageId,
			scope,
		);
	}

	private async resolveScopeConfirmationDecision(
		decision: Decision,
		selectedOptionId: string,
		answerText: string | undefined,
		answerMessageId: string | undefined,
		scope: Channel["scope"],
	): Promise<void> {
		const validOptionIds = new Set(
			(decision.options ?? []).map((option) => option.id),
		);
		if (!validOptionIds.has(selectedOptionId)) {
			await this.promptDecisionRetry(
				decision,
				"That option does not match the current scope-confirmation choices.",
			);
			return;
		}

		const outcome =
			selectedOptionId === "answer_current"
				? "scope_current_intent"
				: "scope_new_intent";
		this.backend.decisions.update(decision.id, {
			status: "answered",
			answerText,
			answerMessageId,
			answeredAt: now(),
			selectedOptionId,
			outcome,
		});
		this.backend.decisions.update(decision.id, {
			status: "resolved",
			resolvedAt: now(),
			selectedOptionId,
			outcome,
		});

		if (selectedOptionId === "answer_current") {
			await this.handleScopeConfirmationAsCurrentIntent(decision, scope);
		} else {
			await this.handleScopeConfirmationAsNewIntent(decision, scope);
		}
		await this.activateNextQueuedDecision(decision.threadId);
	}

	private async handleScopeConfirmationAsCurrentIntent(
		decision: Decision,
		fallbackScope: Channel["scope"],
	): Promise<void> {
		const proposedText = this.readDecisionMetadataString(
			decision,
			"proposedText",
		);
		if (!proposedText) {
			throw new Error(
				"Scope-confirmation decision is missing the buffered user message",
			);
		}

		await this.applyScopeUpdateToCurrentIntent({
			intentId: decision.intentId,
			threadId: decision.threadId,
			messageId:
				this.readDecisionMetadataString(decision, "proposedMessageId") ??
				prefixedId("msg"),
			text: proposedText,
			scope:
				this.readDecisionMetadataScope(decision, "proposedScope") ??
				fallbackScope,
		});
	}

	private async handleScopeConfirmationAsNewIntent(
		decision: Decision,
		fallbackScope: Channel["scope"],
	): Promise<void> {
		const currentIntent = this.backend.intents.getById(decision.intentId);
		if (currentIntent && currentIntent.status !== "achieved") {
			this.backend.intents.update(decision.intentId, { status: "active" });
			this.refreshTrackedIntentContext(
				decision.intentId,
				decision.threadId,
				this.intentScopeById.get(decision.intentId) ?? fallbackScope,
			);
			if (
				!this.scheduledIntentExecutions.has(decision.intentId) &&
				this.backend.tasks.getByIntent(decision.intentId).length === 0
			) {
				this.scheduleIntentExecution({
					intentId: decision.intentId,
					threadId: decision.threadId,
					text:
						this.intentTextById.get(decision.intentId) ??
						currentIntent.workingText ??
						currentIntent.raw,
					scope: this.intentScopeById.get(decision.intentId) ?? fallbackScope,
				});
			}
		}

		this.dialogue.enqueueAssistantMessage({
			threadId: decision.threadId,
			content:
				"Understood. I will leave the current intent as-is and treat your earlier message as a separate new request.",
			kind: "notification",
			metadata: { decisionId: decision.id, intentId: decision.intentId },
		});
		await this.flushPendingDeliveriesForThread(decision.threadId);

		const proposedText = this.readDecisionMetadataString(
			decision,
			"proposedText",
		);
		if (!proposedText) {
			throw new Error(
				"Scope-confirmation decision is missing the buffered user message",
			);
		}

		await this.startIntentExecution({
			threadId: decision.threadId,
			messageId:
				this.readDecisionMetadataString(decision, "proposedMessageId") ??
				prefixedId("msg"),
			text: proposedText,
			channel: {
				id: "decision_queue",
				type: "cli",
				scope:
					this.readDecisionMetadataScope(decision, "proposedScope") ??
					fallbackScope,
				status: "connected",
				connectedAt: now(),
				lastSeenAt: now(),
				subscriptions: [],
			},
		});
	}

	private async applyScopeUpdateToCurrentIntent(params: {
		intentId: string;
		threadId: string;
		messageId: string;
		text: string;
		scope: Channel["scope"];
	}): Promise<void> {
		const executionContext = this.buildExecutionContextForScope({
			threadId: params.threadId,
			text: params.text,
			scope: params.scope,
		});
		const result = await this.orchestrator.applyIntentScopeUpdate(
			params.intentId,
			params.text,
			{
				systemPrompt: executionContext.systemPrompt,
				capabilities: executionContext.permissionCapabilities,
				grounding: executionContext.grounding,
			},
		);
		const revised = result.intent;

		this.refreshTrackedIntentContext(
			params.intentId,
			params.threadId,
			params.scope,
		);
		this.intentTextById.set(
			params.intentId,
			revised.workingText ?? revised.raw,
		);
		this.intentScopeById.set(params.intentId, params.scope);

		if (revised.status === "awaiting_clarification") {
			await this.createClarificationDecision(revised, params.threadId);
			return;
		}

		this.dialogue.enqueueAssistantMessage({
			threadId: params.threadId,
			content:
				result.mode === "deferred_replan"
					? "I treated your last message as a scope update to the current intent. I’ve queued that revision and will apply it at the next safe execution boundary."
					: result.mode === "immediate_replan"
						? "I treated your last message as a scope update to the current intent, and I replanned the remaining work while keeping the same intent identity."
						: "I treated your last message as a scope update to the current intent, and I’m keeping the same intent identity.",
			kind: "notification",
			metadata: {
				intentId: params.intentId,
				reason:
					result.mode === "deferred_replan"
						? "scope_update_deferred"
						: result.mode === "immediate_replan"
							? "scope_update_replanned"
							: "scope_update_applied",
				scopeUpdateMode: result.mode,
				sourceMessageId: params.messageId,
			},
		});
		await this.flushPendingDeliveriesForThread(params.threadId);

		if (result.mode !== "deferred_replan") {
			this.scheduleIntentExecution({
				intentId: params.intentId,
				threadId: params.threadId,
				text: revised.workingText ?? revised.raw,
				scope: params.scope,
			});
		}
		await this.activateNextQueuedDecision(params.threadId);
	}

	private getLatestControllableIntentForThread(threadId: string) {
		const snapshot = this.dialogue.getThreadSnapshot({ threadId });
		if (!snapshot) {
			return undefined;
		}

		const intentIds = Array.isArray(snapshot.thread.metadata?.intentIds)
			? snapshot.thread.metadata.intentIds.map((value) => String(value))
			: [];
		for (const intentId of [...intentIds].reverse()) {
			const intent = this.backend.intents.getById(intentId);
			if (
				!intent ||
				(intent.status !== "active" && intent.status !== "paused")
			) {
				continue;
			}
			return intent;
		}
		return undefined;
	}

	private getLatestTrackedIntentForThread(threadId: string) {
		const snapshot = this.dialogue.getThreadSnapshot({ threadId });
		if (!snapshot) {
			return undefined;
		}

		const intentIds = Array.isArray(snapshot.thread.metadata?.intentIds)
			? snapshot.thread.metadata.intentIds.map((value) => String(value))
			: [];
		for (const intentId of [...intentIds].reverse()) {
			const intent = this.backend.intents.getById(intentId);
			if (!intent) {
				continue;
			}
			if (intent.status === "achieved" || intent.status === "abandoned") {
				continue;
			}
			return intent;
		}
		return undefined;
	}

	private readDecisionMetadataString(
		decision: Decision,
		key: string,
	): string | undefined {
		const value = decision.metadata?.[key];
		return typeof value === "string" && value.trim().length > 0
			? value
			: undefined;
	}

	private readDecisionMetadataScope(
		decision: Decision,
		key: string,
	): Channel["scope"] | undefined {
		const value = decision.metadata?.[key];
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return undefined;
		}
		return value as Channel["scope"];
	}

	private async handleAmbiguousThreadInput(
		threadId: string,
		disposition: Exclude<
			ThreadInputDisposition,
			| "decision_response"
			| "pause_current_intent"
			| "cancel_current_intent"
			| "new_intent"
		>,
	): Promise<void> {
		const content =
			disposition === "mixed"
				? "Your last message seems to both resolve the pending decision and introduce a new task. Please resolve the pending decision first, then send the new task separately."
				: "I’m not yet sure whether your last message was resolving the pending decision or starting a new task. Please clarify that first.";
		this.dialogue.enqueueAssistantMessage({
			threadId,
			content,
			kind: "decision_needed",
			metadata: { reason: "thread_input_ambiguous", disposition },
		});
		await this.flushPendingDeliveriesForThread(threadId);
	}

	private async submitAmbientIntent(
		threadId: string,
		text: string,
		scope: Channel["scope"],
	): Promise<void> {
		const executionContext = this.buildExecutionContextForScope({
			threadId,
			text,
			scope,
		});
		const intent = await this.orchestrator.submitIntentBackground(text, {
			systemPrompt: executionContext.systemPrompt,
			source: "ambient",
			capabilities: executionContext.permissionCapabilities,
			grounding: executionContext.grounding,
			deferExecution: true,
			onIntentCreated: (intent) =>
				this.trackIntentForThread(intent.id, threadId, text, scope),
		});
		if (intent.status === "awaiting_clarification") {
			await this.createClarificationDecision(intent, threadId);
			return;
		}

		const conflict = this.conflicts.analyze({
			intentId: intent.id,
			text,
			scope,
		});
		if (conflict.requiresReview && conflict.verdict === "conflicting") {
			this.backend.intents.update(intent.id, { status: "awaiting_decision" });
			await this.createConflictResolutionDecision(intent, threadId, conflict);
			return;
		}

		this.scheduleIntentExecution({
			intentId: intent.id,
			threadId,
			text,
			scope,
		});
	}

	private async queueAmbientIntentForApproval(
		threadId: string,
		text: string,
		scope: Channel["scope"],
		promotionMessage: string,
		confidence: number,
	): Promise<void> {
		const executionContext = this.buildExecutionContextForScope({
			threadId,
			text,
			scope,
		});
		const intent = await this.orchestrator.submitIntentBackground(text, {
			systemPrompt: executionContext.systemPrompt,
			source: "ambient",
			capabilities: executionContext.permissionCapabilities,
			grounding: executionContext.grounding,
			deferExecution: true,
			onIntentCreated: (intent) =>
				this.trackIntentForThread(intent.id, threadId, text, scope),
		});
		if (intent.status === "awaiting_clarification") {
			await this.createClarificationDecision(intent, threadId);
			return;
		}

		this.backend.intents.update(intent.id, { status: "awaiting_decision" });
		await this.createApprovalDecision(
			intent,
			threadId,
			promotionMessage,
			confidence,
		);
	}

	private scheduleIntentExecution(params: {
		intentId: string;
		threadId: string;
		text: string;
		scope: Channel["scope"];
	}): void {
		if (this.scheduledIntentExecutions.has(params.intentId)) {
			return;
		}
		this.scheduledIntentExecutions.add(params.intentId);

		const scheduled = this.conflicts.schedule(
			{
				intentId: params.intentId,
				text: params.text,
				scope: params.scope,
			},
			async () => {
				const currentIntent = this.backend.intents.getById(params.intentId);
				if (!currentIntent || currentIntent.status !== "active") {
					return;
				}
				await this.orchestrator.resumeIntent(params.intentId);
				await this.orchestrator.waitForIntent(params.intentId);
			},
		);

		if (scheduled.queued && scheduled.reason) {
			this.dialogue.enqueueAssistantMessage({
				threadId: params.threadId,
				content: scheduled.reason,
				kind: "notification",
				metadata: {
					reason: "resource_contention",
					overlaps: scheduled.overlaps,
					intentId: params.intentId,
				},
			});
			void this.flushPendingDeliveriesForThread(params.threadId);
		}

		void scheduled.completion
			.catch((error) => {
				this.dialogue.enqueueAssistantMessage({
					threadId: params.threadId,
					content: `Intent execution failed: ${(error as Error).message}`,
					kind: "notification",
					metadata: {
						reason: "intent_submission_failed",
						intentId: params.intentId,
					},
				});
				void this.flushPendingDeliveriesForThread(params.threadId);
			})
			.finally(() => {
				this.scheduledIntentExecutions.delete(params.intentId);
			});
	}

	private buildExecutionContext(payload: {
		threadId: string;
		text: string;
		channel: Channel;
	}) {
		return this.buildExecutionContextForScope({
			threadId: payload.threadId,
			text: payload.text,
			scope: payload.channel.scope,
		});
	}

	private buildExecutionContextForScope(params: {
		threadId: string;
		text: string;
		scope: Channel["scope"];
	}) {
		const permissionPolicy = loadPermissionPolicy();
		const assembledContext = this.contextAssembler.assemble({
			scope: params.scope,
			activeIntents: this.backend.intents.getActive().map((intent) => ({
				id: intent.id,
				raw: intent.raw,
				goal: intent.goal,
				status: intent.status,
				source: intent.source,
			})),
			recentMemoryHints: this.memory.retrieveForContext({
				query: params.text,
				scope: params.scope,
				threadId: params.threadId,
			}),
			permissionContext: describePermissionBoundary(permissionPolicy, {
				projectRoot: params.scope.projectRoot,
			}),
		});
		const systemPrompt = renderContextForSystemPrompt(assembledContext);
		const grounding = buildUserStateGrounding({
			context: assembledContext,
			recentThreadMessages: this.backend.messages
				.getMessagesByThread(params.threadId)
				.slice(-8)
				.map((message) => ({
					role: message.role,
					content: message.content,
				})),
		});
		const permissionCapabilities = resolvePermissionCapabilities(
			permissionPolicy,
			{ projectRoot: params.scope.projectRoot },
		);
		return {
			assembledContext,
			systemPrompt,
			grounding,
			permissionCapabilities,
		};
	}

	private async createClarificationDecision(
		intent: {
			id: string;
			goal: { summary: string };
			clarificationQuestions?: string[];
		},
		threadId: string,
	): Promise<Decision> {
		const existing = this.backend.decisions.getPendingByIntent(intent.id);
		if (existing.length > 0) {
			const pendingDecision = existing[0];
			if (!pendingDecision) {
				throw new Error(
					`Pending clarification decision missing for ${intent.id}`,
				);
			}
			this.backend.decisions.update(pendingDecision.id, {
				summary: `Clarification needed before continuing: ${intent.goal.summary}`,
				questions: intent.clarificationQuestions ?? [],
				responseMode: "free_text",
			});
			return (
				this.backend.decisions.getById(pendingDecision.id) ?? pendingDecision
			);
		}

		const queuedDecision = this.backend.decisions
			.getByStatus("queued")
			.find(
				(decision) =>
					decision.intentId === intent.id && decision.kind === "clarification",
			);
		if (queuedDecision) {
			this.backend.decisions.update(queuedDecision.id, {
				summary: `Clarification needed before continuing: ${intent.goal.summary}`,
				questions: intent.clarificationQuestions ?? [],
				responseMode: "free_text",
			});
			if (this.backend.decisions.getPendingByThread(threadId).length === 0) {
				this.backend.decisions.update(queuedDecision.id, { status: "pending" });
				const activated =
					this.backend.decisions.getById(queuedDecision.id) ?? queuedDecision;
				await this.promptDecision(activated);
				return activated;
			}
			return (
				this.backend.decisions.getById(queuedDecision.id) ?? queuedDecision
			);
		}

		return this.persistDecisionWithQueuePolicy(
			{
				id: prefixedId("dec"),
				intentId: intent.id,
				threadId,
				kind: "clarification",
				summary: `Clarification needed before continuing: ${intent.goal.summary}`,
				questions: intent.clarificationQuestions ?? [],
				status: "pending",
				responseMode: "free_text",
				createdAt: now(),
				metadata: {
					intentGoal: intent.goal.summary,
				},
			},
			"Another blocking item is already active in this thread. I queued the clarification behind it.",
		);
	}

	private async createApprovalDecision(
		intent: { id: string; goal: { summary: string } },
		threadId: string,
		promotionMessage: string,
		confidence: number,
	): Promise<Decision> {
		return this.persistDecisionWithQueuePolicy(
			{
				id: prefixedId("dec"),
				intentId: intent.id,
				threadId,
				kind: "approval",
				summary: `Approval needed before executing ambient intent: ${intent.goal.summary}`,
				questions: [
					promotionMessage,
					"Should I proceed with this ambient intent now?",
				],
				status: "pending",
				responseMode: "approval",
				createdAt: now(),
				metadata: {
					intentGoal: intent.goal.summary,
					confidence,
					source: "ambient",
				},
			},
			"Another blocking item is already active in this thread. I queued the approval request behind it.",
		);
	}

	private async createRiskBoundaryApprovalDecision(
		intent: { id: string; goal: { summary: string } },
		threadId: string,
		event: ProgressEvent,
	): Promise<Decision> {
		const existing = [
			...this.backend.decisions.getPendingByIntent(intent.id),
			...this.backend.decisions
				.getByStatus("queued")
				.filter((decision) => decision.intentId === intent.id),
		].find(
			(decision) =>
				decision.kind === "approval" &&
				decision.metadata?.producer === "risky_boundary",
		);
		if (existing) {
			return existing;
		}

		const toolNames = Array.isArray(event.data.toolNames)
			? event.data.toolNames.map((item) => String(item).trim()).filter(Boolean)
			: [];
		const rollbackKinds = Array.isArray(event.data.rollbackKinds)
			? event.data.rollbackKinds
					.map((item) => String(item).trim())
					.filter(Boolean)
			: [];
		const reason =
			typeof event.data.reason === "string" &&
			event.data.reason.trim().length > 0
				? event.data.reason.trim()
				: "Reached a risky task boundary before continuing.";
		const rollbackAvailable = event.data.rollbackAvailable === true;

		return this.persistDecisionWithQueuePolicy(
			{
				id: prefixedId("dec"),
				intentId: intent.id,
				threadId,
				kind: "approval",
				summary: `Approval needed before continuing after a risky task boundary: ${intent.goal.summary}`,
				questions: [
					reason,
					toolNames.length > 0
						? `Risky tools used: ${toolNames.join(", ")}`
						: "Risky tools were used in the last completed task.",
					rollbackKinds.length > 0
						? `Rollback coverage: ${rollbackKinds.join(", ")}`
						: rollbackAvailable
							? "Some rollback support is available."
							: "No automatic rollback is currently available.",
					"Should I continue with the remaining work?",
				],
				status: "pending",
				responseMode: "approval",
				createdAt: now(),
				metadata: {
					intentGoal: intent.goal.summary,
					producer: "risky_boundary",
					rejectionPolicy: "pause_intent",
					taskId: event.data.taskId,
					toolNames,
					rollbackAvailable,
					rollbackKinds,
					irreversibleRisk: event.data.irreversibleRisk === true,
				},
			},
			"Another blocking item is already active in this thread. I queued the risky-boundary approval behind it.",
		);
	}

	private async createConflictResolutionDecision(
		intent: { id: string; goal: { summary: string } },
		threadId: string,
		conflict: ConflictDecision,
	): Promise<Decision> {
		return this.persistDecisionWithQueuePolicy(
			{
				id: prefixedId("dec"),
				intentId: intent.id,
				threadId,
				kind: "conflict_resolution",
				summary: `Conflict resolution needed before executing: ${intent.goal.summary}`,
				questions: [
					conflict.reason ??
						"This intent overlaps with active work and needs a decision before proceeding.",
				],
				status: "pending",
				responseMode: "single_select",
				options: [
					{
						id: "queue_after_current",
						label: "Queue after current work",
						description:
							"Keep the new intent, but let active work finish first.",
						value: "queue_after_current",
						recommended: true,
					},
					{
						id: "cancel_new_intent",
						label: "Cancel new intent",
						description:
							"Drop the new conflicting request instead of queuing it.",
						value: "cancel_new_intent",
					},
				],
				relatedIntentIds: conflict.relatedIntentIds ?? [],
				createdAt: now(),
				metadata: {
					intentGoal: intent.goal.summary,
					verdict: conflict.verdict,
					overlaps: conflict.overlaps,
					reason: conflict.reason,
				},
			},
			"Another blocking item is already active in this thread. I queued the conflict decision behind it.",
		);
	}

	private async createScopeConfirmationDecision(
		intent: { id: string; goal: { summary: string } },
		payload: {
			threadId: string;
			messageId: string;
			text: string;
			channel: Channel;
		},
		rationale: string,
	): Promise<Decision> {
		return this.persistDecisionWithQueuePolicy(
			{
				id: prefixedId("dec"),
				intentId: intent.id,
				threadId: payload.threadId,
				kind: "scope_confirmation",
				summary: `I need to confirm how to treat your last message relative to the current intent: ${intent.goal.summary}`,
				questions: [
					`Current intent: ${intent.goal.summary}`,
					`Latest message: ${payload.text}`,
				],
				status: "pending",
				responseMode: "single_select",
				options: [
					{
						id: "answer_current",
						label: "Apply to current intent",
						description:
							"Keep the same intent identity and treat the message as a scope update.",
						value: "answer_current",
						recommended: true,
					},
					{
						id: "start_new_intent",
						label: "Start new intent",
						description:
							"Leave the current intent as-is and treat the message as a separate request.",
						value: "start_new_intent",
					},
				],
				createdAt: now(),
				metadata: {
					intentGoal: intent.goal.summary,
					producer: "thread_scope_router",
					rationale,
					proposedText: payload.text,
					proposedMessageId: payload.messageId,
					proposedScope: payload.channel.scope,
				},
			},
			"Another blocking item is already active in this thread. I queued the scope confirmation behind it.",
		);
	}

	private async persistDecisionWithQueuePolicy(
		decision: Decision,
		queuedMessage: string,
	): Promise<Decision> {
		const hasPendingDecision =
			this.backend.decisions.getPendingByThread(decision.threadId).length > 0;
		const persisted = {
			...decision,
			status: hasPendingDecision ? "queued" : "pending",
		} satisfies Decision;
		this.backend.decisions.create(persisted);

		if (persisted.status === "pending") {
			await this.promptDecision(persisted);
			return persisted;
		}

		this.dialogue.enqueueAssistantMessage({
			threadId: persisted.threadId,
			content: queuedMessage,
			kind: "notification",
			metadata: {
				decisionId: persisted.id,
				decisionKind: persisted.kind,
				intentId: persisted.intentId,
				reason: "decision_queued",
			},
		});
		await this.flushPendingDeliveriesForThread(persisted.threadId);
		return persisted;
	}

	private async activateNextQueuedDecision(threadId: string): Promise<void> {
		if (this.backend.decisions.getPendingByThread(threadId).length > 0) {
			return;
		}

		const queued = this.backend.decisions.getQueuedByThread(threadId);
		if (queued.length === 0) {
			return;
		}

		let next: Decision | undefined;
		for (const candidate of queued) {
			const intent = this.backend.intents.getById(candidate.intentId);
			if (
				!intent ||
				intent.status === "achieved" ||
				intent.status === "abandoned"
			) {
				this.backend.decisions.update(candidate.id, {
					status: "superseded",
					resolvedAt: now(),
					metadata: {
						...(candidate.metadata ?? {}),
						reason: "owner_intent_inactive",
					},
				});
				continue;
			}
			if (intent.status === "paused") {
				continue;
			}
			next = candidate;
			break;
		}

		if (!next) {
			return;
		}

		this.backend.decisions.update(next.id, { status: "pending" });
		if (next.kind === "clarification") {
			this.backend.intents.update(next.intentId, {
				status: "awaiting_clarification",
			});
		} else {
			this.backend.intents.update(next.intentId, {
				status: "awaiting_decision",
			});
		}

		const activated = this.backend.decisions.getById(next.id) ?? {
			...next,
			status: "pending",
		};
		await this.promptDecision(
			activated,
			"The next queued decision in this thread is now ready.",
		);
	}

	private async promptDecision(
		decision: Decision,
		preface?: string,
	): Promise<void> {
		this.dialogue.enqueueAssistantMessage({
			threadId: decision.threadId,
			content: [preface, formatPendingDecision(decision)]
				.filter((value): value is string => Boolean(value))
				.join("\n\n"),
			kind: "decision_needed",
			metadata: {
				decisionId: decision.id,
				decisionKind: decision.kind,
				intentId: decision.intentId,
			},
		});
		await this.flushPendingDeliveriesForThread(decision.threadId);
	}

	private async promptDecisionRetry(
		decision: Decision,
		preface: string,
	): Promise<void> {
		await this.promptDecision(decision, preface);
	}

	private async handleRiskBoundaryApprovalRequested(
		event: ProgressEvent,
		threadId: string,
	): Promise<void> {
		const intentId = String(event.data.intentId ?? "");
		const intent = this.backend.intents.getById(intentId);
		if (!intent) {
			return;
		}

		await this.createRiskBoundaryApprovalDecision(intent, threadId, event);
	}

	private requeueOutstandingDecisionsForIntent(
		intentId: string,
		reason: string,
	): void {
		const outstanding = [
			...this.backend.decisions.getPendingByIntent(intentId),
			...this.backend.decisions
				.getByStatus("queued")
				.filter((decision) => decision.intentId === intentId),
		];
		const seen = new Set<string>();
		for (const decision of outstanding) {
			if (seen.has(decision.id)) {
				continue;
			}
			seen.add(decision.id);
			if (decision.status === "resolved" || decision.status === "cancelled") {
				continue;
			}
			this.backend.decisions.update(decision.id, {
				status: "queued",
				metadata: {
					...(decision.metadata ?? {}),
					queueReason: reason,
				},
			});
		}
	}

	private hasQueuedDecisionForIntent(
		threadId: string,
		intentId: string,
	): boolean {
		return this.backend.decisions
			.getQueuedByThread(threadId)
			.some((decision) => decision.intentId === intentId);
	}

	private cancelOutstandingDecisionsForIntent(
		intentId: string,
		reason: string,
	): void {
		const outstanding = [
			...this.backend.decisions.getPendingByIntent(intentId),
			...this.backend.decisions
				.getByStatus("queued")
				.filter((decision) => decision.intentId === intentId),
		];
		const seen = new Set<string>();
		for (const decision of outstanding) {
			if (seen.has(decision.id)) {
				continue;
			}
			seen.add(decision.id);
			this.backend.decisions.update(decision.id, {
				status: "cancelled",
				resolvedAt: now(),
				metadata: {
					...(decision.metadata ?? {}),
					reason,
				},
			});
		}
	}

	private cleanupTrackedIntentState(intentId: string): void {
		this.intentTextById.delete(intentId);
		this.intentScopeById.delete(intentId);
		this.intentOutputsById.delete(intentId);
		this.threadByIntentId.delete(intentId);
	}

	private async finalizeAbandonedIntent(
		intentId: string,
		threadId: string,
		message: string,
	): Promise<void> {
		this.backend.intents.update(intentId, { status: "abandoned" });
		this.cancelOutstandingDecisionsForIntent(intentId, "intent_abandoned");
		this.cleanupTrackedIntentState(intentId);
		this.dialogue.enqueueAssistantMessage({
			threadId,
			content: message,
			kind: "notification",
			metadata: { intentId, reason: "intent_abandoned" },
		});
		await this.flushPendingDeliveriesForThread(threadId);
		await this.activateNextQueuedDecision(threadId);
	}

	private trackIntentForThread(
		intentId: string,
		threadId: string,
		text: string,
		scope: Channel["scope"],
	): void {
		this.dialogue.linkIntentToThread(threadId, intentId);
		this.threadByIntentId.set(intentId, threadId);
		this.intentTextById.set(intentId, text);
		this.intentScopeById.set(intentId, scope);
		if (!this.intentOutputsById.has(intentId)) {
			this.intentOutputsById.set(intentId, []);
		}
	}

	private refreshTrackedIntentContext(
		intentId: string,
		threadId: string,
		scope: Channel["scope"],
	): void {
		if (!this.threadByIntentId.has(intentId)) {
			return;
		}

		this.dialogue.linkIntentToThread(threadId, intentId);
		this.threadByIntentId.set(intentId, threadId);
		this.intentScopeById.set(intentId, scope);
		if (!this.intentOutputsById.has(intentId)) {
			this.intentOutputsById.set(intentId, []);
		}
	}

	private storeIntentRequestMemory(payload: {
		threadId: string;
		text: string;
		channel: Channel;
		intentId?: string;
	}): void {
		this.memory.ingestHumanIntent({
			threadId: payload.threadId,
			intentId: payload.intentId,
			text: payload.text,
			scope: payload.channel.scope,
		});
	}

	private storeIntentOutcomeMemory(
		intentId: string,
		outcome: "intent.achieved" | "escalation",
	): void {
		const text = this.intentTextById.get(intentId);
		if (!text) return;

		const scope = this.intentScopeById.get(intentId);
		const threadId = this.threadByIntentId.get(intentId);
		const outputs = this.intentOutputsById.get(intentId) ?? [];
		this.memory.ingestIntentOutcome({
			intentId,
			intentText: text,
			outcome,
			scope,
			threadId,
			outputs,
		});
		this.procedureSeeds.recordTrace({
			id: prefixedId("trace"),
			intentId,
			threadId,
			intentText: text,
			status: outcome === "intent.achieved" ? "achieved" : "escalated",
			projectRoot: scope?.projectRoot,
			focusedFile: scope?.focusedFile,
			outputs,
			createdAt: now(),
		});

		this.cleanupTrackedIntentState(intentId);
	}

	private updateSessionState(
		socket: Socket,
		message: ClientEnvelope,
		response: DaemonEnvelope,
	): void {
		const current = this.sessions.get(socket) ?? {};
		if (message.type === "attach") {
			const payload = message.payload as {
				channel?: {
					subscriptions?: string[];
				};
			};
			this.sessions.set(socket, {
				channelId: message.channel.id,
				threadId: getAttachedThreadId(message, response),
				subscriptions:
					payload.channel?.subscriptions?.map((value) => String(value)) ?? [],
			});
			return;
		}
		this.sessions.set(socket, {
			...current,
			channelId: current.channelId ?? message.channel.id,
		});
	}

	private async flushPendingDeliveriesForThread(
		threadId: string,
	): Promise<void> {
		const scopedSessions = [...this.sessions.entries()].filter(
			([, session]) => {
				return session.threadId === threadId;
			},
		);
		if (scopedSessions.length > 0) {
			await this.flushPendingDeliveriesToSockets(
				scopedSessions.map(([socket]) => socket),
				threadId,
			);
			return;
		}

		const genericSessions = [...this.sessions.entries()].filter(
			([, session]) => {
				return Boolean(session.channelId) && !session.threadId;
			},
		);
		if (genericSessions.length > 0) {
			await this.flushPendingDeliveriesToSockets(
				genericSessions.map(([socket]) => socket),
				threadId,
			);
		}
	}

	private async flushPendingDeliveries(
		socket: Socket,
		threadId?: string,
	): Promise<void> {
		await this.flushPendingDeliveriesToSockets([socket], threadId);
	}

	private async flushPendingDeliveriesToSockets(
		sockets: Socket[],
		threadId?: string,
	): Promise<void> {
		const activeSessions = sockets
			.map((socket) => ({
				socket,
				session: this.sessions.get(socket),
			}))
			.filter(
				(
					entry,
				): entry is {
					socket: Socket;
					session: ConnectionState & { channelId: string };
				} => Boolean(entry.session?.channelId),
			);
		if (activeSessions.length === 0) return;

		const deliveries = this.dialogue.peekPendingDeliveries({ threadId });
		const deliveredIds = new Set<string>();

		for (const delivery of deliveries) {
			const kind = String(delivery.message.metadata?.kind ?? "notification");
			const daemonType =
				kind === "progress" ||
				kind === "result" ||
				kind === "decision_needed" ||
				kind === "notification"
					? kind
					: "notification";
			const recipients = activeSessions.filter(({ session }) =>
				shouldDeliverToSession(session, delivery, daemonType),
			);
			if (recipients.length === 0) continue;

			const payload = `${JSON.stringify({
				type: daemonType,
				threadId: delivery.message.threadId,
				timestamp: now(),
				payload: delivery.message,
			})}\n`;
			for (const { socket } of recipients) {
				socket.write(payload);
			}
			deliveredIds.add(delivery.entry.id);
		}

		if (deliveredIds.size > 0) {
			this.dialogue.markDeliveriesDelivered(
				deliveries.filter((delivery) => deliveredIds.has(delivery.entry.id)),
			);
		}
	}

	private async listen(): Promise<void> {
		try {
			await new Promise<void>((resolve, reject) => {
				this.server?.once("error", reject);
				this.server?.listen(this.paths.socketPath, () => resolve());
			});
			writeFileSync(
				this.paths.statePath,
				JSON.stringify({
					mode: "unix",
					socketPath: this.paths.socketPath,
				}),
			);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== "EPERM") throw error;
			await new Promise<void>((resolve, reject) => {
				this.server?.once("error", reject);
				this.server?.listen(this.paths.port, this.paths.host, () => resolve());
			});
			writeFileSync(
				this.paths.statePath,
				JSON.stringify({
					mode: "tcp",
					host: this.paths.host,
					port: this.paths.port,
				}),
			);
		}
	}

	private getAmbientThreadId(rootDir: string): string {
		return `thread_ambient_${hashText(rootDir)}`;
	}

	private getAmbientThreadTitle(rootDir: string): string {
		const segments = rootDir.replace(/\\/g, "/").split("/").filter(Boolean);
		const label = segments.at(-1) ?? rootDir;
		return `Ambient notices — ${label}`;
	}
}

interface ConnectionState {
	channelId?: string;
	threadId?: string;
	subscriptions?: string[];
}

function cleanupSocket(socketPath: string): void {
	try {
		unlinkSync(socketPath);
	} catch {
		// ignore
	}
}

function hashText(text: string): string {
	let hash = 0;
	for (let index = 0; index < text.length; index += 1) {
		hash = (hash << 5) - hash + text.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash).toString(36);
}

function shouldDeliverToSession(
	session: ConnectionState & { channelId: string },
	delivery: {
		entry: { targetChannel?: string };
		message: { threadId: string };
	},
	kind: string,
): boolean {
	if (
		delivery.entry.targetChannel &&
		delivery.entry.targetChannel !== session.channelId
	) {
		return false;
	}
	if (session.threadId && session.threadId !== delivery.message.threadId) {
		return false;
	}
	if (!session.subscriptions || session.subscriptions.length === 0) {
		return true;
	}
	return session.subscriptions.includes(kind);
}

function formatPendingDecision(decision: Decision): string {
	const lines = [decision.summary];

	if (decision.questions.length > 0) {
		lines.push("Questions:");
		lines.push(
			...decision.questions.map(
				(question, index) => `${index + 1}. ${question}`,
			),
		);
	}

	if (decision.responseMode === "approval") {
		lines.push("Reply yes/no, or use approve_decision.");
		return lines.join("\n");
	}

	if (decision.responseMode === "single_select") {
		if (decision.options && decision.options.length > 0) {
			lines.push("Options:");
			lines.push(
				...decision.options.map((option) => {
					const recommended = option.recommended ? " (recommended)" : "";
					const description = option.description
						? ` — ${option.description}`
						: "";
					return `- ${option.id}: ${option.label}${recommended}${description}`;
				}),
			);
		}
		lines.push("Reply with the option id/label, or use approve_decision.");
		return lines.join("\n");
	}

	lines.push("Reply in this thread to continue.");
	return lines.join("\n");
}

function progressEventToDelivery(event: ProgressEvent):
	| {
			content: string;
			kind: "progress" | "result" | "notification" | "decision_needed";
	  }
	| undefined {
	switch (event.type) {
		case "intent.intake":
			return {
				content: formatIntentIntakeMessage(event),
				kind: "notification",
			};
		case "intent.parsed":
			return {
				content: `Intent parsed: ${String((event.data.goal as { summary?: string })?.summary ?? "unknown")}`,
				kind: "progress",
			};
		case "intent.resumed":
			return {
				content: formatIntentResumedMessage(event),
				kind: "notification",
			};
		case "intent.revision_queued":
			return {
				content: formatIntentRevisionQueuedMessage(event),
				kind: "notification",
			};
		case "intent.replanned":
			return {
				content: formatIntentReplannedMessage(event),
				kind: "notification",
			};
		case "intent.pause_requested":
			return {
				content: formatIntentPauseRequestedMessage(event),
				kind: "notification",
			};
		case "intent.paused":
			return {
				content: formatIntentPausedMessage(event),
				kind: "notification",
			};
		case "intent.cancel_requested":
			return {
				content: formatIntentCancelRequestedMessage(event),
				kind: "notification",
			};
		case "intent.approval_requested":
			return undefined;
		case "intent.cancelled":
			return {
				content: formatIntentCancelledMessage(event),
				kind: "notification",
			};
		case "tasks.planned":
			return {
				content: `Tasks planned: ${String(event.data.taskCount ?? 0)}`,
				kind: "progress",
			};
		case "task.started":
			return {
				content: `Task started: ${String(event.data.taskId ?? "")}`,
				kind: "progress",
			};
		case "task.completed":
			return {
				content: formatTaskCompletedMessage(event),
				kind: "progress",
			};
		case "task.cancelled":
			return {
				content: `Task cancelled: ${String(event.data.taskId ?? "")}\n${String(event.data.reason ?? "Cancelled by user")}`,
				kind: "notification",
			};
		case "task.failed":
			return {
				content: `Task failed: ${String(event.data.error ?? "unknown error")}`,
				kind: "notification",
			};
		case "intent.clarification_needed":
			return {
				content: formatClarificationNeededMessage(event),
				kind: "decision_needed",
			};
		case "intent.achieved":
			return {
				content: formatIntentAchievedMessage(event),
				kind: "result",
			};
		case "escalation":
			return {
				content: `Escalation: ${String(event.data.reason ?? "unknown")}`,
				kind: "notification",
			};
		default:
			return undefined;
	}
}

function formatTaskCompletedMessage(event: ProgressEvent): string {
	const output = String(event.data.output ?? "").trim();
	if (!output) {
		return `Task completed: ${String(event.data.taskId ?? "")}`;
	}
	const compact = truncate(output, 240);
	return `Task completed: ${String(event.data.taskId ?? "")}\n${compact}`;
}

function formatIntentIntakeMessage(event: ProgressEvent): string {
	const contract = event.data.contract as {
		summary?: string;
	} | null;
	const executionDepth = event.data.executionDepth as {
		planningDepth?: string;
		timeDepth?: string;
		organizationDepth?: string;
	} | null;
	const clarificationQuestions = Array.isArray(
		event.data.clarificationQuestions,
	)
		? event.data.clarificationQuestions
				.map((item) => String(item).trim())
				.filter(Boolean)
		: [];
	const lines = [
		`Task contract formed: ${String(contract?.summary ?? "unknown")}`,
		`Depth: planning=${String(executionDepth?.planningDepth ?? "unknown")}, time=${String(executionDepth?.timeDepth ?? "unknown")}, org=${String(executionDepth?.organizationDepth ?? "unknown")}`,
	];
	const groundingSummary = String(event.data.groundingSummary ?? "").trim();
	if (groundingSummary) {
		lines.push(`Grounding: ${groundingSummary}`);
	}
	if (clarificationQuestions.length > 0) {
		lines.push(`Potential clarification: ${clarificationQuestions[0]}`);
	}
	return lines.join("\n");
}

function formatClarificationNeededMessage(event: ProgressEvent): string {
	const questions = Array.isArray(event.data.clarificationQuestions)
		? event.data.clarificationQuestions
				.map((item) => String(item).trim())
				.filter(Boolean)
		: [];
	if (questions.length === 0) {
		return "I need clarification before proceeding.";
	}
	return [
		"I need clarification before proceeding:",
		...questions.map((question, index) => `${index + 1}. ${question}`),
	].join("\n");
}

function formatIntentResumedMessage(event: ProgressEvent): string {
	const contract = event.data.contract as { summary?: string } | null;
	const executionDepth = event.data.executionDepth as {
		planningDepth?: string;
		timeDepth?: string;
	} | null;
	const resumeType = String(event.data.resumeType ?? "clarification");
	const heading =
		resumeType === "pause_resume"
			? "Intent resumed from pause."
			: resumeType === "approval_boundary"
				? "Approval received. Continuing past the risky boundary."
				: "Clarification resolved. Resuming the original intent.";
	return [
		heading,
		`Contract: ${String(contract?.summary ?? "unknown")}`,
		`Depth: planning=${String(executionDepth?.planningDepth ?? "unknown")}, time=${String(executionDepth?.timeDepth ?? "unknown")}`,
	].join("\n");
}

function formatIntentRevisionQueuedMessage(event: ProgressEvent): string {
	return [
		"Scope update accepted.",
		`Apply policy: ${String(event.data.applyPolicy ?? "next_execution_boundary")}`,
		"I will apply it at the next safe execution boundary before dispatching more work.",
	].join("\n");
}

function formatIntentReplannedMessage(event: ProgressEvent): string {
	const contract = event.data.contract as { summary?: string } | null;
	return [
		"Applied the latest scope update and replanned the remaining work.",
		`Contract: ${String(contract?.summary ?? "unknown")}`,
		`Completed work preserved: ${String(event.data.completedTaskCount ?? 0)} task(s)`,
	].join("\n");
}

function formatIntentPauseRequestedMessage(event: ProgressEvent): string {
	return [
		"Pause requested.",
		`Reason: ${String(event.data.reason ?? "Paused by user")}`,
		"I will stop at the next safe task boundary.",
	].join("\n");
}

function formatIntentPausedMessage(event: ProgressEvent): string {
	return [
		"Intent paused.",
		`Reason: ${String(event.data.reason ?? "Paused by user")}`,
	].join("\n");
}

function formatIntentCancelRequestedMessage(event: ProgressEvent): string {
	return [
		"Cancellation requested.",
		`Reason: ${String(event.data.reason ?? "Cancelled by user")}`,
	].join("\n");
}

function formatIntentCancelledMessage(event: ProgressEvent): string {
	return [
		"Intent cancelled.",
		`Reason: ${String(event.data.reason ?? "Cancelled by user")}`,
	].join("\n");
}

function formatIntentAchievedMessage(event: ProgressEvent): string {
	const delivery = event.data.delivery as
		| {
				mode?: string;
				summary?: string;
				evidence?: unknown[];
				risks?: unknown[];
				nextSteps?: unknown[];
		  }
		| undefined;
	if (!delivery) {
		return "Intent achieved.";
	}

	const evidence = Array.isArray(delivery.evidence)
		? delivery.evidence.map((item) => String(item).trim()).filter(Boolean)
		: [];
	const risks = Array.isArray(delivery.risks)
		? delivery.risks.map((item) => String(item).trim()).filter(Boolean)
		: [];
	const nextSteps = Array.isArray(delivery.nextSteps)
		? delivery.nextSteps.map((item) => String(item).trim()).filter(Boolean)
		: [];

	if (delivery.mode === "concise") {
		return `Intent achieved.\n${String(delivery.summary ?? "").trim() || "Completed successfully."}`;
	}

	const lines = [
		"Intent achieved.",
		`Summary: ${String(delivery.summary ?? "").trim() || "Completed successfully."}`,
	];
	if (evidence.length > 0) {
		lines.push("Evidence:");
		lines.push(...evidence.map((item) => `- ${item}`));
	}
	if (risks.length > 0) {
		lines.push("Risks / gaps:");
		lines.push(...risks.map((item) => `- ${item}`));
	}
	if (nextSteps.length > 0) {
		lines.push("Next steps:");
		lines.push(...nextSteps.map((item) => `- ${item}`));
	}
	return lines.join("\n");
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}

function getAttachedThreadId(
	message: ClientEnvelope,
	response: DaemonEnvelope,
): string | undefined {
	if (message.type !== "attach") return response.threadId;
	const payload = message.payload as { threadId?: string };
	return response.threadId ?? payload.threadId;
}
