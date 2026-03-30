import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import {
	StructuredGenerationEngine,
	type StructuredOutputSpec,
} from "../src/llm/structured.ts";

describe("StructuredGenerationEngine", () => {
	test("uses native json_schema when the provider supports it", async () => {
		const provider = new MockProvider({
			capabilities: { structuredOutputModes: ["json_schema"] },
			responses: ['{"value":"ok"}'],
		});
		const engine = new StructuredGenerationEngine(provider);
		const spec: StructuredOutputSpec<{ value: string }> = {
			name: "demo",
			description: "Return an object with a string value field.",
			schema: {
				type: "object",
				required: ["value"],
				properties: { value: { type: "string" } },
			},
			validate(value) {
				if (
					!value ||
					typeof value !== "object" ||
					Array.isArray(value) ||
					typeof value.value !== "string"
				) {
					throw new Error("invalid structured value");
				}
				return { value: value.value };
			},
		};

		const result = await engine.generate({
			spec,
			messages: [{ role: "user", content: "hello" }],
			maxTokens: 128,
			temperature: 0,
		});

		expect(result.value).toBe("ok");
		expect(provider.requests[0]?.responseFormat).toEqual({
			type: "json_schema",
			name: "demo",
			schema: spec.schema,
			strict: true,
		});
	});

	test("retries prompt-only providers when the first structured response is invalid", async () => {
		const provider = new MockProvider({
			capabilities: { structuredOutputModes: ["prompt_only"] },
			responses: ["not json", '{"value":"fixed"}'],
		});
		const engine = new StructuredGenerationEngine(provider);

		const result = await engine.generate({
			spec: {
				name: "repairable_demo",
				description: "Return an object with a string value field.",
				schema: {
					type: "object",
					required: ["value"],
					properties: { value: { type: "string" } },
				},
				validate(value) {
					if (
						!value ||
						typeof value !== "object" ||
						Array.isArray(value) ||
						typeof value.value !== "string"
					) {
						throw new Error("invalid");
					}
					return { value: value.value };
				},
			},
			messages: [{ role: "user", content: "hello" }],
			maxTokens: 128,
			maxAttempts: 2,
		});

		expect(result.value).toBe("fixed");
		expect(provider.requests).toHaveLength(2);
		expect(provider.requests[1]?.system).toContain(
			"Previous response failed validation",
		);
	});
});

class MockProvider implements LLMProvider {
	readonly name = "mock";
	readonly requests: LLMRequest[] = [];
	private responseIndex = 0;

	constructor(
		private readonly config: {
			capabilities: LLMProviderCapabilities;
			responses: string[];
		},
	) {}

	getCapabilities(): LLMProviderCapabilities {
		return this.config.capabilities;
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		this.requests.push(request);
		const text = this.config.responses[this.responseIndex] ?? "{}";
		this.responseIndex += 1;
		return {
			id: `mock-${this.responseIndex}`,
			content: [{ type: "text", text }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
