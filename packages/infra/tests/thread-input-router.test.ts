import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	Decision,
	Intent,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { ThreadInputRouter } from "../src/intake/thread-input-router.ts";

describe("ThreadInputRouter", () => {
	test("classifies clarification answers as decision responses", async () => {
		const provider = new MockProvider(
			'{"disposition":"decision_response","rationale":"The message directly answers the pending clarification with a branch and execution mode."}',
		);
		const router = new ThreadInputRouter(provider);
		const result = await router.route({
			text: "Look at feature/auth-refresh and keep it read-only.",
			intent: makeIntent(),
			decision: makeDecision(),
			recentThreadMessages: [
				{ role: "assistant", content: "Which branch should I inspect?" },
			],
		});

		expect(result.disposition).toBe("decision_response");
		expect(provider.lastRequest?.responseFormat).toEqual({
			type: "json_schema",
			name: "thread_input_routing",
			schema: expect.any(Object),
			strict: true,
		});
	});
	test("classifies stop messages as current-intent cancellation even when a decision is pending", async () => {
		const provider = new MockProvider(
			'{"disposition":"cancel_current_intent","rationale":"The user wants to stop the blocked intent rather than answer the pending decision."}',
		);
		const router = new ThreadInputRouter(provider);
		const result = await router.route({
			text: "Never mind, stop this task.",
			intent: makeIntent(),
			decision: makeDecision(),
		});

		expect(result.disposition).toBe("cancel_current_intent");
	});

	test("classifies pause messages separately when a decision is pending", async () => {
		const provider = new MockProvider(
			'{"disposition":"pause_current_intent","rationale":"The user wants to pause the blocked intent and return later."}',
		);
		const router = new ThreadInputRouter(provider);
		const result = await router.route({
			text: "先暂停, 回头再说。",
			intent: makeIntent(),
			decision: makeDecision(),
		});

		expect(result.disposition).toBe("pause_current_intent");
	});
});

function makeIntent(): Intent {
	return {
		id: "intent_demo",
		raw: "Inspect the auth changes",
		workingText: "Inspect the auth changes",
		goal: {
			summary: "Inspect auth changes",
			successCriteria: ["Report findings"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always",
		status: "awaiting_clarification",
		source: "human",
		clarificationQuestions: ["Which branch should I inspect?"],
		createdAt: new Date().toISOString(),
	};
}

function makeDecision(): Decision {
	return {
		id: "decision_demo",
		intentId: "intent_demo",
		threadId: "thread_demo",
		kind: "clarification",
		summary: "Need branch clarification",
		questions: ["Which branch should I inspect?"],
		status: "pending",
		responseMode: "free_text",
		createdAt: new Date().toISOString(),
	};
}

class MockProvider implements LLMProvider {
	readonly name = "mock";
	lastRequest?: LLMRequest;

	constructor(private readonly text: string) {}

	getCapabilities(): LLMProviderCapabilities {
		return {
			structuredOutputModes: ["json_schema"],
		};
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		this.lastRequest = request;
		return {
			id: "mock",
			content: [{ type: "text", text: this.text }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
