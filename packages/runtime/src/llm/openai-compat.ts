import { OpenAIProviderBase } from "./openai-shared.ts";
import type { OpenAIReasoningEffort, OpenAIWireApi } from "./openai-types.ts";

export interface OpenAICompatProviderOptions {
	baseURL: string;
	apiKey?: string;
	model?: string;
	maxRetries?: number;
	timeout?: number;
	wireApi?: OpenAIWireApi;
	reasoningEffort?: OpenAIReasoningEffort;
}

export class OpenAICompatProvider extends OpenAIProviderBase {
	constructor(options: OpenAICompatProviderOptions) {
		super({
			providerName: "openai-compat",
			model: options.model ?? "claude-sonnet-4",
			maxRetries: options.maxRetries ?? 3,
			wireApi:
				options.wireApi ??
				parseWireApi(process.env.OPENAI_COMPAT_WIRE_API) ??
				"chat_completions",
			reasoningEffort:
				options.reasoningEffort ??
				parseReasoningEffort(process.env.OPENAI_REASONING_EFFORT),
			clientOptions: {
				baseURL: options.baseURL,
				apiKey: options.apiKey || "not-needed",
				timeout: options.timeout,
			},
		});
	}
}

function parseWireApi(value: string | undefined): OpenAIWireApi | undefined {
	if (value === "chat_completions" || value === "responses") {
		return value;
	}
	return undefined;
}

function parseReasoningEffort(
	value: string | undefined,
): OpenAIReasoningEffort | undefined {
	if (
		value === "none" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	return undefined;
}
