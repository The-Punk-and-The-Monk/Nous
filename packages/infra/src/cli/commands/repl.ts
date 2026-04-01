import readline from "node:readline";
import type {
	DialogueMessage,
	ResolveControlInputResult,
	StatusSnapshot,
	ThreadSnapshot,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import { createPersistenceBackend } from "@nous/persistence";
import { DaemonClientSession } from "../../daemon/client.ts";
import { getDaemonPaths } from "../../daemon/paths.ts";
import { daemonCommand } from "./daemon.ts";
import { debugCommand } from "./debug.ts";
import { eventsCommand } from "./events.ts";
import { printReplCommands } from "../help.ts";
import {
	resolveSlashCommand,
	translateControlResolution,
} from "../repl-control.ts";
import { memoryCommand } from "./memory.ts";
import { networkCommand } from "./network.ts";
import { permissionsCommand } from "./permissions.ts";
import { colors } from "../ui/colors.ts";
import { attachCommand, renderDialogueMessage } from "./attach.ts";

const CONTROL_ROUTING_TIMEOUT_MS = 15_000;

export async function openDaemonRepl(options?: {
	initialThreadId?: string;
}): Promise<void> {
	const session = new DaemonClientSession();
	const channel = createChannel();
	await session.connect();

	let currentThreadId = options?.initialThreadId;
	let shuttingDown = false;
	let inputInFlight = false;

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: promptForThread(currentThreadId),
	});

	const stopListening = session.onMessage((message) => {
		if (
			message.type !== "progress" &&
			message.type !== "result" &&
			message.type !== "notification" &&
			message.type !== "decision_needed"
		) {
			return;
		}

		const dialogue = message.payload as DialogueMessage;
		if (!dialogue?.id) return;
		process.stdout.write("\n");
		const prefix =
			currentThreadId &&
			message.threadId &&
			message.threadId !== currentThreadId
				? `[${message.threadId.slice(0, 12)}]`
				: undefined;
		renderDialogueMessage(dialogue, prefix ? { prefix } : undefined);
		rl.setPrompt(promptForThread(currentThreadId));
		if (!inputInFlight) {
			rl.prompt();
		}
	});

	if (currentThreadId) {
		await printThreadSnapshot(session, channel, currentThreadId);
		await attachToThread(session, channel, currentThreadId, false);
	} else {
		await attachToThread(session, channel, currentThreadId, true);
	}

	printReplCommands({
		daemonRunning: true,
		currentThreadId,
	});
	rl.prompt();

	await new Promise<void>((resolve) => {
		rl.on("line", (line) => {
			void handleLine(line);
		});

		const handleLine = async (line: string) => {
			const input = line.trim();
			if (!input) {
				if (!inputInFlight) {
					rl.prompt();
				}
				return;
			}
			if (inputInFlight) {
				console.log(
					`  ${colors.dim("Still handling the previous input. Please wait for the prompt to return.")}`,
				);
				return;
			}

			inputInFlight = true;
			rl.pause();

			try {
				await attachToThread(session, channel, currentThreadId, true);
				const resolved = await resolveReplInput(
					input,
					session,
					channel,
					currentThreadId,
				);

				if (resolved.kind === "clarify") {
					console.log(`  ${colors.yellow(resolved.message)}`);
					return;
				}

				if (resolved.kind === "execute") {
					if (resolved.source === "model") {
						console.log(`  ${colors.dim(`control → ${resolved.interpretedAs}`)}`);
					}
					switch (resolved.action) {
						case "show_commands":
							printReplCommands({
								daemonRunning: true,
								currentThreadId,
								query: resolved.query,
							});
							return;
						case "show_status":
							await printStatus(session, channel);
							return;
						case "show_daemon_status":
							await daemonCommand("status");
							return;
						case "debug_daemon":
							withDebugBackend((backend) =>
								debugCommand(["daemon"], backend),
							);
							return;
						case "debug_thread":
							if (!(resolved.threadId ?? currentThreadId)) {
								console.log(
									`  ${colors.yellow("Provide a thread id like /debug thread <threadId>, or attach to a thread first.")}`,
								);
								return;
							}
							withDebugBackend((backend) =>
								debugCommand(
									[
										"thread",
										resolved.threadId ?? currentThreadId ?? "",
									],
									backend,
								),
							);
							return;
						case "show_events":
							await withDebugBackendAsync((backend) =>
								eventsCommand(backend.events, {
									limit: resolved.limit ?? readOptionalLimit(resolved.query),
								}),
							);
							return;
						case "show_memory":
							withDebugBackend((backend) =>
								memoryCommand(backend.memory, {
									search: resolved.query,
									limit: 20,
								}),
							);
							return;
						case "show_permissions":
							permissionsCommand([]);
							return;
						case "show_network_status":
							await withDebugBackendAsync((backend) =>
								networkCommand(["status"], { eventStore: backend.events }),
							);
							return;
						case "show_network_policy":
							await withDebugBackendAsync((backend) =>
								networkCommand(["policy"], { eventStore: backend.events }),
							);
							return;
						case "show_network_log":
							await withDebugBackendAsync((backend) =>
								networkCommand(
									[
										"log",
										String(
											resolved.limit ?? readOptionalLimit(resolved.query) ?? 20,
										),
									],
									{ eventStore: backend.events },
								),
							);
							return;
						case "attach_thread":
							currentThreadId = resolved.threadId;
							if (currentThreadId) {
								await printThreadSnapshot(session, channel, currentThreadId);
								await attachToThread(
									session,
									channel,
									currentThreadId,
									false,
								);
							}
							return;
						case "detach_thread":
							if (!currentThreadId) {
								console.log(
									`  ${colors.dim("Already in global REPL mode; no thread is currently attached.")}`,
								);
							} else {
								currentThreadId = undefined;
								await attachToThread(session, channel, currentThreadId, true);
								console.log(
									`  ${colors.dim("Detached from the current thread. The next message can start or discover another thread.")}`,
								);
							}
							return;
						case "exit_repl":
							shuttingDown = true;
							rl.close();
							return;
					}
				}

				const response = await session.request({
					type: currentThreadId ? "send_message" : "submit_intent",
					channel,
					payload: {
						text: resolved.text,
						threadId: currentThreadId,
						scope: channel.scope,
					},
				});
				const payload = response.payload as {
					threadId: string;
					messageId: string;
				};
				if (payload.threadId !== currentThreadId) {
					currentThreadId = payload.threadId;
					await attachToThread(session, channel, currentThreadId, true);
				}
				console.log(
					`  ${colors.dim("submitted")} ${payload.threadId} ${colors.dim(payload.messageId)}`,
				);
			} catch (error) {
				console.log(
					`  ${colors.red(`REPL input failed: ${(error as Error).message}`)}`,
				);
			} finally {
				inputInFlight = false;
				rl.resume();
				rl.setPrompt(promptForThread(currentThreadId));
				if (!shuttingDown) {
					rl.prompt();
				}
			}
		};

		rl.on("close", async () => {
			stopListening();
			if (!shuttingDown) {
				console.log();
			}
			try {
				await session.request({
					type: "detach",
					channel,
					payload: {},
				});
			} catch {
				// ignore
			}
			session.close();
			resolve();
		});
	});
}

function createChannel() {
	return {
		id: prefixedId("cli"),
		type: "cli" as const,
		scope: { workingDirectory: process.cwd(), projectRoot: process.cwd() },
	};
}

async function attachToThread(
	session: DaemonClientSession,
	channel: ReturnType<typeof createChannel>,
	threadId?: string,
	replayPending = true,
): Promise<void> {
	await session.request({
		type: "attach",
		channel,
		payload: {
			threadId,
			replayPending,
			channel: {
				...channel,
				status: "connected" as const,
				connectedAt: now(),
				lastSeenAt: now(),
				subscriptions: [
					"progress",
					"result",
					"notification",
					"decision_needed",
				],
			},
		},
	});
}

async function printThreadSnapshot(
	session: DaemonClientSession,
	channel: ReturnType<typeof createChannel>,
	threadId: string,
): Promise<void> {
	const response = await session.request({
		type: "get_thread",
		channel,
		payload: { threadId },
	});
	if (response.type !== "response") {
		console.log(`\n  ${colors.red("Thread not found.")}\n`);
		return;
	}
	attachCommand(response.payload as ThreadSnapshot);
}

async function printStatus(
	session: DaemonClientSession,
	channel: ReturnType<typeof createChannel>,
): Promise<void> {
	const response = await session.request({
		type: "get_status",
		channel,
		payload: {},
	});
	const snapshot = response.payload as StatusSnapshot;
	console.log(colors.bold("\n  νοῦς — Daemon Status\n"));
	console.log(
		`  ${colors.dim("Active intents:")} ${snapshot.activeIntents.length}  ${colors.dim("Active tasks:")} ${snapshot.activeTasks.length}  ${colors.dim("Pending outbox:")} ${snapshot.pendingOutboxCount}\n`,
	);
}

function promptForThread(threadId?: string): string {
	return threadId
		? `${colors.dim(`[${threadId.slice(0, 12)}]`)} nous> `
		: "nous> ";
}

async function resolveReplInput(
	input: string,
	session: DaemonClientSession,
	channel: ReturnType<typeof createChannel>,
	currentThreadId?: string,
) {
	const slashResolution = resolveSlashCommand(input);
	if (slashResolution !== undefined) {
		return slashResolution.kind === "clarify"
			? {
					kind: "clarify" as const,
					source: "slash" as const,
					message: slashResolution.message ?? "Unknown REPL command.",
				}
			: {
					kind: "execute" as const,
					source: "slash" as const,
					action: slashResolution.action!,
					query: slashResolution.query,
					threadId: slashResolution.threadId,
					limit: slashResolution.limit,
					interpretedAs: slashResolution.interpretedAs ?? input,
				};
	}

	const response = (await withTimeout(
		session.request({
			type: "resolve_control_input",
			channel,
			payload: {
				text: input,
				surface: "repl",
				currentThreadId,
			},
		}),
		CONTROL_ROUTING_TIMEOUT_MS,
		"Natural-language control routing timed out.",
	)) as { payload: ResolveControlInputResult };
	return translateControlResolution(input, {
		resolution: response.payload.resolution,
	});
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	message: string,
): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
			}),
		]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

function withDebugBackend<T>(
	fn: (backend: ReturnType<typeof createPersistenceBackend>) => T,
): T {
	return createDebugBackendUser(fn);
}

async function withDebugBackendAsync<T>(
	fn: (backend: ReturnType<typeof createPersistenceBackend>) => Promise<T>,
): Promise<T> {
	const backend = createPersistenceBackend(getDaemonPaths().dbPath);
	try {
		return await fn(backend);
	} finally {
		backend.close();
	}
}

function createDebugBackendUser<T>(
	fn: (backend: ReturnType<typeof createPersistenceBackend>) => T,
): T {
	const backend = createPersistenceBackend(getDaemonPaths().dbPath);
	try {
		return fn(backend);
	} finally {
		backend.close();
	}
}

function readOptionalLimit(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number(value.trim());
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return Math.max(1, Math.floor(parsed));
}
