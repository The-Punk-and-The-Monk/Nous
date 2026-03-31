import type { ContentBlock, LLMMessage } from "@nous/core";
import type OpenAI from "openai";
import type { OpenAIReasoningEffort, OpenAIWireApi } from "./openai-types.ts";

export interface OpenAICompatProfile {
	id: string;
	providerName: string;
	wireApi: OpenAIWireApi;
	endpointKind: "official" | "compatible";
	requestPolicy: {
		omitZeroTemperature: boolean;
		assistantTextReplay: "output_text" | "input_text";
		responsesJsonSchemaFallback: "none" | "json_object_on_400";
		reasoningEffortPolicy: "model_gated" | "omit";
	};
	responsePolicy: {
		messageSelection: "all_messages" | "prefer_final_answer";
	};
}

export function resolveOpenAICompatProfile(params: {
	providerName: string;
	baseURL?: string;
	wireApi: OpenAIWireApi;
}): OpenAICompatProfile {
	const endpointKind =
		params.wireApi === "responses" && !isOfficialOpenAIBaseURL(params.baseURL)
			? "compatible"
			: "official";

	if (params.wireApi === "responses" && endpointKind === "compatible") {
		return {
			id: "openai-responses-compatible",
			providerName: params.providerName,
			wireApi: params.wireApi,
			endpointKind,
			requestPolicy: {
				omitZeroTemperature: true,
				assistantTextReplay: "output_text",
				responsesJsonSchemaFallback: "json_object_on_400",
				reasoningEffortPolicy: "omit",
			},
			responsePolicy: {
				messageSelection: "prefer_final_answer",
			},
		};
	}

	if (params.wireApi === "responses") {
		return {
			id: "openai-responses-official",
			providerName: params.providerName,
			wireApi: params.wireApi,
			endpointKind,
			requestPolicy: {
				omitZeroTemperature: true,
				assistantTextReplay: "output_text",
				responsesJsonSchemaFallback: "json_object_on_400",
				reasoningEffortPolicy: "model_gated",
			},
			responsePolicy: {
				messageSelection: "prefer_final_answer",
			},
		};
	}

	return {
		id: "openai-chat-default",
		providerName: params.providerName,
		wireApi: params.wireApi,
		endpointKind,
		requestPolicy: {
			omitZeroTemperature: true,
			assistantTextReplay: "input_text",
			responsesJsonSchemaFallback: "none",
			reasoningEffortPolicy: "omit",
		},
		responsePolicy: {
			messageSelection: "all_messages",
		},
	};
}

export function shouldIncludeOpenAIReasoningEffort(params: {
	profile: OpenAICompatProfile;
	model: string;
	reasoningEffort?: OpenAIReasoningEffort;
}): boolean {
	if (!params.reasoningEffort) return false;
	if (params.profile.requestPolicy.reasoningEffortPolicy !== "model_gated") {
		return false;
	}
	return supportsResponsesReasoning(params.model);
}

export function shouldFallbackOpenAIResponsesJsonSchema(params: {
	profile: OpenAICompatProfile;
	err: unknown;
}): boolean {
	if (params.profile.requestPolicy.responsesJsonSchemaFallback !== "json_object_on_400") {
		return false;
	}
	const status = (params.err as { status?: number }).status;
	return status === 400;
}

export function shouldOmitOpenAITemperature(params: {
	profile: OpenAICompatProfile;
	temperature?: number;
}): boolean {
	return (
		params.profile.requestPolicy.omitZeroTemperature &&
		params.temperature !== undefined &&
		params.temperature === 0
	);
}

export function toOpenAIResponsesInputForProfile(
	profile: OpenAICompatProfile,
	messages: LLMMessage[],
): OpenAI.Responses.ResponseInputItem[] {
	const input: OpenAI.Responses.ResponseInputItem[] = [];

	for (const message of messages) {
		switch (message.role) {
			case "system":
				break;
			case "user": {
				const blocks =
					typeof message.content === "string"
						? [{ type: "text" as const, text: message.content }]
						: message.content;
				const textParts = blocks.filter(
					(block): block is Extract<ContentBlock, { type: "text" }> =>
						block.type === "text",
				);
				if (textParts.length > 0) {
					input.push({
						type: "message",
						role: "user",
						content: textParts.map((block) => ({
							type: "input_text",
							text: block.text,
						})),
					});
				}
				for (const block of blocks) {
					if (block.type !== "tool_result") continue;
					input.push({
						type: "function_call_output",
						call_id: block.toolUseId,
						output: block.content,
					});
				}
				break;
			}
			case "assistant": {
				const blocks =
					typeof message.content === "string"
						? [{ type: "text" as const, text: message.content }]
						: message.content;
				const textParts = blocks.filter(
					(block): block is Extract<ContentBlock, { type: "text" }> =>
						block.type === "text",
				);
				if (textParts.length > 0) {
					const content = textParts.map((block) => ({
						type: "output_text" as const,
						text: block.text,
						annotations: [],
					}));
					input.push({
						id: `msg_assistant_${input.length}`,
						type: "message",
						role: "assistant",
						status: "completed",
						content,
					});
				}
				for (const block of blocks) {
					if (block.type !== "tool_use") continue;
					input.push({
						type: "function_call",
						call_id: block.id,
						name: block.name,
						arguments: JSON.stringify(block.input),
					});
				}
				break;
			}
			case "tool": {
				const text = flattenCoreMessageText(message.content).trim();
				if (text) {
					input.push({
						type: "message",
						role: "user",
						content: [{ type: "input_text", text }],
					});
				}
				break;
			}
		}
	}

	return input;
}

export function selectResponseMessageItemsForProfile(
	profile: OpenAICompatProfile,
	output: OpenAI.Responses.Response["output"],
): OpenAI.Responses.Response["output"] {
	const messageItems = output.filter(
		(
			item,
		): item is Extract<OpenAI.Responses.ResponseOutputItem, { type: "message" }> =>
			item.type === "message",
	);

	if (profile.responsePolicy.messageSelection !== "prefer_final_answer") {
		return output;
	}

	const finalAnswerMessages = messageItems.filter(
		(item) => item.phase === "final_answer",
	);
	const selectedMessages =
		finalAnswerMessages.length > 0 ? finalAnswerMessages : messageItems;
	const selectedMessageIds = new Set(selectedMessages.map((item) => item.id));
	return output.filter(
		(item) =>
			item.type === "function_call" ||
			(item.type === "message" && selectedMessageIds.has(item.id)),
	);
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

function supportsResponsesReasoning(model: string): boolean {
	return /^(gpt-5|o[1-9]|o3|o4)/i.test(model.trim());
}

function isOfficialOpenAIBaseURL(baseURL?: string): boolean {
	if (!baseURL || !baseURL.trim()) {
		return true;
	}
	try {
		const host = new URL(baseURL).hostname.toLowerCase();
		return host === "api.openai.com" || host === "chatgpt.com";
	} catch {
		const normalized = baseURL.toLowerCase();
		return normalized.includes("api.openai.com") || normalized.includes("chatgpt.com");
	}
}
