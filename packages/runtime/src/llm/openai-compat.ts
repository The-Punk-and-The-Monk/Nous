import { OpenAIChatProvider } from "./openai-shared.ts";

export interface OpenAICompatProviderOptions {
	baseURL: string;
	apiKey?: string;
	model?: string;
	maxRetries?: number;
	timeout?: number;
}

export class OpenAICompatProvider extends OpenAIChatProvider {
	constructor(options: OpenAICompatProviderOptions) {
		super({
			providerName: "openai-compat",
			model: options.model ?? "claude-sonnet-4",
			maxRetries: options.maxRetries ?? 3,
			clientOptions: {
				baseURL: options.baseURL,
				apiKey: options.apiKey || "not-needed",
				timeout: options.timeout,
			},
		});
	}
}
