import type { LLMProvider, LogLevel } from "@nous/core";
import { setLogLevel } from "@nous/core";
import { Orchestrator } from "@nous/orchestrator";
import { createPersistenceBackend } from "@nous/persistence";
import {
	AnthropicProvider,
	ClaudeCliProvider,
	OpenAICompatProvider,
} from "@nous/runtime";
import { createGeneralAgent } from "../agents/general.ts";
import { ProcessSupervisor } from "../supervisor/supervisor.ts";
import { agentsCommand } from "./commands/agents.ts";
import { eventsCommand } from "./commands/events.ts";
import { memoryCommand } from "./commands/memory.ts";
import { runCommand } from "./commands/run.ts";
import { statusCommand } from "./commands/status.ts";
import { colors } from "./ui/colors.ts";

export async function main(args: string[]): Promise<void> {
	// Configure log level from env or --log-level flag
	const logLevelIdx = args.indexOf("--log-level");
	if (logLevelIdx >= 0 && args[logLevelIdx + 1]) {
		setLogLevel(args[logLevelIdx + 1] as LogLevel);
		args.splice(logLevelIdx, 2);
	}

	// Parse args
	const command = args[0];

	if (!command || command === "--help" || command === "-h") {
		printUsage();
		return;
	}

	// Initialize persistence
	const dbPath = process.env.NOUS_DB ?? ".nous/nous.db";
	// Ensure directory exists
	const { mkdirSync } = await import("node:fs");
	const { dirname } = await import("node:path");
	mkdirSync(dirname(dbPath), { recursive: true });

	const backend = createPersistenceBackend(dbPath);

	if (command === "status") {
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

	if (command === "memory") {
		const search = args[1] || undefined;
		memoryCommand(backend.memory, { search, limit: 20 });
		backend.close();
		return;
	}

	// Commands that need the orchestrator — select provider
	let llm: LLMProvider;
	let providerName: string;

	const openaiBaseURL = process.env.OPENAI_BASE_URL;
	const apiKey = process.env.ANTHROPIC_API_KEY;
	const authToken = process.env.ANTHROPIC_AUTH_TOKEN;

	if (openaiBaseURL) {
		// OpenAI-compatible endpoint (e.g. claude-max-api-proxy)
		llm = new OpenAICompatProvider({
			baseURL: openaiBaseURL,
			apiKey: process.env.OPENAI_API_KEY,
			model: process.env.OPENAI_MODEL,
		});
		providerName = `openai-compat (${openaiBaseURL})`;
	} else if (apiKey || authToken) {
		// Direct Anthropic API
		const baseURL = process.env.ANTHROPIC_BASE_URL;
		llm = new AnthropicProvider({ apiKey, authToken, baseURL });
		providerName = "anthropic";
	} else {
		// Default: use local Claude CLI (requires `claude` to be authenticated)
		llm = new ClaudeCliProvider({
			model: process.env.NOUS_MODEL ?? "sonnet",
		});
		providerName = "claude-cli";
	}

	console.log(`  ${colors.dim(`Provider: ${providerName}`)}\n`);

	const orchestrator = new Orchestrator({
		llm,
		eventStore: backend.events,
		taskStore: backend.tasks,
		intentStore: backend.intents,
	});

	// Register default agents
	const generalAgent = createGeneralAgent();
	orchestrator.registerAgent(generalAgent);

	if (command === "agents") {
		agentsCommand(orchestrator.getRouter());
		backend.close();
		return;
	}

	// Default: treat the entire argument string as an intent
	const intentText = args.join(" ");

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

	await runCommand(orchestrator, intentText);

	orchestrator.stop();
	supervisor.stop();
	backend.close();
}

function printUsage(): void {
	console.log(`
  ${colors.bold("νοῦς — Autonomous Agent Framework")}

  ${colors.bold("Usage:")}
    nous <intent>          Execute a natural language intent
    nous status            Show running tasks and intents
    nous agents            List registered agents
    nous events [N]        Show last N events (default: 50)
    nous memory [search]   View stored memories (optional search term)

  ${colors.bold("Options:")}
    --log-level <level>    Set log level: debug, info, warn, error, silent

  ${colors.bold("Environment:")}
    ${colors.dim("No env vars needed if Claude CLI is authenticated (default provider).")}

    ANTHROPIC_API_KEY      Direct Anthropic API key
    ANTHROPIC_AUTH_TOKEN   OAuth token from Claude Pro/Max subscription
    ANTHROPIC_BASE_URL     Custom Anthropic API endpoint
    OPENAI_BASE_URL        OpenAI-compatible endpoint (e.g. claude-max-api-proxy)
    OPENAI_API_KEY         API key for OpenAI-compatible endpoint
    OPENAI_MODEL           Model for OpenAI-compatible endpoint (default: claude-sonnet-4)
    NOUS_MODEL             Model for Claude CLI provider (default: sonnet)
    NOUS_DB                Database path (default: .nous/nous.db)
    NOUS_LOG_LEVEL         Log level: debug, info, warn, error, silent (default: info)

    ${colors.dim("Provider priority: OPENAI_BASE_URL > ANTHROPIC_API_KEY > Claude CLI")}

  ${colors.bold("Examples:")}
    nous "Read README.md and summarize what this project is about"
    nous "Find all TODO comments in the codebase"
    nous status
`);
}
