import type { LLMProvider, LogLevel } from "@nous/core";
import { now, prefixedId, setLogLevel } from "@nous/core";
import { Orchestrator } from "@nous/orchestrator";
import { createPersistenceBackend } from "@nous/persistence";
import {
	ContextAssembler,
	MemoryService,
	renderContextForSystemPrompt,
} from "@nous/runtime";
import { createGeneralAgent } from "../agents/general.ts";
import { ensureNousHome } from "../config/home.ts";
import {
	describePermissionBoundary,
	loadPermissionPolicy,
	resolvePermissionCapabilities,
} from "../config/permissions.ts";
import { sendDaemonRequest } from "../daemon/client.ts";
import { NousDaemon } from "../daemon/server.ts";
import { buildUserStateGrounding } from "../intake/grounding.ts";
import { ProcessSupervisor } from "../supervisor/supervisor.ts";
import { agentsCommand } from "./commands/agents.ts";
import { attachCommand } from "./commands/attach.ts";
import { daemonCommand, isDaemonRunning } from "./commands/daemon.ts";
import { debugCommand } from "./commands/debug.ts";
import { eventsCommand } from "./commands/events.ts";
import { memoryCommand } from "./commands/memory.ts";
import { networkCommand } from "./commands/network.ts";
import { permissionsCommand } from "./commands/permissions.ts";
import { openDaemonRepl } from "./commands/repl.ts";
import { runCommand } from "./commands/run.ts";
import { statusCommand } from "./commands/status.ts";
import { printCliHelp } from "./help.ts";
import { createLLMProviderFromEnv } from "./provider.ts";
import { createAutoApprovePermissionCallback, createInteractivePermissionCallback } from "./ui/permission-prompt.ts";
import { colors } from "./ui/colors.ts";

export async function main(args: string[]): Promise<void> {
	// Configure log level from env or --log-level flag
	const logLevelIdx = args.indexOf("--log-level");
	if (logLevelIdx >= 0 && args[logLevelIdx + 1]) {
		setLogLevel(args[logLevelIdx + 1] as LogLevel);
		args.splice(logLevelIdx, 2);
	}

	// Parse --yes / --dangerously-skip-permissions flag
	const yesIdx = Math.max(
		args.indexOf("--yes"),
		args.indexOf("-y"),
		args.indexOf("--dangerously-skip-permissions"),
	);
	const autoApproveAll = yesIdx >= 0;
	if (yesIdx >= 0) {
		args.splice(yesIdx, 1);
	}

	// Parse args
	const command = args[0];

	if (!command) {
		if (isDaemonRunning()) {
			await openDaemonRepl();
			return;
		}
		printCliHelp({ daemonRunning: false });
		return;
	}

	if (command === "--help" || command === "-h") {
		printCliHelp({ daemonRunning: isDaemonRunning() });
		return;
	}

	if (command === "help" || command === "commands") {
		printCliHelp({
			query: args.slice(1).join(" ").trim() || undefined,
			daemonRunning: isDaemonRunning(),
		});
		return;
	}

	if (command === "daemon") {
		const action = (args[1] ?? "status") as
			| "start"
			| "stop"
			| "status"
			| "_serve";
		if (action === "_serve") {
			const { provider: llm } = createLLMProviderFromEnv();
			const daemon = new NousDaemon({ llm });
			await daemon.start();
			await new Promise(() => {});
		}
		await daemonCommand(action);
		return;
	}

	// Initialize persistence
	const home = ensureNousHome();
	const dbPath = process.env.NOUS_DB ?? `${home.stateDir}/nous.db`;

	const backend = createPersistenceBackend(dbPath);

	if (command === "status") {
		if (isDaemonRunning()) {
			const response = await sendDaemonRequest({
				id: prefixedId("req"),
				type: "get_status",
				channel: {
					id: "cli_status",
					type: "cli",
					scope: {},
				},
				payload: {},
				timestamp: now(),
			});
			const snapshot = response.payload as {
				activeIntents: { raw: string; id: string; goal: { summary: string } }[];
				activeTasks: { id: string; status: string; description: string }[];
				pendingOutboxCount: number;
				connectedChannels: { id: string; type: string }[];
			};
			console.log(colors.bold("\n  νοῦς — Daemon Status\n"));
			console.log(
				`  ${colors.dim("Active intents:")} ${snapshot.activeIntents.length}  ${colors.dim("Active tasks:")} ${snapshot.activeTasks.length}  ${colors.dim("Pending outbox:")} ${snapshot.pendingOutboxCount}`,
			);
			if (snapshot.activeIntents.length > 0) {
				console.log();
				for (const intent of snapshot.activeIntents) {
					console.log(`  ${colors.cyan("Intent:")} ${intent.raw}`);
					console.log(`  ${colors.dim("ID:")} ${intent.id}`);
					console.log(`  ${colors.dim("Goal:")} ${intent.goal.summary}`);
					console.log();
				}
			}
			return;
		}
		statusCommand(backend.tasks, backend.intents);
		backend.close();
		return;
	}

	if (command === "events") {
		const limit = Number(args[1]) || 50;
		eventsCommand(backend.events, { limit });
		backend.close();
		return;
	}

	if (command === "debug") {
		debugCommand(args.slice(1), backend);
		backend.close();
		return;
	}

	if (command === "memory") {
		const search = args[1] || undefined;
		memoryCommand(backend.memory, { search, limit: 20 });
		backend.close();
		return;
	}

	if (command === "permissions") {
		permissionsCommand(args.slice(1));
		backend.close();
		return;
	}

	if (command === "network") {
		await networkCommand(args.slice(1), { eventStore: backend.events });
		backend.close();
		return;
	}

	if (command === "attach") {
		if (!isDaemonRunning()) {
			console.log(`\n  ${colors.red("Daemon is not running.")}\n`);
			backend.close();
			return;
		}
		const threadId = args[1];
		if (!threadId) {
			console.log(`\n  ${colors.yellow("Usage: nous attach <threadId>")}\n`);
			backend.close();
			return;
		}
		if (!args.includes("--once")) {
			backend.close();
			await openDaemonRepl({ initialThreadId: threadId });
			return;
		}
		const response = await sendDaemonRequest({
			id: prefixedId("req"),
			type: "get_thread",
			channel: {
				id: "cli_attach",
				type: "cli",
				scope: {},
			},
			payload: { threadId },
			timestamp: now(),
		});
		if (response.type === "error") {
			console.log(`\n  ${colors.red("Thread not found.")}\n`);
			backend.close();
			return;
		}
		attachCommand(response.payload as Parameters<typeof attachCommand>[0]);
		backend.close();
		return;
	}

	if (command === "agents") {
		if (isDaemonRunning()) {
			console.log(
				`\n  ${colors.yellow("Agent listing is currently foreground-only and is not wired through the daemon yet.")}`,
			);
			console.log(
				`  ${colors.dim("Stop the daemon or use a foreground run if you want to inspect the local router directly.")}\n`,
			);
			backend.close();
			return;
		}
	}

	// Commands that need the orchestrator — select provider
	const { provider: llm, providerName } = createLLMProviderFromEnv();

	console.log(`  ${colors.dim(`Provider: ${providerName}`)}\n`);

	if (isDaemonRunning()) {
		const response = await sendDaemonRequest({
			id: prefixedId("req"),
			type: "submit_intent",
			channel: {
				id: "cli_submit",
				type: "cli",
				scope: { workingDirectory: process.cwd() },
			},
			payload: {
				text: args.join(" "),
				scope: { workingDirectory: process.cwd() },
			},
			timestamp: now(),
		});
		const payload = response.payload as {
			threadId: string;
			messageId: string;
			status: string;
		};
		console.log(colors.bold("\n  νοῦς — Intent Submitted\n"));
		console.log(`  ${colors.dim("Thread:")} ${payload.threadId}`);
		console.log(`  ${colors.dim("Message:")} ${payload.messageId}`);
		console.log(
			`  ${colors.dim("Next:")} use ${colors.cyan(`nous attach ${payload.threadId}`)} to inspect the thread.\n`,
		);
		backend.close();
		return;
	}

	const orchestrator = new Orchestrator({
		llm,
		eventStore: backend.events,
		taskStore: backend.tasks,
		intentStore: backend.intents,
	});

	// Register default agents
	const generalAgent = createGeneralAgent();
	orchestrator.registerAgent(generalAgent);
	orchestrator.start();

	if (command === "agents") {
		agentsCommand(orchestrator.getRouter());
		backend.close();
		return;
	}

	// Default: treat the entire argument string as an intent
	const intentText = args.join(" ");
	const contextAssembler = new ContextAssembler();
	const memory = new MemoryService({
		store: backend.memory,
		agentId: "nous",
	});
	const permissionPolicy = loadPermissionPolicy();
	const permissionCapabilities = resolvePermissionCapabilities(
		permissionPolicy,
		{ projectRoot: process.cwd() },
	);
	const assembledContext = contextAssembler.assemble({
		scope: {
			workingDirectory: process.cwd(),
			projectRoot: process.cwd(),
		},
		activeIntents: backend.intents.getActive().map((intent) => ({
			id: intent.id,
			raw: intent.raw,
			goal: intent.goal,
			status: intent.status,
			source: intent.source,
		})),
		recentMemoryHints: memory.retrieveForContext({
			query: intentText,
			scope: {
				workingDirectory: process.cwd(),
				projectRoot: process.cwd(),
			},
		}),
		permissionContext: describePermissionBoundary(permissionPolicy, {
			projectRoot: process.cwd(),
		}),
	});
	const systemPrompt = renderContextForSystemPrompt(assembledContext);
	const grounding = buildUserStateGrounding({
		context: assembledContext,
	});

	// Start supervisor
	const supervisor = new ProcessSupervisor({
		taskStore: backend.tasks,
		eventStore: backend.events,
	});
	supervisor.start();
	supervisor.onShutdown(() => {
		orchestrator.stop();
		backend.close();
	});

	const onPermissionNeeded = autoApproveAll
		? createAutoApprovePermissionCallback()
		: createInteractivePermissionCallback();

	await runCommand(orchestrator, intentText, {
		systemPrompt,
		capabilities: permissionCapabilities,
		grounding,
		onPermissionNeeded,
	});

	orchestrator.stop();
	supervisor.stop();
	backend.close();
}
