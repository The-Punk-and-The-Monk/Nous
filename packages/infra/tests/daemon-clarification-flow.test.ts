import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	ClientEnvelope,
	ContentBlock,
	DialogueMessage,
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

describe("NousDaemon clarification resume flow", () => {
	test("routes in-thread clarification replies back into the original intent and completes in the same thread", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-daemon-clarify-"));
		tempDirs.push(root);
		process.env.NOUS_HOME = join(root, ".nous");
		process.env.NOUS_DB = undefined;
		process.env.NOUS_SOCKET = undefined;
		process.env.NOUS_PID_FILE = undefined;
		process.env.NOUS_STATE_FILE = undefined;

		const daemon = new NousDaemon({
			llm: new ScriptedProvider([
				'{"goal":{"summary":"Inspect auth changes","successCriteria":["Identify what is broken"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect auth-related changes and report findings","successCriteria":["Identify what is broken"],"boundaries":["Do not modify files until clarified"],"interruptionPolicy":"interactive","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"light","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Need branch clarification before investigation."},"clarificationQuestions":["Which branch or commit should I inspect?"]}',
				'{"disposition":"decision_response","rationale":"The message directly answers the pending clarification and adds a read-only boundary."}',
				'{"goal":{"summary":"Inspect auth changes on feature/auth-refresh","successCriteria":["Identify what is broken in auth flow"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect auth-related changes on feature/auth-refresh and report findings","successCriteria":["Identify what is broken in auth flow"],"boundaries":["Do not modify files"],"interruptionPolicy":"minimal","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"none","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Clarification resolved; bounded read-only execution can proceed directly."},"clarificationQuestions":[]}',
				"Auth refresh likely broke token renewal because the refresh path changed without updating the consuming auth flow.",
			]),
		});

		try {
			const internals = daemon as unknown as {
				controller: {
					handle(message: ClientEnvelope): Promise<
						| {
								type: string;
								threadId?: string;
								payload?: Record<string, unknown>;
						  }
						| undefined
					>;
				};
				backend: {
					intents: {
						getById(id: string):
							| {
									id: string;
									status: string;
									workingText?: string;
									contract?: { summary?: string };
							  }
							| null
							| undefined;
					};
					tasks: { getByIntent(intentId: string): unknown[] };
					decisions: {
						getPendingByThread(threadId: string): Array<{
							id: string;
							intentId: string;
						}>;
						getById(id: string): { status: string } | null | undefined;
					};
				};
				dialogue: {
					getThreadSnapshot(payload: {
						threadId: string;
					}):
						| {
								thread: { metadata?: Record<string, unknown> };
								messages: DialogueMessage[];
						  }
						| null
						| undefined;
				};
			};
			const { controller, backend, dialogue } = internals;

			const submitAck = await controller.handle(
				makeEnvelope({
					id: "req_submit",
					type: "submit_intent",
					payload: {
						text: "Inspect the auth changes and tell me what broke",
					},
				}),
			);
			expect(submitAck?.type).toBe("ack");
			const threadId = String(submitAck?.threadId);
			expect(threadId).toBeTruthy();

			await waitFor(() => {
				const pending = backend.decisions.getPendingByThread(threadId);
				const snapshot = dialogue.getThreadSnapshot({ threadId });
				return (
					pending.length === 1 &&
					Boolean(
						snapshot?.messages.some(
							(message) =>
								message.role === "assistant" &&
								String(message.metadata?.kind ?? "") === "decision_needed",
						),
					)
				);
			});

			const pendingDecision = backend.decisions.getPendingByThread(threadId)[0];
			expect(pendingDecision).toBeDefined();
			const intentId = String(pendingDecision?.intentId);
			expect(backend.intents.getById(intentId)?.status).toBe(
				"awaiting_clarification",
			);

			const replyAck = await controller.handle(
				makeEnvelope({
					id: "req_reply",
					type: "send_message",
					payload: {
						threadId,
						text: "Look at feature/auth-refresh and keep it read-only.",
					},
				}),
			);
			expect(replyAck?.type).toBe("ack");
			expect(replyAck?.threadId).toBe(threadId);

			await waitFor(() => {
				const intent = backend.intents.getById(intentId);
				return intent?.status === "achieved";
			});

			const finalIntent = backend.intents.getById(intentId);
			expect(finalIntent?.workingText).toContain("User clarification response");
			expect(finalIntent?.contract?.summary).toContain("feature/auth-refresh");
			expect(backend.tasks.getByIntent(intentId)).toHaveLength(1);
			expect(
				backend.decisions.getById(String(pendingDecision?.id))?.status,
			).toBe("resolved");
			expect(backend.decisions.getPendingByThread(threadId)).toHaveLength(0);

			const snapshot = dialogue.getThreadSnapshot({ threadId });
			const assistantMessages = snapshot?.messages.filter(
				(message) => message.role === "assistant",
			);
			expect(
				assistantMessages?.some((message) =>
					message.content.includes(
						"Clarification needed before continuing",
					),
				),
			).toBe(true);
			expect(
				assistantMessages?.some((message) =>
					message.content.includes(
						"Clarification resolved. Restored the original intent.",
					),
				),
			).toBe(true);
			expect(
				assistantMessages?.some((message) =>
					String(message.metadata?.presentation) === "answer",
				),
			).toBe(true);
			expect(snapshot?.thread.metadata?.intentIds).toEqual([intentId]);
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
			id: `mock_${this.index}`,
			content: [{ type: "text", text }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}

function makeEnvelope(
	overrides: Partial<ClientEnvelope>,
): ClientEnvelope<Record<string, unknown>> {
	return {
		id: "req_default",
		type: "get_status",
		channel: {
			id: "channel_cli",
			type: "cli",
			scope: {
				workingDirectory: "/tmp/demo",
				projectRoot: "/tmp/demo",
			},
		},
		payload: {},
		timestamp: new Date().toISOString(),
		...overrides,
	};
}

async function waitFor(
	condition: () => boolean,
	timeoutMs = 3000,
	pollMs = 25,
): Promise<void> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (condition()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, pollMs));
	}
	throw new Error(`Condition not met within ${timeoutMs}ms`);
}
