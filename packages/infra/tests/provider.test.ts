import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLLMProviderFromEnv } from "../src/cli/provider.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("createLLMProviderFromEnv", () => {
	test("uses direct OpenAI base url when OPENAI_BASE_URL is set with an API key", () => {
		const { provider, providerName } = createLLMProviderFromEnv({
			OPENAI_BASE_URL: "https://api.openai-proxy.local/v1",
			OPENAI_API_KEY: "openai-key",
			ANTHROPIC_API_KEY: "anthropic-key",
		});

		expect(provider.name).toBe("openai");
		expect(providerName).toBe("openai");
		expect(
			(provider as { client: { baseURL: string } }).client.baseURL,
		).toContain("https://api.openai-proxy.local/v1");
	});

	test("uses explicit compat endpoint when OPENAI_COMPAT_BASE_URL is set", () => {
		const { provider, providerName } = createLLMProviderFromEnv({
			OPENAI_COMPAT_BASE_URL: "http://localhost:1234/v1",
			OPENAI_API_KEY: "compat-key",
			ANTHROPIC_API_KEY: "anthropic-key",
		});

		expect(provider.name).toBe("openai-compat");
		expect(providerName).toContain("http://localhost:1234/v1");
	});

	test("uses direct OpenAI when OPENAI_API_KEY is set without compat base url", () => {
		const { provider, providerName } = createLLMProviderFromEnv({
			OPENAI_API_KEY: "openai-key",
		});

		expect(provider.name).toBe("openai");
		expect(providerName).toBe("openai");
	});

	test("falls back to Anthropic when OpenAI is not configured", () => {
		const { provider, providerName } = createLLMProviderFromEnv({
			ANTHROPIC_API_KEY: "anthropic-key",
		});

		expect(provider.name).toBe("anthropic");
		expect(providerName).toBe("anthropic");
	});

	test("loads provider secrets from ~/.nous/secrets/providers.json", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-provider-secret-"));
		tempDirs.push(root);
		const home = join(root, ".nous");
		mkdirSync(join(home, "secrets"), { recursive: true });
		writeFileSync(
			join(home, "secrets", "providers.json"),
			JSON.stringify({
				providers: {
					openai: {
						apiKey: "file-openai-key",
						organization: "org-from-file",
					},
				},
			}),
		);

		const { provider, providerName } = createLLMProviderFromEnv({
			NOUS_HOME: home,
		});

		expect(provider.name).toBe("openai");
		expect(providerName).toBe("openai");
	});

	test("environment variables override file-based provider secrets", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-provider-env-"));
		tempDirs.push(root);
		const home = join(root, ".nous");
		mkdirSync(join(home, "secrets"), { recursive: true });
		writeFileSync(
			join(home, "secrets", "providers.json"),
			JSON.stringify({
				providers: {
					anthropic: {
						apiKey: "file-anthropic-key",
					},
				},
			}),
		);

		const { provider, providerName } = createLLMProviderFromEnv({
			NOUS_HOME: home,
			OPENAI_API_KEY: "env-openai-key",
		});

		expect(provider.name).toBe("openai");
		expect(providerName).toBe("openai");
	});

	test("loads direct OpenAI model and base url from ~/.nous/config/providers.json", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-provider-config-"));
		tempDirs.push(root);
		const home = join(root, ".nous");
		mkdirSync(join(home, "config"), { recursive: true });
		mkdirSync(join(home, "secrets"), { recursive: true });
		writeFileSync(
			join(home, "config", "providers.json"),
			JSON.stringify({
				provider: {
					priority: ["openai", "claude_cli"],
					openaiModel: "gpt-4o-mini",
					openaiBaseURL: "https://openai-proxy.example/v1",
				},
			}),
		);
		writeFileSync(
			join(home, "secrets", "providers.json"),
			JSON.stringify({
				providers: {
					openai: {
						apiKey: "file-openai-key",
					},
				},
			}),
		);

		const { provider } = createLLMProviderFromEnv({
			NOUS_HOME: home,
		});

		expect(provider.name).toBe("openai");
		expect(
			(provider as { client: { baseURL: string } }).client.baseURL,
		).toContain("https://openai-proxy.example/v1");
	});

	test("falls back to Claude CLI when no API provider is configured", () => {
		const { provider, providerName } = createLLMProviderFromEnv({});

		expect(provider.name).toBe("claude-cli");
		expect(providerName).toBe("claude-cli");
	});
});
