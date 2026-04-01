import { OpenAIProviderBase } from "./openai-shared.ts";
import { isOfficialOpenAIBaseURL } from "./openai-compat-profile.ts";
import type { OpenAIReasoningEffort, OpenAIWireApi } from "./openai-types.ts";

export interface OpenAIProviderOptions {
	apiKey?: string;
	baseURL?: string;
	organization?: string | null;
	project?: string | null;
	model?: string;
	maxRetries?: number;
	timeout?: number;
	wireApi?: OpenAIWireApi;
	reasoningEffort?: OpenAIReasoningEffort;
}

export class OpenAIProvider extends OpenAIProviderBase {
	constructor(options: OpenAIProviderOptions = {}) {
		const baseURL =
			options.baseURL ??
			process.env.OPENAI_API_BASE_URL ??
			process.env.OPENAI_BASE_URL;
		const useOfficialHeaders = isOfficialOpenAIBaseURL(baseURL);
		super({
			providerName: "openai",
			model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.1",
			maxRetries: options.maxRetries ?? 3,
			wireApi:
				options.wireApi ??
				parseWireApi(process.env.OPENAI_WIRE_API) ??
				"responses",
			reasoningEffort:
				options.reasoningEffort ??
				parseReasoningEffort(process.env.OPENAI_REASONING_EFFORT),
			clientOptions: {
				apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
				baseURL,
				organization: useOfficialHeaders
					? options.organization ?? process.env.OPENAI_ORG_ID ?? null
					: null,
				project: useOfficialHeaders
					? options.project ?? process.env.OPENAI_PROJECT_ID ?? null
					: null,
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
