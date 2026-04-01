import readline from "node:readline";
import type {
	DialogueMessage,
	ResolveControlInputResult,
	StatusSnapshot,
	ThreadSnapshot,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import { DaemonClientSession } from "../../daemon/client.ts";
import { printReplCommands } from "../help.ts";
import {
	resolveSlashCommand,
	shouldAttemptModelControlResolution,
	translateControlResolution,
} from "../repl-control.ts";
import { colors } from "../ui/colors.ts";
import { attachCommand, renderDialogueMessage } from "./attach.ts";

const CONTROL_ROUTING_TIMEOUT_MS = 1_500;

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
					interpretedAs: slashResolution.interpretedAs ?? input,
				};
	}

	if (!shouldAttemptModelControlResolution(input)) {
		return {
			kind: "submit" as const,
			text: input,
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
