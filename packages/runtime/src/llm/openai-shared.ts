import type {
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { LLMError, createLogger } from "@nous/core";
import OpenAI from "openai";
import {
	isOfficialOpenAIBaseURL,
	resolveOpenAICompatProfile,
	shouldFallbackOpenAIResponsesJsonSchema,
	type OpenAICompatProfile,
} from "./openai-compat-profile.ts";
import {
	buildResponsesRequestVariants,
	summarizeOpenAIChatRequest,
	summarizeOpenAIResponsesRequest,
	toOpenAIChatParams,
	toOpenAIResponsesParams,
} from "./openai-request-normalizer.ts";
import {
	collectResponsesStream,
	fromOpenAIChatResponse,
	fromOpenAIResponsesResponse,
	readResponsesFailureMessage,
	responseToolItemKey,
	summarizeOpenAIChatResponse,
	summarizeOpenAIResponsesResponse,
} from "./openai-response-normalizer.ts";
import {
	executeOpenAIRetryPolicy,
	summarizeOpenAIError,
} from "./openai-retry-policy.ts";
import type { OpenAIReasoningEffort, OpenAIWireApi } from "./openai-types.ts";

const log = createLogger("openai-provider");

export interface OpenAIProviderBaseOptions {
	providerName: string;
	model: string;
	maxRetries?: number;
	wireApi?: OpenAIWireApi;
	reasoningEffort?: OpenAIReasoningEffort;
	clientOptions: {
		apiKey?: string;
		baseURL?: string;
		organization?: string | null;
		project?: string | null;
		timeout?: number;
		defaultHeaders?: Record<string, string>;
	};
}

export class OpenAIProviderBase implements LLMProvider {
	readonly name: string;
	protected client: OpenAI;
	private readonly model: string;
	private readonly maxRetries: number;
	private readonly wireApi: OpenAIWireApi;
	private readonly reasoningEffort?: OpenAIReasoningEffort;
	private readonly compatProfile: OpenAICompatProfile;

	constructor(options: OpenAIProviderBaseOptions) {
		this.name = options.providerName;
		const clientOptions: ConstructorParameters<typeof OpenAI>[0] = {
			...options.clientOptions,
		};
		if (!isOfficialOpenAIBaseURL(clientOptions.baseURL)) {
			clientOptions.fetch = stripSdkHeadersFetch;
		}
		this.client = new OpenAI(clientOptions);
		this.model = options.model;
		this.maxRetries = options.maxRetries ?? 3;
		this.wireApi = options.wireApi ?? "responses";
		this.reasoningEffort = options.reasoningEffort;
		this.compatProfile = resolveOpenAICompatProfile({
			providerName: this.name,
			baseURL: options.clientOptions.baseURL,
			wireApi: this.wireApi,
		});
	}

	getCapabilities(): LLMProviderCapabilities {
		return {
			structuredOutputModes: ["json_schema", "json_object", "tool_calling"],
		};
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		return this.wireApi === "responses"
			? this.chatWithResponses(request)
			: this.chatWithChatCompletions(request);
	}

	async *stream(request: LLMRequest): AsyncIterable<StreamChunk> {
		if (this.wireApi === "responses") {
			yield* this.streamWithResponses(request);
			return;
		}
		yield* this.streamWithChatCompletions(request);
	}

	private async chatWithChatCompletions(
		request: LLMRequest,
	): Promise<LLMResponse> {
		const params = toOpenAIChatParams(this.model, request, this.compatProfile);
		return executeOpenAIRetryPolicy({
			providerName: this.name,
			maxRetries: this.maxRetries,
			operation: async (attempt) => {
				log.debug("Dispatching OpenAI chat request", {
					...summarizeOpenAIChatRequest(this.name, this.client, params),
					attempt: attempt + 1,
					wireApi: this.wireApi,
					compatProfile: this.compatProfile.id,
				});
				try {
					const response = await this.client.chat.completions.create({
						...params,
						stream: false,
					});
					log.debug("OpenAI chat response received", {
						...summarizeOpenAIChatResponse(response),
						attempt: attempt + 1,
						wireApi: this.wireApi,
						compatProfile: this.compatProfile.id,
					});
					return fromOpenAIChatResponse(response);
				} catch (err) {
					log.error("OpenAI chat request failed", {
						...summarizeOpenAIChatRequest(this.name, this.client, params),
						attempt: attempt + 1,
						wireApi: this.wireApi,
						compatProfile: this.compatProfile.id,
						...summarizeOpenAIError(err),
					});
					throw err;
				}
			},
		});
	}

	private async chatWithResponses(request: LLMRequest): Promise<LLMResponse> {
		const primaryParams = toOpenAIResponsesParams(
			this.model,
			request,
			this.reasoningEffort,
			this.compatProfile,
		);
		const requestVariants = buildResponsesRequestVariants(
			primaryParams,
			request,
			this.compatProfile,
		);
		return executeOpenAIRetryPolicy({
			providerName: this.name,
			maxRetries: this.maxRetries,
			operation: async (attempt) => {
				for (const variant of requestVariants) {
					log.debug("Dispatching OpenAI responses request", {
						...summarizeOpenAIResponsesRequest(
							this.name,
							this.client,
							variant.params,
						),
						attempt: attempt + 1,
						wireApi: this.wireApi,
						compatProfile: this.compatProfile.id,
						requestVariant: variant.name,
					});
					try {
						const stream = await this.client.responses.create(variant.params);
						const response = await collectResponsesStream(stream, this.name);
						log.debug("OpenAI responses response received", {
							...summarizeOpenAIResponsesResponse(
								response,
								this.compatProfile,
							),
							attempt: attempt + 1,
							wireApi: this.wireApi,
							compatProfile: this.compatProfile.id,
							requestVariant: variant.name,
						});
						return fromOpenAIResponsesResponse(response, this.compatProfile);
					} catch (err) {
						if (
							variant.name === "native_json_schema" &&
							shouldFallbackOpenAIResponsesJsonSchema({
								profile: this.compatProfile,
								err,
							})
						) {
							log.warn(
								"OpenAI responses json_schema failed; retrying with json_object fallback",
								{
									...summarizeOpenAIResponsesRequest(
										this.name,
										this.client,
										variant.params,
									),
									attempt: attempt + 1,
									wireApi: this.wireApi,
									compatProfile: this.compatProfile.id,
									requestVariant: variant.name,
									...summarizeOpenAIError(err),
								},
							);
							continue;
						}

						log.error("OpenAI responses request failed", {
							...summarizeOpenAIResponsesRequest(
								this.name,
								this.client,
								variant.params,
							),
							attempt: attempt + 1,
							wireApi: this.wireApi,
							compatProfile: this.compatProfile.id,
							requestVariant: variant.name,
							...summarizeOpenAIError(err),
						});
						throw err;
					}
				}
				throw new LLMError(
					"OpenAI responses request exhausted all variants",
					this.name,
				);
			},
		});
	}

	private async *streamWithChatCompletions(
		request: LLMRequest,
	): AsyncIterable<StreamChunk> {
		const params = toOpenAIChatParams(this.model, request, this.compatProfile);
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

	private async *streamWithResponses(
		request: LLMRequest,
	): AsyncIterable<StreamChunk> {
		const params = toOpenAIResponsesParams(
			this.model,
			request,
			this.reasoningEffort,
			this.compatProfile,
		);

		log.debug("Dispatching OpenAI responses stream", {
			...summarizeOpenAIResponsesRequest(this.name, this.client, params),
			wireApi: this.wireApi,
			compatProfile: this.compatProfile.id,
		});

		const stream = await this.client.responses.create(params);
		const activeToolCalls = new Set<string>();

		try {
			for await (const event of stream) {
				switch (event.type) {
					case "response.output_text.delta":
						if (event.delta) {
							yield { type: "text_delta", text: event.delta };
						}
						break;
					case "response.output_item.added": {
						if (event.item.type !== "function_call") break;
						const callId = event.item.call_id;
						const name = event.item.name;
						if (!callId || !name) break;
						const itemKey = responseToolItemKey(event.item, event.output_index);
						activeToolCalls.add(itemKey);
						yield {
							type: "tool_use_start",
							toolUse: {
								type: "tool_use",
								id: callId,
								name,
							},
						};
						break;
					}
					case "response.function_call_arguments.delta":
						if (event.delta) {
							yield { type: "tool_use_delta", text: event.delta };
						}
						break;
					case "response.output_item.done": {
						if (event.item.type !== "function_call") break;
						const itemKey = responseToolItemKey(event.item, event.output_index);
						if (!activeToolCalls.has(itemKey)) break;
						activeToolCalls.delete(itemKey);
						yield { type: "tool_use_end" };
						break;
					}
					case "error":
						throw new LLMError(event.message, this.name);
					case "response.failed":
						throw new LLMError(
							readResponsesFailureMessage(event.response) ??
								"OpenAI responses stream failed",
							this.name,
						);
					case "response.incomplete":
					case "response.completed":
						for (const itemKey of activeToolCalls) {
							activeToolCalls.delete(itemKey);
							yield { type: "tool_use_end" };
						}
						yield { type: "message_end" };
						break;
					default:
						break;
				}
			}
		} catch (err) {
			log.error("OpenAI responses stream failed", {
				...summarizeOpenAIResponsesRequest(this.name, this.client, params),
				wireApi: this.wireApi,
				compatProfile: this.compatProfile.id,
				...summarizeOpenAIError(err),
			});
			throw err;
		}
	}
}

const STRIPPED_HEADER_PREFIXES = ["x-stainless-"];
const STRIPPED_HEADER_NAMES = new Set(["user-agent"]);

function stripSdkHeadersFetch(
	url: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	if (init?.headers) {
		const original =
			init.headers instanceof Headers
				? init.headers
				: new Headers(init.headers as Record<string, string>);
		const cleaned = new Headers();
		original.forEach((value, key) => {
			const lk = key.toLowerCase();
			if (
				!STRIPPED_HEADER_NAMES.has(lk) &&
				!STRIPPED_HEADER_PREFIXES.some((p) => lk.startsWith(p))
			) {
				cleaned.set(key, value);
			}
		});
		init = { ...init, headers: cleaned };
	}
	return fetch(url, init);
}
