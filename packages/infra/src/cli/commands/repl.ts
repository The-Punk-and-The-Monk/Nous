import readline from "node:readline";
import type {
	DaemonEnvelope,
	DialogueMessage,
	StatusSnapshot,
	ThreadSnapshot,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import { DaemonClientSession } from "../../daemon/client.ts";
import { colors } from "../ui/colors.ts";
import { attachCommand, renderDialogueMessage } from "./attach.ts";

export async function openDaemonRepl(options?: {
	initialThreadId?: string;
}): Promise<void> {
	const session = new DaemonClientSession();
	const channel = createChannel();
	await session.connect();

	let currentThreadId = options?.initialThreadId;
	let shuttingDown = false;

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
		rl.prompt();
	});

	if (currentThreadId) {
		await printThreadSnapshot(session, channel, currentThreadId);
		await attachToThread(session, channel, currentThreadId, false);
	} else {
		await attachToThread(session, channel, currentThreadId, true);
	}

	printReplHelp();
	rl.prompt();

	await new Promise<void>((resolve) => {
		rl.on("line", async (line) => {
			const input = line.trim();
			if (!input) {
				rl.prompt();
				return;
			}

			if (input === "/exit" || input === "/quit") {
				shuttingDown = true;
				rl.close();
				return;
			}

			if (input === "/help") {
				printReplHelp();
				rl.prompt();
				return;
			}

			if (input === "/status") {
				await printStatus(session, channel);
				rl.prompt();
				return;
			}

			if (input.startsWith("/attach ")) {
				currentThreadId = input.slice("/attach ".length).trim() || undefined;
				if (currentThreadId) {
					await printThreadSnapshot(session, channel, currentThreadId);
					await attachToThread(session, channel, currentThreadId, false);
				} else {
					await attachToThread(session, channel, currentThreadId, true);
				}
				rl.setPrompt(promptForThread(currentThreadId));
				rl.prompt();
				return;
			}

			const response = await session.request({
				type: currentThreadId ? "send_message" : "submit_intent",
				channel,
				payload: {
					text: input,
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
			rl.setPrompt(promptForThread(currentThreadId));
			rl.prompt();
		});

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

function printReplHelp(): void {
	console.log(colors.bold("\n  νοῦς — REPL\n"));
	console.log(
		`  ${colors.dim("/attach <threadId>")} attach to an existing thread`,
	);
	console.log(`  ${colors.dim("/status")} inspect daemon activity`);
	console.log(`  ${colors.dim("/help")} show commands`);
	console.log(`  ${colors.dim("/exit")} detach and quit\n`);
}
