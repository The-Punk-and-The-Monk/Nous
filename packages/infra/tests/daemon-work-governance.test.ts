import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	Intent,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
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

describe("NousDaemon work-governance integration", () => {
	test("creates a flow and binding when an intent is tracked to a thread", async () => {
		const daemon = createDaemon(new NoopProvider());

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_auth",
				title: "Auth thread",
				channelId: "channel_cli",
			});
			internals.backend.intents.create(makeIntent("intent_auth"));

			internals.trackIntentForThread(
				"intent_auth",
				thread.id,
				"Inspect auth changes",
				BASE_SCOPE,
			);

			const intent = internals.backend.intents.getById("intent_auth");
			expect(intent?.flowId).toBeDefined();
			const flow = intent?.flowId
				? internals.backend.work.getFlowById(intent.flowId)
				: undefined;
			expect(flow?.ownerThreadId).toBe(thread.id);
			expect(flow?.primaryIntentId).toBe("intent_auth");
			expect(flow?.relatedIntentIds).toEqual(["intent_auth"]);
			expect(
				internals.backend.work.listFlowThreadBindings({ flowId: flow?.id })[0],
			).toMatchObject({
				flowId: flow?.id,
				threadId: thread.id,
				role: "primary",
			});
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
	dialogue: {
		ensureThread(params: {
			threadId: string;
			title: string;
			channelId?: string;
		}): { id: string };
	};
	backend: {
		intents: {
			create(intent: Intent): void;
			getById(id: string): Intent | undefined;
		};
		work: {
			getFlowById(id: string): { ownerThreadId?: string; primaryIntentId?: string; relatedIntentIds: string[] } | undefined;
			listFlowThreadBindings(query: { flowId?: string }): Array<{
				flowId: string;
				threadId: string;
				role: string;
			}>;
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
	const root = mkdtempSync(join(tmpdir(), "nous-daemon-work-"));
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
		status: "active",
		source: "human",
		createdAt: new Date().toISOString(),
	};
}

class NoopProvider implements LLMProvider {
	readonly name = "noop";

	getCapabilities(): LLMProviderCapabilities {
		return { structuredOutputModes: ["json_schema"] };
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		throw new Error("NoopProvider should not be called in this test");
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
