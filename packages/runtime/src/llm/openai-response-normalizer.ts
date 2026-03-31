import type { ContentBlock, LLMResponse } from "@nous/core";
import { LLMError } from "@nous/core";
import type OpenAI from "openai";
import {
	resolveOpenAICompatProfile,
	selectResponseMessageItemsForProfile,
	type OpenAICompatProfile,
} from "./openai-compat-profile.ts";

export function fromOpenAIChatResponse(
	response: OpenAI.ChatCompletion,
): LLMResponse {
	const choice = response.choices[0];
	const content: ContentBlock[] = [];

	if (choice?.message.content) {
		content.push({ type: "text", text: choice.message.content });
	}

	if (choice?.message.tool_calls) {
		for (const toolCall of choice.message.tool_calls) {
			if (toolCall.type !== "function") continue;
			content.push({
				type: "tool_use",
				id: toolCall.id,
				name: toolCall.function.name,
				input: parseToolInput(toolCall.function.arguments),
			});
		}
	}

	return {
		id: response.id,
		content,
		stopReason: mapChatFinishReason(choice?.finish_reason ?? null),
		usage: {
			inputTokens: response.usage?.prompt_tokens ?? 0,
			outputTokens: response.usage?.completion_tokens ?? 0,
		},
	};
}

export function fromOpenAIResponsesResponse(
	response: OpenAI.Responses.Response,
	compatProfile: OpenAICompatProfile,
): LLMResponse {
	const content: ContentBlock[] = [];

	for (const item of selectResponseMessageItemsForProfile(
		compatProfile,
		response.output,
	)) {
		if (item.type === "message") {
			for (const part of item.content) {
				if (part.type === "output_text") {
					content.push({ type: "text", text: part.text });
					continue;
				}
				if (part.type === "refusal") {
					content.push({ type: "text", text: part.refusal });
				}
			}
			continue;
		}
		if (item.type === "function_call") {
			content.push({
				type: "tool_use",
				id: item.call_id,
				name: item.name,
				input: parseToolInput(item.arguments),
			});
		}
	}

	return {
		id: response.id,
		content,
		stopReason: mapResponsesStopReason(response),
		usage: {
			inputTokens: response.usage?.input_tokens ?? 0,
			outputTokens: response.usage?.output_tokens ?? 0,
		},
	};
}

export async function collectResponsesStream(
	stream: AsyncIterable<OpenAI.Responses.ResponseStreamEvent>,
	providerName: string,
): Promise<OpenAI.Responses.Response> {
	let completedResponse: OpenAI.Responses.Response | undefined;
	let incompleteResponse: OpenAI.Responses.Response | undefined;

	for await (const event of stream) {
		switch (event.type) {
			case "error":
				throw new LLMError(event.message, providerName);
			case "response.failed":
				throw new LLMError(
					readResponsesFailureMessage(event.response) ??
						"OpenAI responses request failed",
					providerName,
				);
			case "response.incomplete":
				incompleteResponse = event.response;
				break;
			case "response.completed":
				completedResponse = event.response;
				break;
			default:
				break;
		}
	}

	if (completedResponse) {
		return completedResponse;
	}
	if (incompleteResponse) {
		return incompleteResponse;
	}
	throw new LLMError(
		"OpenAI responses stream ended without a completed response",
		providerName,
	);
}

export function summarizeOpenAIChatResponse(
	response: OpenAI.ChatCompletion,
): Record<string, unknown> {
	const choice = response.choices[0];
	return {
		responseId: response.id,
		finishReason: choice?.finish_reason ?? null,
		textPreview: clip(choice?.message.content ?? "", 500),
		toolCallCount: choice?.message.tool_calls?.length ?? 0,
		usage: response.usage
			? {
					promptTokens: response.usage.prompt_tokens,
					completionTokens: response.usage.completion_tokens,
					totalTokens: response.usage.total_tokens,
				}
			: undefined,
	};
}

export function summarizeOpenAIResponsesResponse(
	response: OpenAI.Responses.Response,
	compatProfile?: OpenAICompatProfile,
): Record<string, unknown> {
	return {
		responseId: response.id,
		status: response.status,
		stopReason: response.incomplete_details?.reason ?? null,
		textPreview: clip(extractResponsesVisibleText(response, compatProfile), 500),
		toolCallCount: response.output.filter(
			(item) => item.type === "function_call",
		).length,
		usage: response.usage
			? {
					inputTokens: response.usage.input_tokens,
					outputTokens: response.usage.output_tokens,
					totalTokens: response.usage.total_tokens,
					reasoningTokens:
						response.usage.output_tokens_details.reasoning_tokens,
				}
			: undefined,
	};
}

export function responseToolItemKey(
	item: Extract<OpenAI.Responses.ResponseOutputItem, { type: "function_call" }>,
	outputIndex: number,
): string {
	return item.id ?? `${item.call_id}:${outputIndex}`;
}

export function readResponsesFailureMessage(
	response: OpenAI.Responses.Response,
): string | undefined {
	return response.error?.message ?? (response.output_text || undefined);
}

function mapChatFinishReason(reason: string | null): LLMResponse["stopReason"] {
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

function mapResponsesStopReason(
	response: OpenAI.Responses.Response,
): LLMResponse["stopReason"] {
	if (response.output.some((item) => item.type === "function_call")) {
		return "tool_use";
	}
	if (response.incomplete_details?.reason === "max_output_tokens") {
		return "max_tokens";
	}
	return "end_turn";
}

function extractResponsesVisibleText(
	response: OpenAI.Responses.Response,
	compatProfile?: OpenAICompatProfile,
): string {
	const profile =
		compatProfile ??
		resolveOpenAICompatProfile({
			providerName: "openai",
			wireApi: "responses",
		});
	return selectResponseMessageItemsForProfile(profile, response.output)
		.filter(
			(item): item is Extract<OpenAI.Responses.ResponseOutputItem, { type: "message" }> =>
				item.type === "message",
		)
		.flatMap((item) => item.content)
		.map((part) => {
			if (part.type === "output_text") return part.text;
			if (part.type === "refusal") return part.refusal;
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

function parseToolInput(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw);
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clip(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}…`;
}
