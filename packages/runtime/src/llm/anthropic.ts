import Anthropic from "@anthropic-ai/sdk";
import type {
	ContentBlock,
	LLMMessage,
	LLMProvider,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { LLMError, RateLimitError } from "@nous/core";

export interface AnthropicProviderOptions {
	apiKey?: string;
	authToken?: string;
	baseURL?: string;
	model?: string;
	maxRetries?: number;
}

export class AnthropicProvider implements LLMProvider {
	readonly name = "anthropic";
	private client: Anthropic;
	private model: string;
	private maxRetries: number;

	constructor(options: AnthropicProviderOptions = {}) {
		const authToken =
			options.authToken ?? process.env.ANTHROPIC_AUTH_TOKEN ?? undefined;
		this.client = new Anthropic({
			apiKey: authToken
				? undefined
				: (options.apiKey ?? process.env.ANTHROPIC_API_KEY),
			authToken,
			baseURL: options.baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
		});
		this.model = options.model ?? "claude-sonnet-4-20250514";
		this.maxRetries = options.maxRetries ?? 3;
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		const params = this.toAnthropicParams(request);
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const response = await this.client.messages.create({
					...params,
					stream: false,
				});
				return this.fromAnthropicResponse(response);
			} catch (err) {
				lastError = err as Error;
				if (isRateLimitError(err)) {
					const retryAfter = getRetryAfterMs(err);
					if (attempt < this.maxRetries) {
						await sleep(retryAfter ?? 1000 * 2 ** attempt);
						continue;
					}
					throw new RateLimitError("anthropic", retryAfter);
				}
				throw new LLMError(
					(err as Error).message,
					"anthropic",
					(err as { status?: number }).status,
				);
			}
		}

		throw new LLMError(
			lastError?.message ?? "Max retries exceeded",
			"anthropic",
		);
	}

	async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
		const params = this.toAnthropicParams(request);

		const stream = this.client.messages.stream(params);

		for await (const event of stream) {
			if (event.type === "content_block_delta") {
				const delta = event.delta as {
					type: string;
					text?: string;
					partial_json?: string;
				};
				if (delta.type === "text_delta") {
					yield { type: "text_delta", text: delta.text };
				} else if (delta.type === "input_json_delta") {
					yield { type: "tool_use_delta", text: delta.partial_json };
				}
			} else if (event.type === "content_block_start") {
				const block = event.content_block as {
					type: string;
					id?: string;
					name?: string;
				};
				if (block.type === "tool_use") {
					yield {
						type: "tool_use_start",
						toolUse: { type: "tool_use", id: block.id, name: block.name },
					};
				}
			} else if (event.type === "content_block_stop") {
				yield { type: "tool_use_end" };
			} else if (event.type === "message_stop") {
				yield { type: "message_end" };
			}
		}
	}

	private toAnthropicParams(
		request: LLMRequest,
	): Anthropic.MessageCreateParams {
		const messages = request.messages
			.filter((m) => m.role !== "system")
			.map((m) => toAnthropicMessage(m));

		const params: Anthropic.MessageCreateParams = {
			model: this.model,
			max_tokens: request.maxTokens,
			messages,
		};

		if (request.system) {
			params.system = request.system;
		}
		if (request.tools && request.tools.length > 0) {
			params.tools = request.tools.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
			}));
		}
		if (request.temperature !== undefined) {
			params.temperature = request.temperature;
		}
		if (request.stopSequences) {
			params.stop_sequences = request.stopSequences;
		}

		return params;
	}

	private fromAnthropicResponse(response: Anthropic.Message): LLMResponse {
		const content: ContentBlock[] = [];
		for (const block of response.content) {
			if (block.type === "text") {
				content.push({ type: "text" as const, text: block.text });
			} else if (block.type === "tool_use") {
				content.push({
					type: "tool_use" as const,
					id: block.id,
					name: block.name,
					input: block.input as Record<string, unknown>,
				});
			}
			// Skip thinking blocks and other non-standard blocks
		}

		return {
			id: response.id,
			content,
			stopReason: response.stop_reason as LLMResponse["stopReason"],
			usage: {
				inputTokens: response.usage.input_tokens,
				outputTokens: response.usage.output_tokens,
			},
		};
	}
}

function toAnthropicMessage(msg: LLMMessage): Anthropic.MessageParam {
	if (typeof msg.content === "string") {
		return { role: msg.role as "user" | "assistant", content: msg.content };
	}

	const blocks: Anthropic.ContentBlockParam[] = msg.content.map((block) => {
		if (block.type === "text") {
			return { type: "text" as const, text: block.text };
		}
		if (block.type === "tool_use") {
			return {
				type: "tool_use" as const,
				id: block.id,
				name: block.name,
				input: block.input,
			};
		}
		// tool_result
		return {
			type: "tool_result" as const,
			tool_use_id: block.toolUseId,
			content: block.content,
			is_error: block.isError,
		};
	});

	return { role: msg.role as "user" | "assistant", content: blocks };
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
