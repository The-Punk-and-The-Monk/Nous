import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	ClientEnvelope,
	ContentBlock,
	Intent,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
	Task,
} from "@nous/core";
import { NousDaemon } from "../src/daemon/server.ts";

const tempDirs: string[] = [];
const ENV_KEYS = [
	"NOUS_HOME",
	"NOUS_DB",
	"NOUS_SOCKET",
	"NOUS_PID_FILE",
	"NOUS_STATE_FILE",
] as const;

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (ORIGINAL_ENV[key] === undefined) {
			delete process.env[key];
			continue;
		}
		process.env[key] = ORIGINAL_ENV[key];
	}

	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("NousDaemon cancel flow", () => {
	test("cancels a tracked intent from the thread and stops queued work", async () => {
		const daemon = createDaemon(new NoopProvider());

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_cancel",
				title: "Cancel thread",
				channelId: "channel_cli",
			});
			internals.backend.intents.create(makeIntent("intent_cancel"));
			internals.trackIntentForThread(
				"intent_cancel",
				thread.id,
				"Inspect auth changes",
				BASE_SCOPE,
			);
			internals.backend.tasks.create({
				id: "task_cancel",
				intentId: "intent_cancel",
				dependsOn: [],
				description: "Inspect auth service",
				capabilitiesRequired: [],
				status: "queued",
				retries: 0,
				maxRetries: 3,
				backoffSeconds: 2,
				createdAt: new Date().toISOString(),
				queuedAt: new Date().toISOString(),
			});

			const response = await internals.controller.handle(
				makeEnvelope({
					type: "cancel_intent",
					payload: {
						intentId: "intent_cancel",
						threadId: thread.id,
						reason: "Stop this task",
					},
				}),
			);

			expect(response?.type).toBe("ack");
			expect(internals.backend.intents.getById("intent_cancel")?.status).toBe(
				"abandoned",
			);
			expect(internals.backend.tasks.getById("task_cancel")?.status).toBe(
				"cancelled",
			);
			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			expect(
				snapshot?.messages.some((message) =>
					message.content.includes("Intent cancelled"),
				),
			).toBe(true);
		} finally {
			await daemon.shutdown();
		}
	});
	test("treats an in-thread stop message as cancellation of the current intent", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"disposition":"cancel_current_intent","rationale":"The user clearly wants to stop the active work."}',
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_cancel_message",
				title: "Cancel by message",
				channelId: "channel_cli",
			});
			internals.backend.intents.create(makeIntent("intent_cancel_message"));
			internals.trackIntentForThread(
				"intent_cancel_message",
				thread.id,
				"Inspect auth changes",
				BASE_SCOPE,
			);
			internals.backend.tasks.create({
				id: "task_cancel_message",
				intentId: "intent_cancel_message",
				dependsOn: [],
				description: "Inspect auth service",
				capabilitiesRequired: [],
				status: "queued",
				retries: 0,
				maxRetries: 3,
				backoffSeconds: 2,
				createdAt: new Date().toISOString(),
				queuedAt: new Date().toISOString(),
			});

			const response = await internals.controller.handle(
				makeEnvelope({
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Stop this. Don't continue the auth investigation.",
					},
				}),
			);

			expect(response?.type).toBe("ack");
			expect(
				internals.backend.intents.getById("intent_cancel_message")?.status,
			).toBe("abandoned");
			expect(
				internals.backend.tasks.getById("task_cancel_message")?.status,
			).toBe("cancelled");
		} finally {
			await daemon.shutdown();
		}
	});
});

const ORIGINAL_ENV = {
	NOUS_HOME: process.env.NOUS_HOME,
	NOUS_DB: process.env.NOUS_DB,
	NOUS_SOCKET: process.env.NOUS_SOCKET,
	NOUS_PID_FILE: process.env.NOUS_PID_FILE,
	NOUS_STATE_FILE: process.env.NOUS_STATE_FILE,
} as const;

const BASE_SCOPE = {
	workingDirectory: "/tmp/demo",
	projectRoot: "/tmp/demo",
} as const;

interface DaemonInternals {
	controller: {
		handle(message: ClientEnvelope): Promise<
			| {
					type: string;
					threadId?: string;
			  }
			| undefined
		>;
	};
	dialogue: {
		ensureThread(params: {
			threadId: string;
			title: string;
			channelId?: string;
		}): { id: string };
		getThreadSnapshot(payload: { threadId: string }):
			| {
					messages: Array<{ content: string }>;
			  }
			| undefined;
	};
	backend: {
		intents: {
			create(intent: Intent): void;
			getById(id: string): Intent | undefined;
		};
		tasks: {
			create(task: Record<string, unknown>): void;
			getById(id: string): Task | undefined;
		};
	};
	trackIntentForThread(
		intentId: string,
		threadId: string,
		text: string,
		scope: typeof BASE_SCOPE,
	): void;
}

function createDaemon(llm: LLMProvider): NousDaemon {
	const root = mkdtempSync(join(tmpdir(), "nous-daemon-cancel-"));
	tempDirs.push(root);
	process.env.NOUS_HOME = join(root, ".nous");
	process.env.NOUS_DB = undefined;
	process.env.NOUS_SOCKET = undefined;
	process.env.NOUS_PID_FILE = undefined;
	process.env.NOUS_STATE_FILE = undefined;
	return new NousDaemon({ llm });
}

function makeIntent(id: string): Intent {
	return {
		id,
		raw: "Inspect auth changes",
		workingText: "Inspect auth changes",
		goal: {
			summary: "Inspect auth changes",
			successCriteria: ["Report findings"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always",
		contract: {
			summary: "Inspect auth changes and report findings",
			successCriteria: ["Report findings"],
			boundaries: ["Do not modify files"],
			interruptionPolicy: "interactive",
			deliveryMode: "structured_with_evidence",
		},
		executionDepth: {
			planningDepth: "light",
			timeDepth: "foreground",
			organizationDepth: "single_agent",
			initiativeMode: "reactive",
			rationale: "Bounded task.",
		},
		status: "active",
		source: "human",
		createdAt: new Date().toISOString(),
	};
}

function makeEnvelope(
	overrides: Partial<ClientEnvelope>,
): ClientEnvelope<Record<string, unknown>> {
	return {
		id: "req_cancel",
		type: "get_status",
		channel: {
			id: "channel_cli",
			type: "cli",
			scope: BASE_SCOPE,
		},
		payload: {},
		timestamp: new Date().toISOString(),
		...overrides,
	};
}

class ScriptedProvider implements LLMProvider {
	readonly name = "scripted";
	private index = 0;

	constructor(private readonly outputs: string[]) {}

	getCapabilities(): LLMProviderCapabilities {
		return { structuredOutputModes: ["json_schema"] };
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		const text = this.outputs[this.index++];
		if (!text) {
			throw new Error("No scripted provider output remaining");
		}
		return {
			id: `scripted_${this.index}`,
			content: [{ type: "text", text }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}

class NoopProvider implements LLMProvider {
	readonly name = "noop";

	getCapabilities(): LLMProviderCapabilities {
		return { structuredOutputModes: ["json_schema"] };
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		return {
			id: "noop",
			content: [{ type: "text", text: "noop" }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
