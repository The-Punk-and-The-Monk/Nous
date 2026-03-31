import type {
	ContentBlock,
	LLMMessage,
	LLMRequest,
	LLMResponseFormat,
} from "@nous/core";
import OpenAI from "openai";
import {
	shouldIncludeOpenAIReasoningEffort,
	shouldOmitOpenAITemperature,
	toOpenAIResponsesInputForProfile,
	type OpenAICompatProfile,
} from "./openai-compat-profile.ts";
import type { OpenAIReasoningEffort } from "./openai-types.ts";

export function toOpenAIChatParams(
	model: string,
	request: LLMRequest,
	compatProfile: OpenAICompatProfile,
): OpenAI.ChatCompletionCreateParams {
	const messages: OpenAI.ChatCompletionMessageParam[] = [];

	if (request.system) {
		messages.push({ role: "system", content: request.system });
	}

	for (const msg of request.messages) {
		if (msg.role === "system") continue;
		messages.push(toOpenAIChatMessage(msg));
	}

	const params: OpenAI.ChatCompletionCreateParams = {
		model,
		max_tokens: request.maxTokens,
		messages,
	};

	if (request.tools && request.tools.length > 0) {
		params.tools = request.tools.map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			},
		}));
	}
	if (
		request.temperature !== undefined &&
		!shouldOmitOpenAITemperature({
			profile: compatProfile,
			temperature: request.temperature,
		})
	) {
		params.temperature = request.temperature;
	}
	if (request.stopSequences) {
		params.stop = request.stopSequences;
	}
	const responseFormat = toOpenAIChatResponseFormat(request.responseFormat);
	if (responseFormat) {
		(
			params as OpenAI.ChatCompletionCreateParams & {
				response_format?: ReturnType<typeof toOpenAIChatResponseFormat>;
			}
		).response_format = responseFormat;
	}

	return params;
}

export function toOpenAIResponsesParams(
	model: string,
	request: LLMRequest,
	reasoningEffort: OpenAIReasoningEffort | undefined,
	compatProfile: OpenAICompatProfile,
): OpenAI.Responses.ResponseCreateParamsStreaming {
	const instructions = collectSystemInstructions(request);
	const params: OpenAI.Responses.ResponseCreateParamsStreaming = {
		model,
		input: toOpenAIResponsesInputForProfile(compatProfile, request.messages),
		max_output_tokens: request.maxTokens,
		parallel_tool_calls: false,
		store: false,
		stream: true,
		include: [],
		tool_choice: "auto",
	};

	if (instructions) {
		params.instructions = instructions;
	}
	if (request.tools) {
		params.tools = request.tools.map((tool) => ({
			type: "function",
			name: tool.name,
			description: tool.description,
			parameters: normalizeStrictJsonSchema(tool.inputSchema),
			strict: false,
		}));
	}
	if (
		request.temperature !== undefined &&
		!shouldOmitOpenAITemperature({
			profile: compatProfile,
			temperature: request.temperature,
		})
	) {
		params.temperature = request.temperature;
	}
	const text = toOpenAIResponsesTextConfig(request.responseFormat);
	if (text) {
		params.text = text;
	}
	if (
		shouldIncludeOpenAIReasoningEffort({
			profile: compatProfile,
			model,
			reasoningEffort,
		})
	) {
		params.reasoning = { effort: reasoningEffort };
	}

	return params;
}

export function buildResponsesRequestVariants(
	params: OpenAI.Responses.ResponseCreateParamsStreaming,
	request: LLMRequest,
	compatProfile: OpenAICompatProfile,
): Array<{
	name: "primary" | "native_json_schema" | "json_object_fallback";
	params: OpenAI.Responses.ResponseCreateParamsStreaming;
}> {
	if (
		request.responseFormat?.type !== "json_schema" ||
		!params.text?.format ||
		compatProfile.requestPolicy.responsesJsonSchemaFallback !==
			"json_object_on_400"
	) {
		return [{ name: "primary", params }];
	}
	return [
		{ name: "native_json_schema", params },
		{
			name: "json_object_fallback",
			params: {
				...params,
				text: {
					...params.text,
					format: { type: "json_object" },
				},
			},
		},
	];
}

export function summarizeOpenAIChatRequest(
	providerName: string,
	client: OpenAI,
	params: OpenAI.ChatCompletionCreateParams,
): Record<string, unknown> {
	const responseFormat =
		"response_format" in params
			? (
					params as OpenAI.ChatCompletionCreateParams & {
						response_format?: ReturnType<typeof toOpenAIChatResponseFormat>;
					}
				).response_format
			: undefined;

	return {
		provider: providerName,
		baseURL: client.baseURL ?? "default",
		model: params.model,
		maxTokens: "max_tokens" in params ? params.max_tokens : undefined,
		temperature: "temperature" in params ? params.temperature : undefined,
		stopCount: Array.isArray(params.stop) ? params.stop.length : 0,
		toolCount: Array.isArray(params.tools) ? params.tools.length : 0,
		responseFormatType: responseFormat?.type ?? "text",
		responseFormatPreview: responseFormat
			? clip(JSON.stringify(responseFormat), 1200)
			: undefined,
		messageCount: params.messages.length,
		messagePreview: clip(
			JSON.stringify(summarizeChatMessages(params.messages)),
			3000,
		),
	};
}

export function summarizeOpenAIResponsesRequest(
	providerName: string,
	client: OpenAI,
	params: OpenAI.Responses.ResponseCreateParamsStreaming,
): Record<string, unknown> {
	return {
		provider: providerName,
		baseURL: client.baseURL ?? "default",
		model: params.model,
		maxTokens: params.max_output_tokens,
		temperature: params.temperature,
		toolCount: Array.isArray(params.tools) ? params.tools.length : 0,
		responseFormatType: params.text?.format?.type ?? "text",
		responseFormatPreview: params.text?.format
			? clip(JSON.stringify(params.text.format), 1200)
			: undefined,
		messageCount: Array.isArray(params.input) ? params.input.length : 0,
		messagePreview: clip(
			JSON.stringify(summarizeResponsesInput(params.input)),
			3000,
		),
		instructionsPreview: params.instructions
			? clip(String(params.instructions), 1000)
			: undefined,
		reasoningEffort: params.reasoning?.effort,
		store: params.store,
		stream: params.stream,
	};
}

function collectSystemInstructions(request: LLMRequest): string | undefined {
	const parts: string[] = [];
	if (request.system?.trim()) {
		parts.push(request.system.trim());
	}
	for (const message of request.messages) {
		if (message.role !== "system") continue;
		const text = flattenCoreMessageText(message.content).trim();
		if (text) parts.push(text);
	}
	if (parts.length === 0) return undefined;
	return parts.join("\n\n");
}

function toOpenAIChatMessage(
	msg: LLMMessage,
): OpenAI.ChatCompletionMessageParam {
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
			(block): block is Extract<ContentBlock, { type: "tool_result" }> =>
				block.type === "tool_result",
		);
		if (toolResults.length > 0) {
			const toolResult = toolResults[0];
			return {
				role: "tool",
				tool_call_id: toolResult.toolUseId,
				content: toolResult.content,
			};
		}

		const text = msg.content
			.filter(
				(block): block is Extract<ContentBlock, { type: "text" }> =>
					block.type === "text",
			)
			.map((block) => block.text)
			.join("\n");
		return { role: "user", content: text };
	}

	return { role: "user", content: String(msg.content) };
}

function toOpenAIChatResponseFormat(format?: LLMResponseFormat) {
	if (!format || format.type === "text") return undefined;
	if (format.type === "json_object") {
		return { type: "json_object" as const };
	}
	return {
		type: "json_schema" as const,
		json_schema: {
			name: format.name,
			schema: format.schema,
			strict: format.strict ?? true,
		},
	};
}

function toOpenAIResponsesTextConfig(
	format?: LLMResponseFormat,
): OpenAI.Responses.ResponseTextConfig | undefined {
	if (!format || format.type === "text") return undefined;
	if (format.type === "json_object") {
		return {
			format: { type: "json_object" },
		};
	}
	return {
		format: {
			type: "json_schema",
			name: format.name,
			schema: normalizeStrictJsonSchema(format.schema),
			strict: false,
		},
	};
}

function normalizeStrictJsonSchema(
	schema: Record<string, unknown>,
): Record<string, unknown> {
	const normalized = normalizeJsonSchemaNode(schema);
	return isRecord(normalized) ? normalized : schema;
}

function normalizeJsonSchemaNode(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeJsonSchemaNode(item));
	}
	if (!isRecord(value)) {
		return value;
	}

	const result: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		result[key] = normalizeJsonSchemaNode(child);
	}

	const hasObjectType =
		result.type === "object" ||
		(Array.isArray(result.type) && result.type.includes("object"));
	const hasProperties = isRecord(result.properties);
	if (
		(hasObjectType || hasProperties) &&
		result.additionalProperties === undefined
	) {
		result.additionalProperties = false;
	}

	return result;
}

function summarizeChatMessages(
	messages: OpenAI.ChatCompletionMessageParam[],
): Array<Record<string, unknown>> {
	return messages.map((message) => {
		if (message.role === "system") {
			return {
				role: "system",
				content: clip(flattenOpenAIMessageContent(message.content), 400),
			};
		}
		if (message.role === "user") {
			return {
				role: "user",
				content: clip(flattenOpenAIMessageContent(message.content), 400),
			};
		}
		if (message.role === "tool") {
			return {
				role: "tool",
				toolCallId: message.tool_call_id,
				content: clip(flattenOpenAIMessageContent(message.content), 400),
			};
		}
		if (message.role !== "assistant") {
			return {
				role: message.role,
				content: clip(
					flattenOpenAIMessageContent(
						"content" in message
							? (message as { content?: unknown }).content
							: "",
					),
					400,
				),
			};
		}
		return {
			role: "assistant",
			content: clip(flattenOpenAIMessageContent(message.content), 400),
			toolCalls:
				message.tool_calls?.map(
					(toolCall: OpenAI.ChatCompletionMessageToolCall) => ({
						id: toolCall.id,
						name:
							"function" in toolCall ? toolCall.function.name : toolCall.type,
						arguments:
							"function" in toolCall
								? clip(toolCall.function.arguments, 300)
								: undefined,
					}),
				) ?? [],
		};
	});
}

function summarizeResponsesInput(
	input: OpenAI.Responses.ResponseInput | string | undefined,
): Array<Record<string, unknown>> | string | undefined {
	if (typeof input === "string") {
		return clip(input, 600);
	}
	if (!Array.isArray(input)) return undefined;
	return input.map((item) => {
		if (item.type === "message") {
			return {
				type: "message",
				role: item.role,
				content: clip(flattenResponsesMessageContent(item.content), 400),
			};
		}
		if (item.type === "function_call") {
			return {
				type: "function_call",
				callId: item.call_id,
				name: item.name,
				arguments: clip(item.arguments, 300),
			};
		}
		if (item.type === "function_call_output") {
			return {
				type: "function_call_output",
				callId: item.call_id,
				output: clip(
					typeof item.output === "string"
						? item.output
						: JSON.stringify(item.output),
					300,
				),
			};
		}
		return { type: item.type };
	});
}

function flattenResponsesMessageContent(
	content:
		| string
		| OpenAI.Responses.ResponseInputMessageContentList
		| OpenAI.Responses.ResponseOutputMessage["content"],
): string {
	if (typeof content === "string") return content;
	return content
		.map((part) => {
			if (part.type === "input_text") return part.text;
			if (part.type === "output_text") return part.text;
			if (part.type === "refusal") return `[refusal] ${part.refusal}`;
			return `[${part.type}]`;
		})
		.join("\n");
}

function flattenOpenAIMessageContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (!part || typeof part !== "object") {
				return "";
			}
			if ("text" in part && typeof part.text === "string") {
				return part.text;
			}
			if ("refusal" in part && typeof part.refusal === "string") {
				return `[refusal] ${part.refusal}`;
			}
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

function flattenCoreMessageText(content: LLMMessage["content"]): string {
	if (typeof content === "string") return content;
	return content
		.filter(
			(block): block is Extract<ContentBlock, { type: "text" }> =>
				block.type === "text",
		)
		.map((block) => block.text)
		.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clip(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}…`;
}
