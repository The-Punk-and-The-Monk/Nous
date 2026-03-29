import { OpenAIChatProvider } from "./openai-shared.ts";

export interface OpenAIProviderOptions {
	apiKey?: string;
	baseURL?: string;
	organization?: string;
	project?: string;
	model?: string;
	maxRetries?: number;
	timeout?: number;
}

export class OpenAIProvider extends OpenAIChatProvider {
	constructor(options: OpenAIProviderOptions = {}) {
		super({
			providerName: "openai",
			model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.1",
			maxRetries: options.maxRetries ?? 3,
			clientOptions: {
				apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
				baseURL: options.baseURL ?? process.env.OPENAI_API_BASE_URL,
				organization: options.organization ?? process.env.OPENAI_ORG_ID,
				project: options.project ?? process.env.OPENAI_PROJECT_ID,
				timeout: options.timeout,
			},
		});
	}
}
