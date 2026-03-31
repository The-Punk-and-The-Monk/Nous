import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { ControlIntentRouter } from "../src/control/control-intent-router.ts";

describe("ControlIntentRouter", () => {
	test("uses structured output to resolve discovery requests into catalog operations", async () => {
		const provider = new MockProvider(
			'{"kind":"invoke_operation","operationId":"control.discover","confidence":"high","rationale":"The user is explicitly asking what controls are available.","query":"network"}',
		);
		const router = new ControlIntentRouter(provider);
		const result = await router.route({
			text: "what network controls do you have here?",
			context: {
				surface: "repl",
				channelType: "cli",
				daemonRunning: true,
			},
		});

		expect(result.kind).toBe("invoke_operation");
		expect(result.operationId).toBe("control.discover");
		expect(result.query).toBe("network");
		expect(provider.lastRequest?.responseFormat).toEqual({
			type: "json_schema",
			name: "control_intent_routing",
			schema: expect.any(Object),
			strict: true,
		});
	});

	test("normalizes missing thread ids for thread.attach into clarify", async () => {
		const provider = new MockProvider(
			'{"kind":"invoke_operation","operationId":"thread.attach","confidence":"high","rationale":"The user wants to attach to another thread."}',
		);
		const router = new ControlIntentRouter(provider);
		const result = await router.route({
			text: "attach to that other thread",
			context: {
				surface: "repl",
				channelType: "cli",
				daemonRunning: true,
			},
		});

		expect(result.kind).toBe("clarify");
		expect(result.rationale).toContain("thread id");
	});

	test("keeps ordinary repository work in the task plane", async () => {
		const provider = new MockProvider(
			'{"kind":"task_plane","confidence":"high","rationale":"The user is asking Nous to do repository work, not to control the runtime."}',
		);
		const router = new ControlIntentRouter(provider);
		const result = await router.route({
			text: "Summarize README.md and explain the architecture",
			context: {
				surface: "repl",
				channelType: "cli",
				daemonRunning: true,
			},
		});

		expect(result.kind).toBe("task_plane");
	});
});

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
