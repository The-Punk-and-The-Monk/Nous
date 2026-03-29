import type { LLMProvider } from "@nous/core";
import {
	AnthropicProvider,
	ClaudeCliProvider,
	OpenAICompatProvider,
	OpenAIProvider,
} from "@nous/runtime";
import { loadNousConfig } from "../config/home.ts";
import { FileSecretStore, type SecretStore } from "../config/secrets.ts";

export interface EnvLike {
	[key: string]: string | undefined;
}

export interface ProviderSelection {
	provider: LLMProvider;
	providerName: string;
}

export interface ProviderSelectionOptions {
	env?: EnvLike;
	secretStore?: SecretStore;
}

export function createLLMProviderFromEnv(
	env: EnvLike = process.env,
): ProviderSelection {
	return createLLMProvider({ env });
}

export function createLLMProvider(
	options: ProviderSelectionOptions = {},
): ProviderSelection {
	const env = options.env ?? process.env;
	const config = loadNousConfig({ env });
	const secretStore = options.secretStore ?? new FileSecretStore({ env });
	const secrets = secretStore.getProviderSecrets();
	const compatBaseURL = env.OPENAI_BASE_URL;
	const openAIApiKey = firstDefined(env.OPENAI_API_KEY, secrets.openai?.apiKey);
	const openAIOrgId = firstDefined(
		env.OPENAI_ORG_ID,
		secrets.openai?.organization,
	);
	const openAIProjectId = firstDefined(
		env.OPENAI_PROJECT_ID,
		secrets.openai?.project,
	);
	const compatApiKey = firstDefined(
		env.OPENAI_API_KEY,
		secrets.openaiCompat?.apiKey,
		secrets.openai?.apiKey,
	);
	const anthropicApiKey = firstDefined(
		env.ANTHROPIC_API_KEY,
		secrets.anthropic?.apiKey,
	);
	const anthropicAuthToken = firstDefined(
		env.ANTHROPIC_AUTH_TOKEN,
		secrets.anthropic?.authToken,
	);

	for (const candidate of config.provider.priority) {
		if (candidate === "openai_compat" && compatBaseURL) {
			return {
				provider: new OpenAICompatProvider({
					baseURL: compatBaseURL,
					apiKey: compatApiKey,
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
					organization: openAIOrgId,
					project: openAIProjectId,
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
				apiKey: compatApiKey,
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
				organization: openAIOrgId,
				project: openAIProjectId,
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

function firstDefined(
	...values: Array<string | undefined>
): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}
	return undefined;
}
