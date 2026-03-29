import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type NousConfigLoadOptions, getNousPaths } from "./home.ts";

export interface ProviderSecrets {
	openai?: {
		apiKey?: string;
		organization?: string;
		project?: string;
	};
	anthropic?: {
		apiKey?: string;
		authToken?: string;
	};
	openaiCompat?: {
		apiKey?: string;
	};
}

export interface NousSecrets {
	providers: ProviderSecrets;
}

export interface SecretStore {
	getNousSecrets(): NousSecrets;
	getProviderSecrets(): ProviderSecrets;
}

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;

type JsonObject = {
	[key: string]: JsonValue;
};

const DEFAULT_NOUS_SECRETS: NousSecrets = {
	providers: {},
};

export class FileSecretStore implements SecretStore {
	constructor(private readonly options: NousConfigLoadOptions = {}) {}

	getNousSecrets(): NousSecrets {
		return loadNousSecrets(this.options);
	}

	getProviderSecrets(): ProviderSecrets {
		return this.getNousSecrets().providers;
	}
}

export function loadNousSecrets(
	options: NousConfigLoadOptions = {},
): NousSecrets {
	const env = options.env ?? process.env;
	const paths = getNousPaths(options);
	const filePath = resolve(
		env.NOUS_SECRETS_FILE ?? join(paths.secretsDir, "providers.json"),
	);
	const data = readJson(filePath);
	const providers = asJsonObject(data?.providers);

	return {
		providers: {
			openai: readOpenAISecrets(providers?.openai),
			anthropic: readAnthropicSecrets(providers?.anthropic),
			openaiCompat: readOpenAICompatSecrets(providers?.openaiCompat),
		},
	};
}

function readOpenAISecrets(
	value: JsonValue | undefined,
): ProviderSecrets["openai"] {
	const object = asJsonObject(value);
	if (!object) return DEFAULT_NOUS_SECRETS.providers.openai;
	return {
		apiKey: readString(object.apiKey),
		organization: readString(object.organization),
		project: readString(object.project),
	};
}

function readAnthropicSecrets(
	value: JsonValue | undefined,
): ProviderSecrets["anthropic"] {
	const object = asJsonObject(value);
	if (!object) return DEFAULT_NOUS_SECRETS.providers.anthropic;
	return {
		apiKey: readString(object.apiKey),
		authToken: readString(object.authToken),
	};
}

function readOpenAICompatSecrets(
	value: JsonValue | undefined,
): ProviderSecrets["openaiCompat"] {
	const object = asJsonObject(value);
	if (!object) return DEFAULT_NOUS_SECRETS.providers.openaiCompat;
	return {
		apiKey: readString(object.apiKey),
	};
}

function readString(value: JsonValue | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function readJson(path: string): JsonObject | undefined {
	if (!existsSync(path)) return undefined;
	try {
		return asJsonObject(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return undefined;
	}
}

function asJsonObject(value: unknown): JsonObject | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as JsonObject;
}
