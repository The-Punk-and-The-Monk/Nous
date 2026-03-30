import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	Intent,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
	Task,
} from "@nous/core";
import { createPersistenceBackend } from "@nous/persistence";
import { Orchestrator } from "../src/orchestrator.ts";

describe("Orchestrator scope revision", () => {
	test("queues a mid-execution scope update and replans it at the next safe boundary", async () => {
		const provider = new ScriptedProvider([
			'{"goal":{"summary":"Inspect only token refresh behavior","successCriteria":["Report token refresh findings"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect token refresh behavior and report findings","successCriteria":["Report token refresh findings"],"boundaries":["Do not modify files"],"interruptionPolicy":"interactive","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"light","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Updated focus after a user scope change."},"clarificationQuestions":[]}',
			'{"tasks":[{"id":1,"description":"Inspect token refresh implementation and summarize findings","dependsOn":[],"capabilitiesRequired":[]}]}',
		]);
		const backend = createPersistenceBackend();
		const orchestrator = new Orchestrator({
			llm: provider,
			eventStore: backend.events,
			taskStore: backend.tasks,
			intentStore: backend.intents,
		});

		const intent = makeIntent("intent_scope_revision");
		backend.intents.create(intent);
		backend.tasks.create(
			makeTask({
				id: "task_running",
				intentId: intent.id,
				description: "Inspect auth service currently being executed",
				status: "running",
				startedAt: new Date().toISOString(),
			}),
		);
		backend.tasks.create(
			makeTask({
				id: "task_queued",
				intentId: intent.id,
				description: "Summarize auth findings",
				status: "queued",
				queuedAt: new Date().toISOString(),
			}),
		);

		const queued = await orchestrator.applyIntentScopeUpdate(
			intent.id,
			"Actually only focus on token refresh and keep it read-only.",
		);
		expect(queued.mode).toBe("deferred_replan");
		expect(
			backend.intents.getById(intent.id)?.pendingRevision?.revisionText,
		).toContain("token refresh");
		expect(
			backend.intents.getById(intent.id)?.executionDirectives?.[0],
		).toMatchObject({
			kind: "scope_revision",
			status: "requested",
		});

		backend.tasks.update("task_running", {
			status: "done",
			completedAt: new Date().toISOString(),
			result: "Inspected auth service baseline behavior.",
		});
		const revised = await orchestrator.maybeApplyPendingIntentRevisionIfSafe(
			intent.id,
		);

		expect(revised?.pendingRevision).toBeUndefined();
		expect(revised?.executionDirectives?.[0]).toMatchObject({
			kind: "scope_revision",
			status: "applied",
		});
		expect(backend.tasks.getById("task_queued")).toBeUndefined();
		const tasks = backend.tasks.getByIntent(intent.id);
		expect(tasks.some((task) => task.id === "task_running")).toBe(true);
		expect(tasks.some((task) => task.id === "task_queued")).toBe(false);
		expect(tasks.filter((task) => task.id !== "task_running")).toHaveLength(1);
		expect(backend.intents.getById(intent.id)?.contract?.summary).toContain(
			"token refresh",
		);

		backend.close();
	});
});

function makeIntent(id: string): Intent {
	return {
		id,
		raw: "Inspect the auth changes and report what broke.",
		workingText: "Inspect the auth changes and report what broke.",
		goal: {
			summary: "Inspect auth changes",
			successCriteria: ["Report auth findings"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always",
		contract: {
			summary: "Inspect auth changes and report findings",
			successCriteria: ["Report auth findings"],
			boundaries: ["Do not modify files"],
			interruptionPolicy: "interactive",
			deliveryMode: "structured_with_evidence",
		},
		executionDepth: {
			planningDepth: "light",
			timeDepth: "foreground",
			organizationDepth: "single_agent",
			initiativeMode: "reactive",
			rationale: "Initial bounded investigation.",
		},
		status: "active",
		source: "human",
		createdAt: new Date().toISOString(),
	};
}

function makeTask(
	overrides: Partial<Task> & Pick<Task, "id" | "intentId">,
): Task {
	return {
		id: overrides.id,
		intentId: overrides.intentId,
		parentTaskId: overrides.parentTaskId,
		dependsOn: overrides.dependsOn ?? [],
		description: overrides.description ?? "Task",
		assignedAgentId: overrides.assignedAgentId,
		capabilitiesRequired: overrides.capabilitiesRequired ?? [],
		status: overrides.status ?? "created",
		retries: overrides.retries ?? 0,
		maxRetries: overrides.maxRetries ?? 3,
		backoffSeconds: overrides.backoffSeconds ?? 2,
		createdAt: overrides.createdAt ?? new Date().toISOString(),
		queuedAt: overrides.queuedAt,
		startedAt: overrides.startedAt,
		lastHeartbeat: overrides.lastHeartbeat,
		completedAt: overrides.completedAt,
		result: overrides.result,
		error: overrides.error,
		escalationReason: overrides.escalationReason,
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
