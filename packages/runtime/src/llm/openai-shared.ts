import type {
	ContentBlock,
	LLMMessage,
	LLMProvider,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { LLMError, RateLimitError } from "@nous/core";
import OpenAI from "openai";

export interface OpenAIChatProviderOptions {
	providerName: string;
	model: string;
	maxRetries?: number;
	clientOptions: {
		apiKey?: string;
		baseURL?: string;
		organization?: string;
		project?: string;
		timeout?: number;
	};
}

export class OpenAIChatProvider implements LLMProvider {
	readonly name: string;
	protected client: OpenAI;
	private model: string;
	private maxRetries: number;

	constructor(options: OpenAIChatProviderOptions) {
		this.name = options.providerName;
		this.client = new OpenAI(options.clientOptions);
		this.model = options.model;
		this.maxRetries = options.maxRetries ?? 3;
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		const params = toOpenAIParams(this.model, request);
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const response = await this.client.chat.completions.create({
					...params,
					stream: false,
				});
				return fromOpenAIResponse(response);
			} catch (err) {
				lastError = err as Error;
				if (isRateLimitError(err)) {
					const retryAfter = getRetryAfterMs(err);
					if (attempt < this.maxRetries) {
						await sleep(retryAfter ?? 1000 * 2 ** attempt);
						continue;
					}
					throw new RateLimitError(this.name, retryAfter);
				}
				throw new LLMError(
					(err as Error).message,
					this.name,
					(err as { status?: number }).status,
				);
			}
		}

		throw new LLMError(lastError?.message ?? "Max retries exceeded", this.name);
	}

	async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
		const params = toOpenAIParams(this.model, request);

		const stream = await this.client.chat.completions.create({
			...params,
			stream: true,
		});

		let currentToolCallIndex = -1;

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta;
			if (!delta) continue;

			if (delta.content) {
				yield { type: "text_delta", text: delta.content };
			}

			if (delta.tool_calls) {
				for (const tc of delta.tool_calls) {
					if (tc.index !== currentToolCallIndex) {
						if (currentToolCallIndex >= 0) {
							yield { type: "tool_use_end" };
						}
						currentToolCallIndex = tc.index;
						yield {
							type: "tool_use_start",
							toolUse: {
								type: "tool_use",
								id: tc.id,
								name: tc.function?.name,
							},
						};
					}
					if (tc.function?.arguments) {
						yield { type: "tool_use_delta", text: tc.function.arguments };
					}
				}
			}

			if (chunk.choices[0]?.finish_reason) {
				if (currentToolCallIndex >= 0) {
					yield { type: "tool_use_end" };
				}
				yield { type: "message_end" };
			}
		}
	}
}

function toOpenAIParams(
	model: string,
	request: LLMRequest,
): OpenAI.ChatCompletionCreateParams {
	const messages: OpenAI.ChatCompletionMessageParam[] = [];

	if (request.system) {
		messages.push({ role: "system", content: request.system });
	}

	for (const msg of request.messages) {
		if (msg.role === "system") continue;
		messages.push(toOpenAIMessage(msg));
	}

	const params: OpenAI.ChatCompletionCreateParams = {
		model,
		max_tokens: request.maxTokens,
		messages,
	};

	if (request.tools && request.tools.length > 0) {
		params.tools = request.tools.map((t) => ({
			type: "function" as const,
			function: {
				name: t.name,
				description: t.description,
				parameters: t.inputSchema,
			},
		}));
	}
	if (request.temperature !== undefined) {
		params.temperature = request.temperature;
	}
	if (request.stopSequences) {
		params.stop = request.stopSequences;
	}

	return params;
}

function fromOpenAIResponse(response: OpenAI.ChatCompletion): LLMResponse {
	const choice = response.choices[0];
	const content: ContentBlock[] = [];

	if (choice?.message.content) {
		content.push({ type: "text" as const, text: choice.message.content });
	}

	if (choice?.message.tool_calls) {
		for (const tc of choice.message.tool_calls) {
			if (tc.type !== "function") continue;
			let input: Record<string, unknown> = {};
			try {
				input = JSON.parse(tc.function.arguments);
			} catch {
				// Keep empty object if the model returned malformed JSON.
			}
			content.push({
				type: "tool_use" as const,
				id: tc.id,
				name: tc.function.name,
				input,
			});
		}
	}

	return {
		id: response.id,
		content,
		stopReason: mapFinishReason(choice?.finish_reason ?? null),
		usage: {
			inputTokens: response.usage?.prompt_tokens ?? 0,
			outputTokens: response.usage?.completion_tokens ?? 0,
		},
	};
}

function toOpenAIMessage(msg: LLMMessage): OpenAI.ChatCompletionMessageParam {
	if (typeof msg.content === "string") {
		if (msg.role === "tool") {
			return { role: "tool", content: msg.content, tool_call_id: "" };
		}
		return {
			role: msg.role as "user" | "assistant",
			content: msg.content,
		};
	}

	if (msg.role === "assistant") {
		let textContent = "";
		const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];

		for (const block of msg.content) {
			if (block.type === "text") {
				textContent += block.text;
			} else if (block.type === "tool_use") {
				toolCalls.push({
					id: block.id,
					type: "function",
					function: {
						name: block.name,
						arguments: JSON.stringify(block.input),
					},
				});
			}
		}

		const result: OpenAI.ChatCompletionAssistantMessageParam = {
			role: "assistant",
			content: textContent || null,
		};
		if (toolCalls.length > 0) {
			result.tool_calls = toolCalls;
		}
		return result;
	}

	if (msg.role === "user") {
		const toolResults = msg.content.filter(
			(b): b is Extract<ContentBlock, { type: "tool_result" }> =>
				b.type === "tool_result",
		);
		if (toolResults.length > 0) {
			const tr = toolResults[0];
			return {
				role: "tool" as const,
				tool_call_id: tr.toolUseId,
				content: tr.content,
			};
		}

		const text = msg.content
			.filter(
				(b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text",
			)
			.map((b) => b.text)
			.join("\n");
		return { role: "user", content: text };
	}

	return { role: "user", content: String(msg.content) };
}

function mapFinishReason(reason: string | null): LLMResponse["stopReason"] {
	switch (reason) {
		case "stop":
			return "end_turn";
		case "tool_calls":
			return "tool_use";
		case "length":
			return "max_tokens";
		default:
			return "end_turn";
	}
}

function isRateLimitError(err: unknown): boolean {
	return (err as { status?: number }).status === 429;
}

function getRetryAfterMs(err: unknown): number | undefined {
	const headers = (err as { headers?: Record<string, string> }).headers;
	const retryAfter = headers?.["retry-after"];
	if (retryAfter) {
		return Number.parseFloat(retryAfter) * 1000;
	}
	return undefined;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
