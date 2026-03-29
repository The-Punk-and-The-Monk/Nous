import type { LLMProvider } from "@nous/core";
import {
	AnthropicProvider,
	ClaudeCliProvider,
	OpenAICompatProvider,
	OpenAIProvider,
} from "@nous/runtime";
import { loadNousConfig } from "../config/home.ts";

export interface EnvLike {
	[key: string]: string | undefined;
}

export interface ProviderSelection {
	provider: LLMProvider;
	providerName: string;
}

export function createLLMProviderFromEnv(
	env: EnvLike = process.env,
): ProviderSelection {
	const config = loadNousConfig({ env });
	const compatBaseURL = env.OPENAI_BASE_URL;
	const openAIApiKey = env.OPENAI_API_KEY;
	const anthropicApiKey = env.ANTHROPIC_API_KEY;
	const anthropicAuthToken = env.ANTHROPIC_AUTH_TOKEN;

	for (const candidate of config.provider.priority) {
		if (candidate === "openai_compat" && compatBaseURL) {
			return {
				provider: new OpenAICompatProvider({
					baseURL: compatBaseURL,
					apiKey: openAIApiKey,
					model: env.OPENAI_MODEL ?? config.provider.openaiModel,
				}),
				providerName: `openai-compat (${compatBaseURL})`,
			};
		}

		if (candidate === "openai" && openAIApiKey) {
			return {
				provider: new OpenAIProvider({
					apiKey: openAIApiKey,
					baseURL: env.OPENAI_API_BASE_URL,
					organization: env.OPENAI_ORG_ID,
					project: env.OPENAI_PROJECT_ID,
					model: env.OPENAI_MODEL ?? config.provider.openaiModel,
				}),
				providerName: "openai",
			};
		}

		if (candidate === "anthropic" && (anthropicApiKey || anthropicAuthToken)) {
			return {
				provider: new AnthropicProvider({
					apiKey: anthropicApiKey,
					authToken: anthropicAuthToken,
					baseURL: env.ANTHROPIC_BASE_URL,
				}),
				providerName: "anthropic",
			};
		}

		if (candidate === "claude_cli") {
			return {
				provider: new ClaudeCliProvider({
					model: env.NOUS_MODEL ?? config.provider.claudeModel,
				}),
				providerName: "claude-cli",
			};
		}
	}

	if (compatBaseURL) {
		return {
			provider: new OpenAICompatProvider({
				baseURL: compatBaseURL,
				apiKey: openAIApiKey,
				model: env.OPENAI_MODEL ?? config.provider.openaiModel,
			}),
			providerName: `openai-compat (${compatBaseURL})`,
		};
	}

	if (openAIApiKey) {
		return {
			provider: new OpenAIProvider({
				apiKey: openAIApiKey,
				baseURL: env.OPENAI_API_BASE_URL,
				organization: env.OPENAI_ORG_ID,
				project: env.OPENAI_PROJECT_ID,
				model: env.OPENAI_MODEL ?? config.provider.openaiModel,
			}),
			providerName: "openai",
		};
	}

	if (anthropicApiKey || anthropicAuthToken) {
		return {
			provider: new AnthropicProvider({
				apiKey: anthropicApiKey,
				authToken: anthropicAuthToken,
				baseURL: env.ANTHROPIC_BASE_URL,
			}),
			providerName: "anthropic",
		};
	}

	return {
		provider: new ClaudeCliProvider({
			model: env.NOUS_MODEL ?? config.provider.claudeModel,
		}),
		providerName: "claude-cli",
	};
}
