import { describe, expect, test } from "bun:test";
import { createLLMProviderFromEnv } from "../src/cli/provider.ts";

describe("createLLMProviderFromEnv", () => {
	test("prefers OpenAI-compatible endpoint when OPENAI_BASE_URL is set", () => {
		const { provider, providerName } = createLLMProviderFromEnv({
			OPENAI_BASE_URL: "http://localhost:1234/v1",
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

	test("falls back to Claude CLI when no API provider is configured", () => {
		const { provider, providerName } = createLLMProviderFromEnv({});

		expect(provider.name).toBe("claude-cli");
		expect(providerName).toBe("claude-cli");
	});
});
