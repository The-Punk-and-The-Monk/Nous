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

describe("NousDaemon DecisionQueue flows", () => {
	test("produces scope_confirmation for ambiguous pre-plan thread updates and can apply them to the current intent", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"disposition":"ambiguous","rationale":"The message could either narrow the current auth investigation or start a separate follow-up."}',
				'{"goal":{"summary":"Inspect auth token refresh changes","successCriteria":["Report token refresh findings"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect token refresh changes in auth flow and report findings","successCriteria":["Report token refresh findings"],"boundaries":["Do not modify files"],"interruptionPolicy":"interactive","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"light","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Still a bounded investigation."},"clarificationQuestions":[]}',
				'{"tasks":[{"id":1,"description":"Inspect token refresh changes in auth flow and report findings","dependsOn":[],"capabilitiesRequired":[]}]}',
				"Token refresh scope confirmed; investigation completed.",
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_scope",
				title: "Scope thread",
				channelId: "channel_cli",
			});
			internals.backend.intents.create(makeIntent("intent_scope"));
			internals.trackIntentForThread(
				"intent_scope",
				thread.id,
				"Inspect the auth changes",
				BASE_SCOPE,
			);
			internals.scheduledIntentExecutions.add("intent_scope");

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_scope_message",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Also focus only on token refresh and keep it read-only.",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			const pendingDecision = internals.backend.decisions.getPendingByThread(
				thread.id,
			)[0];
			expect(pendingDecision?.kind).toBe("scope_confirmation");
			expect(internals.backend.intents.getById("intent_scope")?.status).toBe(
				"awaiting_decision",
			);

			const decisionAck = await internals.controller.handle(
				makeEnvelope({
					id: "req_scope_decision",
					type: "approve_decision",
					payload: {
						decisionId: pendingDecision?.id,
						threadId: thread.id,
						optionId: "answer_current",
					},
				}),
			);
			expect(decisionAck?.type).toBe("ack");

			const revised = internals.backend.intents.getById("intent_scope");
			expect(["active", "achieved"]).toContain(revised?.status);
			expect(revised?.workingText).toContain("User scope update");
			expect(revised?.contract?.summary).toContain("token refresh");
			expect(
				internals.backend.decisions.getById(String(pendingDecision?.id))
					?.status,
			).toBe("resolved");

			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			expect(
				snapshot?.messages.some((message) =>
					message.content.includes("scope update to the current intent"),
				),
			).toBe(true);
		} finally {
			await daemon.shutdown();
		}
	});

	test("keeps only one pending decision per thread and activates queued decisions after resolution", async () => {
		const daemon = createDaemon(new NoopProvider());

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_queue",
				title: "Queue thread",
				channelId: "channel_cli",
			});

			internals.backend.intents.create(
				makeIntent("intent_approval", "Review deployment plan"),
			);
			internals.trackIntentForThread(
				"intent_approval",
				thread.id,
				"Review deployment plan",
				BASE_SCOPE,
			);
			internals.backend.intents.update("intent_approval", {
				status: "awaiting_decision",
			});
			internals.backend.decisions.create({
				id: "decision_pending",
				intentId: "intent_approval",
				threadId: thread.id,
				kind: "approval",
				summary: "Approval needed for deployment review",
				questions: ["Should I proceed with the deployment review?"],
				status: "pending",
				responseMode: "approval",
				createdAt: new Date().toISOString(),
				metadata: {},
			});

			internals.backend.intents.create(
				makeIntent("intent_conflict", "Update auth docs"),
			);
			internals.trackIntentForThread(
				"intent_conflict",
				thread.id,
				"Update auth docs",
				BASE_SCOPE,
			);
			await internals.createConflictResolutionDecision(
				{
					id: "intent_conflict",
					goal: { summary: "Update auth docs" },
				},
				thread.id,
				{
					queued: true,
					overlaps: ["scope:/tmp/demo"],
					verdict: "conflicting",
					reason: "The new request overlaps with the deployment review.",
					requiresReview: true,
					relatedIntentIds: ["intent_approval"],
				},
			);

			const queued = internals.backend.decisions.getQueuedByThread(
				thread.id,
			)[0];
			expect(queued?.kind).toBe("conflict_resolution");

			const resolutionAck = await internals.controller.handle(
				makeEnvelope({
					id: "req_reject_approval",
					type: "approve_decision",
					payload: {
						decisionId: "decision_pending",
						threadId: thread.id,
						approved: false,
					},
				}),
			);
			expect(resolutionAck?.type).toBe("ack");
			expect(
				internals.backend.decisions.getById(String(queued?.id))?.status,
			).toBe("pending");
			expect(internals.backend.intents.getById("intent_approval")?.status).toBe(
				"abandoned",
			);
		} finally {
			await daemon.shutdown();
		}
	});

	test("cancels the current intent from thread text even when a decision is pending, and activates the next queued decision", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"disposition":"cancel_current_intent","rationale":"The user wants to stop the blocked intent rather than answer the pending decision."}',
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_cancel_pending_decision",
				title: "Cancel pending decision",
				channelId: "channel_cli",
			});

			internals.backend.intents.create(
				makeIntent("intent_cancel_pending", "Review deployment plan"),
			);
			internals.trackIntentForThread(
				"intent_cancel_pending",
				thread.id,
				"Review deployment plan",
				BASE_SCOPE,
			);
			internals.backend.intents.update("intent_cancel_pending", {
				status: "awaiting_decision",
			});
			internals.backend.decisions.create({
				id: "decision_cancel_pending",
				intentId: "intent_cancel_pending",
				threadId: thread.id,
				kind: "clarification",
				summary: "Need deployment target clarification",
				questions: ["Which environment should I review?"],
				status: "pending",
				responseMode: "free_text",
				createdAt: new Date().toISOString(),
				metadata: {},
			});

			internals.backend.intents.create(
				makeIntent("intent_next_decision", "Update auth docs"),
			);
			internals.trackIntentForThread(
				"intent_next_decision",
				thread.id,
				"Update auth docs",
				BASE_SCOPE,
			);
			internals.backend.intents.update("intent_next_decision", {
				status: "awaiting_decision",
			});
			internals.backend.decisions.create({
				id: "decision_next",
				intentId: "intent_next_decision",
				threadId: thread.id,
				kind: "approval",
				summary: "Approval needed for auth docs update",
				questions: ["Should I proceed with the auth docs update?"],
				status: "queued",
				responseMode: "approval",
				createdAt: new Date().toISOString(),
				metadata: {},
			});

			const ack = await internals.controller.handle(
				makeEnvelope({
					id: "req_cancel_pending_decision",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Never mind, stop this request.",
					},
				}),
			);

			expect(ack?.type).toBe("ack");
			expect(
				internals.backend.intents.getById("intent_cancel_pending")?.status,
			).toBe("abandoned");
			expect(
				internals.backend.decisions.getById("decision_cancel_pending")?.status,
			).toBe("cancelled");
			expect(internals.backend.decisions.getById("decision_next")?.status).toBe(
				"pending",
			);
		} finally {
			await daemon.shutdown();
		}
	});

	test("defers a current-intent scope update until the next safe execution boundary", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"disposition":"current_intent","rationale":"The user is clearly refining the active work rather than starting a separate task."}',
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_deferred_scope",
				title: "Deferred scope thread",
				channelId: "channel_cli",
			});
			internals.backend.intents.create(makeIntent("intent_running_scope"));
			internals.trackIntentForThread(
				"intent_running_scope",
				thread.id,
				"Inspect the auth changes",
				BASE_SCOPE,
			);
			internals.scheduledIntentExecutions.add("intent_running_scope");
			internals.backend.tasks.create({
				id: "task_running_scope",
				intentId: "intent_running_scope",
				dependsOn: [],
				description: "Inspect auth service",
				capabilitiesRequired: [],
				status: "running",
				retries: 0,
				maxRetries: 3,
				backoffSeconds: 2,
				createdAt: new Date().toISOString(),
				startedAt: new Date().toISOString(),
			});
			internals.backend.tasks.create({
				id: "task_queued_scope",
				intentId: "intent_running_scope",
				dependsOn: [],
				description: "Summarize auth findings",
				capabilitiesRequired: [],
				status: "queued",
				retries: 0,
				maxRetries: 3,
				backoffSeconds: 2,
				createdAt: new Date().toISOString(),
				queuedAt: new Date().toISOString(),
			});

			const reply = await internals.controller.handle(
				makeEnvelope({
					id: "req_deferred_scope_message",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "Actually keep it read-only and only focus on token refresh.",
					},
				}),
			);
			expect(reply?.type).toBe("ack");

			expect(
				internals.backend.decisions.getPendingByThread(thread.id),
			).toHaveLength(0);
			expect(
				internals.backend.intents.getById("intent_running_scope")
					?.pendingRevision?.revisionText,
			).toContain("token refresh");
			const snapshot = internals.dialogue.getThreadSnapshot({
				threadId: thread.id,
			});
			expect(
				snapshot?.messages.some((message) =>
					message.content.includes("next safe execution boundary"),
				),
			).toBe(true);
		} finally {
			await daemon.shutdown();
		}
	});

	test("pauses a pending decision instead of cancelling it, and activates the next queued decision", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"disposition":"pause_current_intent","rationale":"The user wants to pause the blocked intent and come back later."}',
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_pause_pending_decision",
				title: "Pause pending decision",
				channelId: "channel_cli",
			});

			internals.backend.intents.create(
				makeIntent("intent_pause_pending", "Review deployment plan"),
			);
			internals.trackIntentForThread(
				"intent_pause_pending",
				thread.id,
				"Review deployment plan",
				BASE_SCOPE,
			);
			internals.backend.intents.update("intent_pause_pending", {
				status: "awaiting_clarification",
			});
			internals.backend.decisions.create({
				id: "decision_pause_pending",
				intentId: "intent_pause_pending",
				threadId: thread.id,
				kind: "clarification",
				summary: "Need deployment target clarification",
				questions: ["Which environment should I review?"],
				status: "pending",
				responseMode: "free_text",
				createdAt: new Date().toISOString(),
				metadata: {},
			});

			internals.backend.intents.create(
				makeIntent("intent_after_pause", "Update auth docs"),
			);
			internals.trackIntentForThread(
				"intent_after_pause",
				thread.id,
				"Update auth docs",
				BASE_SCOPE,
			);
			internals.backend.intents.update("intent_after_pause", {
				status: "awaiting_decision",
			});
			internals.backend.decisions.create({
				id: "decision_after_pause",
				intentId: "intent_after_pause",
				threadId: thread.id,
				kind: "approval",
				summary: "Approval needed for auth docs update",
				questions: ["Should I proceed with the auth docs update?"],
				status: "queued",
				responseMode: "approval",
				createdAt: new Date().toISOString(),
				metadata: {},
			});

			const ack = await internals.controller.handle(
				makeEnvelope({
					id: "req_pause_pending_decision",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "先暂停这个, 回头再说。",
					},
				}),
			);

			expect(ack?.type).toBe("ack");
			expect(
				internals.backend.intents.getById("intent_pause_pending")?.status,
			).toBe("paused");
			expect(
				internals.backend.decisions.getById("decision_pause_pending")?.status,
			).toBe("queued");
			expect(
				internals.backend.decisions.getById("decision_after_pause")?.status,
			).toBe("pending");
		} finally {
			await daemon.shutdown();
		}
	});

	test("resumes a paused intent and reactivates its queued decision", async () => {
		const daemon = createDaemon(
			new ScriptedProvider([
				'{"disposition":"resume_current_intent","rationale":"The user wants to continue the paused intent."}',
			]),
		);

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_resume_paused_intent",
				title: "Resume paused intent",
				channelId: "channel_cli",
			});

			internals.backend.intents.create({
				...makeIntent("intent_resume_paused", "Review deployment plan"),
				status: "paused",
				clarificationQuestions: ["Which environment should I review?"],
				executionDirectives: [
					{
						id: "dir_pause_applied",
						kind: "pause",
						requestedAt: new Date().toISOString(),
						status: "applied",
						mode: "immediate",
						resumeStatus: "awaiting_clarification",
						reason: "Paused by user",
						appliedAt: new Date().toISOString(),
					},
				],
			});
			internals.trackIntentForThread(
				"intent_resume_paused",
				thread.id,
				"Review deployment plan",
				BASE_SCOPE,
			);
			internals.backend.decisions.create({
				id: "decision_resume_paused",
				intentId: "intent_resume_paused",
				threadId: thread.id,
				kind: "clarification",
				summary: "Need deployment target clarification",
				questions: ["Which environment should I review?"],
				status: "queued",
				responseMode: "free_text",
				createdAt: new Date().toISOString(),
				metadata: {},
			});

			const ack = await internals.controller.handle(
				makeEnvelope({
					id: "req_resume_paused_intent",
					type: "send_message",
					payload: {
						threadId: thread.id,
						text: "继续刚才那个。",
					},
				}),
			);

			expect(ack?.type).toBe("ack");
			expect(
				internals.backend.decisions.getById("decision_resume_paused")?.status,
			).toBe("pending");
			expect(
				internals.backend.intents.getById("intent_resume_paused")?.status,
			).toBe("awaiting_clarification");
		} finally {
			await daemon.shutdown();
		}
	});

	test("rejecting risky-boundary approval pauses the intent instead of abandoning it", async () => {
		const daemon = createDaemon(new NoopProvider());

		try {
			const internals = daemon as unknown as DaemonInternals;
			const thread = internals.dialogue.ensureThread({
				threadId: "thread_risky_approval_reject",
				title: "Risky approval reject",
				channelId: "channel_cli",
			});

			internals.backend.intents.create(
				makeIntent("intent_risky_pause", "Review deployment plan"),
			);
			internals.trackIntentForThread(
				"intent_risky_pause",
				thread.id,
				"Review deployment plan",
				BASE_SCOPE,
			);
			internals.backend.intents.update("intent_risky_pause", {
				status: "awaiting_decision",
			});
			internals.backend.decisions.create({
				id: "decision_risky_pause",
				intentId: "intent_risky_pause",
				threadId: thread.id,
				kind: "approval",
				summary: "Approval needed after a risky boundary",
				questions: ["Should I continue with the remaining work?"],
				status: "pending",
				responseMode: "approval",
				createdAt: new Date().toISOString(),
				metadata: {
					producer: "risky_boundary",
					rejectionPolicy: "pause_intent",
				},
			});

			const ack = await internals.controller.handle(
				makeEnvelope({
					id: "req_risky_reject",
					type: "approve_decision",
					payload: {
						decisionId: "decision_risky_pause",
						threadId: thread.id,
						approved: false,
					},
				}),
			);

			expect(ack?.type).toBe("ack");
			expect(
				internals.backend.intents.getById("intent_risky_pause")?.status,
			).toBe("paused");
			expect(
				internals.backend.decisions.getById("decision_risky_pause")?.status,
			).toBe("resolved");
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
			update(id: string, fields: Partial<Intent>): void;
		};
		tasks: {
			create(task: Record<string, unknown>): void;
		};
		decisions: {
			create(decision: Record<string, unknown>): void;
			getById(id: string): { status?: string; kind?: string } | undefined;
			getPendingByThread(threadId: string): Array<{
				id: string;
				kind: string;
			}>;
			getQueuedByThread(threadId: string): Array<{
				id: string;
				kind: string;
			}>;
		};
	};
	trackIntentForThread(
		intentId: string,
		threadId: string,
		text: string,
		scope: typeof BASE_SCOPE,
	): void;
	scheduledIntentExecutions: Set<string>;
	createConflictResolutionDecision(
		intent: { id: string; goal: { summary: string } },
		threadId: string,
		conflict: {
			queued: boolean;
			overlaps: string[];
			verdict: "conflicting";
			reason: string;
			requiresReview: boolean;
			relatedIntentIds: string[];
		},
	): Promise<void>;
}

function createDaemon(llm: LLMProvider): NousDaemon {
	const root = mkdtempSync(join(tmpdir(), "nous-decision-queue-"));
	tempDirs.push(root);
	process.env.NOUS_HOME = join(root, ".nous");
	process.env.NOUS_DB = undefined;
	process.env.NOUS_SOCKET = undefined;
	process.env.NOUS_PID_FILE = undefined;
	process.env.NOUS_STATE_FILE = undefined;
	return new NousDaemon({ llm });
}

function makeIntent(id: string, summary = "Inspect auth changes"): Intent {
	return {
		id,
		raw: summary,
		workingText: summary,
		goal: {
			summary,
			successCriteria: ["Report findings"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always",
		contract: {
			summary: `${summary} and report findings`,
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
		id: "req_default",
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

class NoopProvider implements LLMProvider {
	readonly name = "noop";

	getCapabilities(): LLMProviderCapabilities {
		return { structuredOutputModes: ["json_schema"] };
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		throw new Error("No LLM call expected in this test");
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
