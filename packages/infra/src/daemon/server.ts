import { rmSync, unlinkSync, writeFileSync } from "node:fs";
import { type Socket, createServer } from "node:net";
import type {
	Channel,
	ClientEnvelope,
	DaemonEnvelope,
	LLMProvider,
	MemoryEntry,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import { Orchestrator } from "@nous/orchestrator";
import type { ProgressEvent } from "@nous/orchestrator";
import { createPersistenceBackend } from "@nous/persistence";
import {
	ContextAssembler,
	HybridMemoryRetriever,
	renderContextForSystemPrompt,
	renderMemoryHints,
} from "@nous/runtime";
import { createGeneralAgent } from "../agents/general.ts";
import { loadNousConfig } from "../config/home.ts";
import {
	loadPermissionPolicy,
	resolvePermissionCapabilities,
} from "../config/permissions.ts";
import { LocalProcedureSeedStore } from "../evolution/local-procedure-seed.ts";
import { ProcessSupervisor } from "../supervisor/supervisor.ts";
import { StaticIntentConflictManager } from "./conflict-manager.ts";
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
	private readonly memoryRetriever = new HybridMemoryRetriever(
		this.backend.memory,
	);
	private readonly perception: PerceptionService;
	private readonly threadByIntentId = new Map<string, string>();
	private readonly intentTextById = new Map<string, string>();
	private readonly intentScopeById = new Map<string, Channel["scope"]>();
	private readonly intentOutputsById = new Map<string, string[]>();
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

		this.dialogue = new DialogueService({
			messageStore: this.backend.messages,
			intentStore: this.backend.intents,
			taskStore: this.backend.tasks,
			onSubmitIntent: (payload) => this.handleIntentSubmission(payload),
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
			onPromoted: async (promotion) => {
				const thread = this.dialogue.ensureThread({
					threadId: "thread_ambient",
					title: "Ambient notices",
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
				if (
					this.nousConfig.ambient.enabled &&
					this.nousConfig.ambient.autoSubmit &&
					promotion.autoSubmit &&
					promotion.suggestedIntentText
				) {
					this.dialogue.enqueueAssistantMessage({
						threadId: thread.id,
						content: `Auto-submitting ambient intent: ${promotion.suggestedIntentText}`,
						kind: "notification",
						metadata: { source: "ambient_intent_strategy" },
					});
					await this.submitAmbientIntent(
						thread.id,
						promotion.suggestedIntentText,
						{
							workingDirectory: String(
								(promotion.signal.payload as { rootDir?: string }).rootDir ??
									process.cwd(),
							),
							projectRoot: String(
								(promotion.signal.payload as { rootDir?: string }).rootDir ??
									process.cwd(),
							),
						},
					);
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
		const assembledContext = this.contextAssembler.assemble({
			scope: payload.channel.scope,
			activeIntents: this.backend.intents.getActive().map((intent) => ({
				id: intent.id,
				raw: intent.raw,
				goal: intent.goal,
				status: intent.status,
				source: intent.source,
			})),
			recentMemoryHints: renderMemoryHints(
				this.memoryRetriever.retrieve({
					agentId: "nous",
					query: payload.text,
					scope: payload.channel.scope,
				}),
			),
		});
		const systemPrompt = renderContextForSystemPrompt(assembledContext);
		const permissionCapabilities = resolvePermissionCapabilities(
			loadPermissionPolicy(),
			{ projectRoot: payload.channel.scope.projectRoot },
		);
		this.dialogue.enqueueAssistantMessage({
			threadId: payload.threadId,
			content: `Context assembled for ${assembledContext.project.rootDir} (${assembledContext.project.type}, git: ${assembledContext.project.gitStatus ?? "unknown"}).`,
			kind: "notification",
			metadata: {
				source: "context_assembly",
				projectRoot: assembledContext.project.rootDir,
			},
		});
		await this.flushPendingDeliveriesForThread(payload.threadId);

		const decision = this.conflicts.schedule(
			{
				text: payload.text,
				scope: payload.channel.scope,
			},
			async () => {
				const intent = await this.orchestrator.submitIntentBackground(
					payload.text,
					{
						systemPrompt,
						capabilities: permissionCapabilities,
					},
				);
				this.dialogue.linkIntentToThread(payload.threadId, intent.id);
				this.threadByIntentId.set(intent.id, payload.threadId);
				this.intentTextById.set(intent.id, payload.text);
				this.intentScopeById.set(intent.id, payload.channel.scope);
				this.intentOutputsById.set(intent.id, []);
				await this.orchestrator.waitForIntent(intent.id);
			},
		);

		this.storeIntentRequestMemory(payload);

		if (decision.queued && decision.reason) {
			this.dialogue.enqueueAssistantMessage({
				threadId: payload.threadId,
				content: decision.reason,
				kind: "notification",
				metadata: {
					reason: "resource_contention",
					overlaps: decision.overlaps,
				},
			});
			void this.flushPendingDeliveriesForThread(payload.threadId);
		}

		void decision.completion.catch((error) => {
			this.dialogue.enqueueAssistantMessage({
				threadId: payload.threadId,
				content: `Intent execution failed: ${(error as Error).message}`,
				kind: "notification",
				metadata: { reason: "intent_submission_failed" },
			});
			void this.flushPendingDeliveriesForThread(payload.threadId);
		});
	}

	private async submitAmbientIntent(
		threadId: string,
		text: string,
		scope: Channel["scope"],
	): Promise<void> {
		const assembledContext = this.contextAssembler.assemble({
			scope,
			activeIntents: this.backend.intents.getActive().map((intent) => ({
				id: intent.id,
				raw: intent.raw,
				goal: intent.goal,
				status: intent.status,
				source: intent.source,
			})),
			recentMemoryHints: renderMemoryHints(
				this.memoryRetriever.retrieve({
					agentId: "nous",
					query: text,
					scope,
				}),
			),
		});
		const systemPrompt = renderContextForSystemPrompt(assembledContext);
		const permissionCapabilities = resolvePermissionCapabilities(
			loadPermissionPolicy(),
			{ projectRoot: scope.projectRoot },
		);
		const intent = await this.orchestrator.submitIntentBackground(text, {
			systemPrompt,
			source: "ambient",
			capabilities: permissionCapabilities,
		});
		this.dialogue.linkIntentToThread(threadId, intent.id);
		this.threadByIntentId.set(intent.id, threadId);
		this.intentTextById.set(intent.id, text);
		this.intentScopeById.set(intent.id, scope);
		this.intentOutputsById.set(intent.id, []);
		void this.orchestrator.waitForIntent(intent.id);
	}

	private storeIntentRequestMemory(payload: {
		threadId: string;
		text: string;
		channel: Channel;
	}): void {
		this.backend.memory.store({
			id: prefixedId("mem"),
			tier: "episodic",
			agentId: "nous",
			content: `User intent: ${payload.text}`,
			metadata: {
				threadId: payload.threadId,
				projectRoot: payload.channel.scope.projectRoot,
				focusedFile: payload.channel.scope.focusedFile,
				labels: payload.channel.scope.labels ?? [],
				source: "human_intent",
			},
			createdAt: now(),
			lastAccessedAt: now(),
			accessCount: 0,
			retentionScore: 1,
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
		const summary = outputs
			.filter(Boolean)
			.slice(-3)
			.map((output, index) => `Output ${index + 1}: ${truncate(output, 280)}`)
			.join("\n");

		const memory: MemoryEntry = {
			id: prefixedId("mem"),
			tier: outcome === "intent.achieved" ? "semantic" : "episodic",
			agentId: "nous",
			content: [
				`Intent outcome: ${outcome === "intent.achieved" ? "achieved" : "escalated"}`,
				`Intent: ${text}`,
				summary || "No task output captured.",
			].join("\n"),
			metadata: {
				intentId,
				projectRoot: scope?.projectRoot,
				focusedFile: scope?.focusedFile,
				labels: scope?.labels ?? [],
				source: "intent_outcome",
				status: outcome,
			},
			createdAt: now(),
			lastAccessedAt: now(),
			accessCount: 0,
			retentionScore: outcome === "intent.achieved" ? 1.2 : 0.8,
		};
		this.backend.memory.store(memory);
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

		this.intentTextById.delete(intentId);
		this.intentScopeById.delete(intentId);
		this.intentOutputsById.delete(intentId);
		this.threadByIntentId.delete(intentId);
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

function progressEventToDelivery(event: ProgressEvent):
	| {
			content: string;
			kind: "progress" | "result" | "notification";
	  }
	| undefined {
	switch (event.type) {
		case "intent.parsed":
			return {
				content: `Intent parsed: ${String((event.data.goal as { summary?: string })?.summary ?? "unknown")}`,
				kind: "progress",
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
		case "task.failed":
			return {
				content: `Task failed: ${String(event.data.error ?? "unknown error")}`,
				kind: "notification",
			};
		case "intent.achieved":
			return {
				content: "Intent achieved.",
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
