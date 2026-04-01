import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	ChannelScope,
	ClientEnvelope,
	ContentBlock,
	DialogueMessage,
	HandoffCapsule,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { NousDaemon } from "../src/daemon/server.ts";

const tempDirs: string[] = [];
const ORIGINAL_ENV = {
	NOUS_HOME: process.env.NOUS_HOME,
	NOUS_DB: process.env.NOUS_DB,
	NOUS_SOCKET: process.env.NOUS_SOCKET,
	NOUS_PID_FILE: process.env.NOUS_PID_FILE,
	NOUS_STATE_FILE: process.env.NOUS_STATE_FILE,
} as const;

afterEach(() => {
	for (const key of Object.keys(ORIGINAL_ENV) as Array<
		keyof typeof ORIGINAL_ENV
	>) {
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

describe("NousDaemon interaction-mode handling", () => {
	test("keeps ambiguous follow-up in chat mode without creating work", async () => {
		const daemon = createDaemon(
			new ScriptedProvider(["Sure — here's the shorter version."]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_chat",
				title: "Chat thread",
				channelId: "channel_cli",
			});

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_chat",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Can you say that shorter?",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			await waitFor(() => {
				const snapshot = internals.dialogue.getThreadSnapshot({
					threadId: thread.id,
				});
				return (
					(snapshot?.messages.filter((message) => message.role === "assistant")
						.length ?? 0) >= 1
				);
			});

			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			const assistantMessages =
				snapshot?.messages.filter((message) => message.role === "assistant") ??
				[];
			expect(assistantMessages).toHaveLength(1);
			expect(assistantMessages[0]?.content).toContain("shorter");
			expect(assistantMessages[0]?.metadata?.interactionMode).toBe("chat");
			expect(assistantMessages[0]?.metadata?.trustReceipt).toBeUndefined();
			expect(internals.backend.intents.getActive()).toHaveLength(0);
			expect(
				internals.backend.decisions.getPendingByThread(thread.id),
			).toHaveLength(0);
		} finally {
			await daemon.shutdown();
		}
	});

	test("stores relationship preference memory from a chat-mode preference note", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				"Got it — I'll keep low-risk proactive reminders in digests, avoid auto-executing them, and stay restrained.",
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_pref",
				title: "Preference thread",
				channelId: "channel_cli",
			});

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_pref",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "For low-risk proactive reminders, prefer digest delivery, don't auto-execute them, and don't be too proactive.",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			await waitFor(() => {
				const snapshot = internals.dialogue.getThreadSnapshot({
					threadId: thread.id,
				});
				return Boolean(
					snapshot?.messages.some(
						(message) => message.metadata?.interactionMode === "chat",
					),
				);
			});

			const overrides = internals.memory.deriveRelationshipBoundaryOverrides({
				scope: DEMO_SCOPE,
				threadId: thread.id,
			});
			expect(overrides.interruptionPolicy?.preferredDelivery).toBe("digest");
			expect(overrides.autonomyPolicy?.allowAmbientAutoExecution).toBe(false);
			expect(overrides.proactivityPolicy?.initiativeLevel).toBe("minimal");
		} finally {
			await daemon.shutdown();
		}
	});

	test("creates a handoff capsule without starting new work", async () => {
		const daemon = createDaemon(new ScriptedProvider([]));

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_handoff",
				title: "Handoff thread",
				channelId: "channel_cli",
			});

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_handoff",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Please hand this off to IDE as a capsule.",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			await waitFor(() => {
				const snapshot = internals.dialogue.getThreadSnapshot({
					threadId: thread.id,
				});
				return (
					snapshot?.messages.some(
						(message) =>
							message.role === "assistant" &&
							message.metadata?.interactionMode === "handoff",
					) ?? false
				);
			});

			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			const assistantMessage = snapshot?.messages.find(
				(message) => message.metadata?.interactionMode === "handoff",
			);
			const capsule = assistantMessage?.metadata?.handoffCapsule as
				| HandoffCapsule
				| undefined;
			expect(capsule?.sourceThreadId).toBe(thread.id);
			expect(capsule?.suggestedNextAction).toBeDefined();
			expect(snapshot?.thread.metadata?.handoffCapsuleId).toBe(capsule?.id);
			expect(internals.backend.intents.getActive()).toHaveLength(0);
		} finally {
			await daemon.shutdown();
		}
	});

	test("treats explicit work language on send_message as governed work", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"goal":{"summary":"Inspect auth changes","successCriteria":["Report findings"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect auth changes and report findings","successCriteria":["Report findings"],"boundaries":["Do not modify files"],"interruptionPolicy":"minimal","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"none","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Bounded read-only request."},"clarificationQuestions":[]}',
				"Auth refresh likely broke token renewal after the path change.",
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_work",
				title: "Work thread",
				channelId: "channel_cli",
			});

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_work",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Investigate the auth refresh regression and summarize it.",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			await waitFor(() => {
				const snapshot = internals.dialogue.getThreadSnapshot({
					threadId: thread.id,
				});
				return Boolean(
					snapshot?.thread.metadata?.activeWorkItemId &&
						snapshot.messages.some(
							(message) => message.metadata?.trustReceipt !== undefined,
						),
				);
			});

			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			expect(snapshot?.thread.metadata?.activeWorkItemId).toBeTruthy();
			expect(snapshot?.thread.metadata?.activeIntentId).toBe(
				snapshot?.thread.metadata?.activeWorkItemId,
			);
			expect(
				internals.backend.decisions.getPendingByThread(thread.id),
			).toHaveLength(0);
			expect(
				snapshot?.messages.some(
					(message) => message.metadata?.trustReceipt !== undefined,
				),
			).toBe(true);
		} finally {
			await daemon.shutdown();
		}
	});

	test("does not restore work from inferred continuity language alone", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				"I kept this in chat mode because the request did not explicitly enter governed work.",
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_inferred",
				title: "Inferred continuity thread",
				channelId: "channel_cli",
			});

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_inferred",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Continue that auth thing from yesterday.",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			await waitFor(() => {
				const snapshot = internals.dialogue.getThreadSnapshot({
					threadId: thread.id,
				});
				return (
					snapshot?.messages.some(
						(message) => message.metadata?.interactionMode === "chat",
					) ?? false
				);
			});

			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			const assistantMessage = snapshot?.messages.find(
				(message) => message.role === "assistant",
			);
			expect(assistantMessage?.metadata?.interactionMode).toBe("chat");
			expect(internals.backend.intents.getActive()).toHaveLength(0);
		} finally {
			await daemon.shutdown();
		}
	});

	test("restores governed work from promoted structured memory only when the live gate passes", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"goal":{"summary":"Inspect auth refresh regression","successCriteria":["Report findings"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect auth refresh regression and report findings","successCriteria":["Report findings"],"boundaries":["Do not modify files"],"interruptionPolicy":"minimal","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"none","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Restored structured work continuity can proceed as bounded read-only work."},"clarificationQuestions":[]}',
				"Restored auth refresh investigation completed.",
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			internals.memory.promoteWorkContinuation({
				workItemId: "intent_auth_restore",
				summary: "Inspect auth refresh regression",
				threadId: "thread_origin",
				scope: DEMO_SCOPE,
				sourceSurfaceKind: "cli",
				relevantFacts: ["Token refresh path changed yesterday."],
			});
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_restore",
				title: "Restore thread",
				channelId: "channel_cli",
			});

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_restore",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Continue that auth thing from yesterday.",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			await waitFor(() => {
				const snapshot = internals.dialogue.getThreadSnapshot({
					threadId: thread.id,
				});
				return Boolean(
					snapshot?.thread.metadata?.activeWorkItemId &&
						snapshot.messages.some(
							(message) => message.metadata?.restorationMemoryId,
						),
				);
			}, 6000);

			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			expect(snapshot?.thread.metadata?.activeWorkItemId).toBeTruthy();
			expect(
				snapshot?.messages.some(
					(message) => message.metadata?.restorationMemoryId !== undefined,
				),
			).toBe(true);
		} finally {
			await daemon.shutdown();
		}
	});

	test("keeps proactive chat-like input out of work governance", async () => {
		const daemon = createDaemon(new ScriptedProvider([]));

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_ambient_chat",
				title: "Ambient chat thread",
				channelId: "channel_cli",
			});

			await internals.submitAmbientIntent(
				thread.id,
				"Can you say that shorter next time?",
				{
					workingDirectory: "/tmp/demo",
					projectRoot: "/tmp/demo",
				},
			);

			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			const assistantMessage = snapshot?.messages.find(
				(message) => message.metadata?.interactionMode === "chat",
			);
			expect(assistantMessage?.content).toContain("chat mode");
			expect(assistantMessage?.metadata?.answerArtifact?.mode).toBe("chat");
			expect(internals.backend.intents.getActive()).toHaveLength(0);
		} finally {
			await daemon.shutdown();
		}
	});
});

interface DaemonInternals {
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
	dialogue: {
		ensureThread(params: {
			threadId: string;
			title: string;
			channelId?: string;
		}): { id: string };
		getThreadSnapshot(payload: {
			threadId: string;
		}):
			| {
					thread: { metadata?: Record<string, unknown> };
					messages: DialogueMessage[];
			  }
			| undefined;
	};
	backend: {
		intents: {
			getActive(): Array<{ id: string }>;
		};
		decisions: {
			getPendingByThread(threadId: string): Array<{ id: string }>;
		};
	};
	memory: {
		promoteWorkContinuation(input: {
			workItemId: string;
			summary: string;
			threadId?: string;
			scope?: ChannelScope;
			sourceSurfaceKind?: string;
			relevantFacts?: string[];
		}): { id: string };
		deriveRelationshipBoundaryOverrides(input?: {
			scope?: ChannelScope;
			threadId?: string;
		}): {
			interruptionPolicy?: { preferredDelivery?: string };
			autonomyPolicy?: { allowAmbientAutoExecution?: boolean };
			proactivityPolicy?: { initiativeLevel?: string };
		};
	};
	submitAmbientIntent(
		threadId: string,
		text: string,
		scope: { workingDirectory?: string; projectRoot?: string },
	): Promise<void>;
}

const DEMO_SCOPE: ChannelScope = {
	workingDirectory: "/tmp/demo",
	projectRoot: "/tmp/demo",
};

function createDaemon(llm: LLMProvider): NousDaemon {
	const root = mkdtempSync(join(tmpdir(), "nous-daemon-interaction-"));
	tempDirs.push(root);
	process.env.NOUS_HOME = join(root, ".nous");
	process.env.NOUS_DB = undefined;
	process.env.NOUS_SOCKET = undefined;
	process.env.NOUS_PID_FILE = undefined;
	process.env.NOUS_STATE_FILE = undefined;
	return new NousDaemon({ llm });
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
	throw new Error("Timed out waiting for condition");
}
