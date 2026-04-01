import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	Intent,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { ThreadScopeRouter } from "../src/intake/thread-scope-router.ts";

describe("ThreadScopeRouter", () => {
	test("classifies ambiguous follow-ups for scope confirmation", async () => {
		const provider = new MockProvider(
			'{"disposition":"ambiguous","rationale":"The message could either narrow the current task or introduce a separate follow-up."}',
		);
		const router = new ThreadScopeRouter(provider);
		const result = await router.route({
			text: "Also update the README once you are done with auth.",
			intent: makeIntent(),
			recentThreadMessages: [
				{
					role: "assistant",
					content: "I’m queueing the auth investigation now.",
				},
			],
		});

		expect(result.disposition).toBe("ambiguous");
		expect(provider.lastRequest?.responseFormat).toEqual({
			type: "json_schema",
			name: "thread_scope_routing",
			schema: expect.any(Object),
			strict: true,
		});
	});
	test("classifies explicit stop messages as current-intent cancellation", async () => {
		const provider = new MockProvider(
			'{"disposition":"cancel_current_intent","rationale":"The user is explicitly asking to stop the active work."}',
		);
		const router = new ThreadScopeRouter(provider);
		const result = await router.route({
			text: "Stop this. Don't continue the auth investigation.",
			intent: makeIntent(),
		});

		expect(result.disposition).toBe("cancel_current_intent");
	});

	test("classifies pause requests separately from cancel", async () => {
		const provider = new MockProvider(
			'{"disposition":"pause_current_intent","rationale":"The user wants to pause the current work and keep it for later."}',
		);
		const router = new ThreadScopeRouter(provider);
		const result = await router.route({
			text: "先暂停这个, 我们回头继续。",
			intent: makeIntent(),
		});

		expect(result.disposition).toBe("pause_current_intent");
	});

	test("classifies resume requests for paused intents", async () => {
		const provider = new MockProvider(
			'{"disposition":"resume_current_intent","rationale":"The user wants to continue the paused intent."}',
		);
		const router = new ThreadScopeRouter(provider);
		const result = await router.route({
			text: "继续刚才那个任务。",
			intent: makeIntent("paused"),
		});

		expect(result.disposition).toBe("resume_current_intent");
	});

	test("classifies explicit new-topic markers as new intent", async () => {
		const provider = new MockProvider(
			'{"disposition":"new_intent","rationale":"The user explicitly says they want to start a new topic and asks for a separate dinner recommendation task."}',
		);
		const router = new ThreadScopeRouter(provider);
		const result = await router.route({
			text: "让我们开一个新的话题，帮我建议一下今天晚上吃什么。",
			intent: makeIntent(),
			recentThreadMessages: [
				{
					role: "assistant",
					content: "I can keep expanding the positive psychology outline.",
				},
			],
		});

		expect(result.disposition).toBe("new_intent");
	});
});

function makeIntent(status: Intent["status"] = "active"): Intent {
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
			rationale: "Scoped investigation task.",
		},
		status,
		source: "human",
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
