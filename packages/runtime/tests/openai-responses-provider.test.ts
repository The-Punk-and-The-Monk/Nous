import { describe, expect, test } from "bun:test";
import type { LLMRequest } from "@nous/core";
import type OpenAI from "openai";
import { OpenAICompatProvider, OpenAIProvider } from "../src/index.ts";

describe("OpenAI responses wire", () => {
	test("OpenAI provider defaults to Responses API and sends message-array input", async () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			model: "gpt-5.4",
		});
		let capturedParams:
			| OpenAI.Responses.ResponseCreateParamsStreaming
			| undefined;
		(
			provider as unknown as {
				client: {
					responses: {
						create: (
							params: OpenAI.Responses.ResponseCreateParamsStreaming,
						) => Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>;
					};
				};
			}
		).client.responses.create = async (
			params: OpenAI.Responses.ResponseCreateParamsStreaming,
		) => {
			capturedParams = params;
			return streamOf([
				completedEvent(
					buildResponse({
						output_text: '{"value":"ok"}',
						output: [
							{
								id: "msg_1",
								type: "message",
								role: "assistant",
								status: "completed",
								content: [
									{
										type: "output_text",
										text: '{"value":"ok"}',
										annotations: [],
									},
								],
							},
						],
					}),
				),
			]);
		};

		const request: LLMRequest = {
			system: "Return JSON only.",
			messages: [{ role: "user", content: "Say ok" }],
			maxTokens: 128,
			temperature: 0,
			responseFormat: {
				type: "json_schema",
				name: "demo",
				schema: {
					type: "object",
					required: ["value"],
					properties: { value: { type: "string" } },
				},
				strict: true,
			},
		};

		const response = await provider.chat(request);

		expect(capturedParams?.stream).toBeTrue();
		expect(capturedParams?.input).toEqual([
			{
				type: "message",
				role: "user",
				content: [{ type: "input_text", text: "Say ok" }],
			},
		]);
		expect(capturedParams?.instructions).toBe("Return JSON only.");
		expect(capturedParams?.temperature).toBeUndefined();
		expect(capturedParams?.text?.format).toEqual({
			type: "json_schema",
			name: "demo",
			schema: {
				type: "object",
				required: ["value"],
				properties: { value: { type: "string" } },
				additionalProperties: false,
			},
			strict: false,
		});
		expect(response.content).toEqual([
			{ type: "text", text: '{"value":"ok"}' },
		]);
	});

	test("Responses provider falls back from json_schema to json_object on 400s", async () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			model: "gpt-5.4",
		});
		const capturedFormats: Array<
			OpenAI.Responses.ResponseCreateParamsStreaming["text"]
		> = [];
		let callCount = 0;
		(
			provider as unknown as {
				client: {
					responses: {
						create: (
							params: OpenAI.Responses.ResponseCreateParamsStreaming,
						) => Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>;
					};
				};
			}
		).client.responses.create = async (
			params: OpenAI.Responses.ResponseCreateParamsStreaming,
		) => {
			callCount += 1;
			capturedFormats.push(params.text);
			if (callCount === 1) {
				const error = new Error("400 openai_error") as Error & {
					status?: number;
				};
				error.status = 400;
				throw error;
			}
			return streamOf([
				completedEvent(
					buildResponse({
						output_text: '{"value":"ok"}',
						output: [
							{
								id: "msg_1",
								type: "message",
								role: "assistant",
								status: "completed",
								content: [
									{
										type: "output_text",
										text: '{"value":"ok"}',
										annotations: [],
									},
								],
							},
						],
					}),
				),
			]);
		};

		const response = await provider.chat({
			system: "Return JSON only.",
			messages: [{ role: "user", content: "Say ok" }],
			maxTokens: 128,
			responseFormat: {
				type: "json_schema",
				name: "demo",
				schema: {
					type: "object",
					required: ["value"],
					properties: { value: { type: "string" } },
				},
			},
		});

		expect(callCount).toBe(2);
		expect(capturedFormats[0]?.format?.type).toBe("json_schema");
		expect(capturedFormats[1]?.format?.type).toBe("json_object");
		expect(response.content).toEqual([
			{ type: "text", text: '{"value":"ok"}' },
		]);
	});

	test("Responses tool calls map call_id back into generic tool_use ids", async () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			model: "gpt-5.4",
		});
		(
			provider as unknown as {
				client: {
					responses: {
						create: (
							params: OpenAI.Responses.ResponseCreateParamsStreaming,
						) => Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>;
					};
				};
			}
		).client.responses.create = async () =>
			streamOf([
				completedEvent(
					buildResponse({
						output_text: "",
						output: [
							{
								id: "fc_item_1",
								type: "function_call",
								call_id: "call_123",
								name: "file_read",
								arguments: '{"path":"LICENSE.md"}',
								status: "completed",
							},
						],
					}),
				),
			]);

		const response = await provider.chat({
			messages: [{ role: "user", content: "Read LICENSE.md" }],
			maxTokens: 128,
			tools: [
				{
					name: "file_read",
					description: "Read a file",
					inputSchema: {
						type: "object",
						properties: { path: { type: "string" } },
						required: ["path"],
					},
				},
			],
		});

		expect(response.stopReason).toBe("tool_use");
		expect(response.content).toEqual([
			{
				type: "tool_use",
				id: "call_123",
				name: "file_read",
				input: { path: "LICENSE.md" },
			},
		]);
	});

	test("Responses input replays assistant history as output_text, not input_text", async () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			model: "gpt-5.4",
		});
		let capturedInput: OpenAI.Responses.ResponseCreateParamsStreaming["input"];
		(
			provider as unknown as {
				client: {
					responses: {
						create: (
							params: OpenAI.Responses.ResponseCreateParamsStreaming,
						) => Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>;
					};
				};
			}
		).client.responses.create = async (
			params: OpenAI.Responses.ResponseCreateParamsStreaming,
		) => {
			capturedInput = params.input;
			return streamOf([
				completedEvent(
					buildResponse({
						output: [
							{
								id: "msg_final",
								type: "message",
								role: "assistant",
								status: "completed",
								phase: "final_answer",
								content: [
									{ type: "output_text", text: "done", annotations: [] },
								],
							},
						],
					}),
				),
			]);
		};

		await provider.chat({
			messages: [
				{ role: "user", content: "Read the file" },
				{ role: "assistant", content: "I’ll read it now." },
			],
			maxTokens: 128,
		});

		expect(capturedInput).toEqual([
			{
				type: "message",
				role: "user",
				content: [{ type: "input_text", text: "Read the file" }],
			},
			{
				id: "msg_assistant_1",
				type: "message",
				role: "assistant",
				status: "completed",
				content: [
					{
						type: "output_text",
						text: "I’ll read it now.",
						annotations: [],
					},
				],
			},
		]);
	});

	test("Responses chat collapses commentary messages and keeps the final answer", async () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			model: "gpt-5.4",
		});
		(
			provider as unknown as {
				client: {
					responses: {
						create: () => Promise<
							AsyncIterable<OpenAI.Responses.ResponseStreamEvent>
						>;
					};
				};
			}
		).client.responses.create = async () =>
			streamOf([
				completedEvent(
					buildResponse({
						output: [
							{
								id: "msg_commentary",
								type: "message",
								role: "assistant",
								status: "completed",
								phase: "commentary",
								content: [
									{ type: "output_text", text: "thinking", annotations: [] },
								],
							},
							{
								id: "msg_final",
								type: "message",
								role: "assistant",
								status: "completed",
								phase: "final_answer",
								content: [
									{ type: "output_text", text: '{"value":"ok"}', annotations: [] },
								],
							},
						],
					}),
				),
			]);

		const response = await provider.chat({
			messages: [{ role: "user", content: "Say ok" }],
			maxTokens: 128,
		});

		expect(response.content).toEqual([
			{ type: "text", text: '{"value":"ok"}' },
		]);
	});

	test("compatible Responses endpoints omit reasoning effort for proxy safety", async () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			baseURL: "https://www.packyapi.com/v1",
			model: "gpt-5.4",
			reasoningEffort: "medium",
		});
		let capturedParams:
			| OpenAI.Responses.ResponseCreateParamsStreaming
			| undefined;
		(
			provider as unknown as {
				client: {
					responses: {
						create: (
							params: OpenAI.Responses.ResponseCreateParamsStreaming,
						) => Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>;
					};
				};
			}
		).client.responses.create = async (
			params: OpenAI.Responses.ResponseCreateParamsStreaming,
		) => {
			capturedParams = params;
			return streamOf([
				completedEvent(
					buildResponse({
						output: [
							{
								id: "msg_final",
								type: "message",
								role: "assistant",
								status: "completed",
								phase: "final_answer",
								content: [
									{ type: "output_text", text: "ok", annotations: [] },
								],
							},
						],
					}),
				),
			]);
		};

		await provider.chat({
			messages: [{ role: "user", content: "Say ok" }],
			maxTokens: 64,
		});

		expect(capturedParams?.reasoning).toBeUndefined();
	});

	test("official Responses endpoints retain reasoning effort when model family supports it", async () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			baseURL: "https://api.openai.com/v1",
			model: "gpt-5.4",
			reasoningEffort: "medium",
		});
		let capturedParams:
			| OpenAI.Responses.ResponseCreateParamsStreaming
			| undefined;
		(
			provider as unknown as {
				client: {
					responses: {
						create: (
							params: OpenAI.Responses.ResponseCreateParamsStreaming,
						) => Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>;
					};
				};
			}
		).client.responses.create = async (
			params: OpenAI.Responses.ResponseCreateParamsStreaming,
		) => {
			capturedParams = params;
			return streamOf([
				completedEvent(
					buildResponse({
						output: [
							{
								id: "msg_final",
								type: "message",
								role: "assistant",
								status: "completed",
								phase: "final_answer",
								content: [
									{ type: "output_text", text: "ok", annotations: [] },
								],
							},
						],
					}),
				),
			]);
		};

		await provider.chat({
			messages: [{ role: "user", content: "Say ok" }],
			maxTokens: 64,
		});

		expect(capturedParams?.reasoning).toEqual({ effort: "medium" });
	});

	test("non-official OpenAI base urls suppress official organization/project headers", () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			baseURL: "https://newapi.example/v1",
			organization: "org_123",
			project: "proj_123",
		});

		const client = (
			provider as unknown as {
				client: {
					baseURL: string;
					organization: string | null;
					project: string | null;
				};
			}
		).client;

		expect(client.baseURL).toContain("https://newapi.example/v1");
		expect(client.organization).toBeNull();
		expect(client.project).toBeNull();
	});

	test("official OpenAI endpoints retain organization/project headers", () => {
		const provider = new OpenAIProvider({
			apiKey: "test-key",
			baseURL: "https://api.openai.com/v1",
			organization: "org_123",
			project: "proj_123",
		});

		const client = (
			provider as unknown as {
				client: {
					organization: string | null;
					project: string | null;
				};
			}
		).client;

		expect(client.organization).toBe("org_123");
		expect(client.project).toBe("proj_123");
	});

	test("OpenAI compat still defaults to chat-completions wire unless overridden", () => {
		const provider = new OpenAICompatProvider({
			baseURL: "http://localhost:1234/v1",
			apiKey: "test-key",
			model: "local-model",
		});
		expect((provider as unknown as { wireApi: string }).wireApi).toBe(
			"chat_completions",
		);
	});
});

function completedEvent(
	response: OpenAI.Responses.Response,
): OpenAI.Responses.ResponseCompletedEvent {
	return {
		type: "response.completed",
		sequence_number: 1,
		response,
	};
}

function buildResponse(
	overrides: Partial<OpenAI.Responses.Response>,
): OpenAI.Responses.Response {
	return {
		id: "resp_test",
		created_at: 0,
		output_text: "",
		error: null,
		incomplete_details: null,
		instructions: null,
		metadata: null,
		model: "gpt-5.4",
		object: "response",
		output: [],
		parallel_tool_calls: false,
		temperature: 0,
		tool_choice: "auto",
		tools: [],
		top_p: 1,
		status: "completed",
		text: { format: { type: "text" } },
		truncation: "disabled",
		usage: {
			input_tokens: 1,
			input_tokens_details: { cached_tokens: 0 },
			output_tokens: 1,
			output_tokens_details: { reasoning_tokens: 0 },
			total_tokens: 2,
		},
		...overrides,
	};
}

async function* streamOf(
	events: OpenAI.Responses.ResponseStreamEvent[],
): AsyncIterable<OpenAI.Responses.ResponseStreamEvent> {
	for (const event of events) {
		yield event;
	}
}
