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

describe("Orchestrator cancellation", () => {
	test("cancels queued work immediately and abandons the intent", () => {
		const backend = createPersistenceBackend();
		const orchestrator = new Orchestrator({
			llm: new NoopProvider(),
			eventStore: backend.events,
			taskStore: backend.tasks,
			intentStore: backend.intents,
		});

		const intent = makeIntent("intent_cancel");
		backend.intents.create(intent);
		backend.tasks.create(
			makeTask({
				id: "task_cancel_1",
				intentId: intent.id,
				status: "queued",
				queuedAt: new Date().toISOString(),
			}),
		);
		backend.tasks.create(
			makeTask({
				id: "task_cancel_2",
				intentId: intent.id,
				status: "created",
			}),
		);

		const result = orchestrator.cancelIntent(intent.id, "Stop this intent");
		expect(result.mode).toBe("cancelled_immediately");
		expect(backend.tasks.getById("task_cancel_1")?.status).toBe("cancelled");
		expect(backend.tasks.getById("task_cancel_2")?.status).toBe("cancelled");
		expect(backend.intents.getById(intent.id)?.status).toBe("abandoned");
		expect(
			backend.intents.getById(intent.id)?.pendingCancellation,
		).toBeUndefined();
		expect(
			backend.intents.getById(intent.id)?.executionDirectives?.[0],
		).toMatchObject({
			kind: "cancellation",
			status: "applied",
		});

		backend.close();
	});
});

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
			rationale: "Bounded investigation.",
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

class NoopProvider implements LLMProvider {
	readonly name = "noop";

	getCapabilities(): LLMProviderCapabilities {
		return {};
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
