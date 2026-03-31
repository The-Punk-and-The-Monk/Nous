import { describe, expect, test } from "bun:test";
import { LLMError, RateLimitError } from "@nous/core";
import { executeOpenAIRetryPolicy } from "../src/llm/openai-retry-policy.ts";

describe("OpenAI retry policy", () => {
	test("retries 429 responses and eventually succeeds", async () => {
		let attempts = 0;
		const result = await executeOpenAIRetryPolicy({
			providerName: "openai",
			maxRetries: 2,
			operation: async () => {
				attempts += 1;
				if (attempts < 2) {
					const error = new Error("rate limited") as Error & {
						status?: number;
						headers?: Record<string, string>;
					};
					error.status = 429;
					error.headers = { "retry-after": "0" };
					throw error;
				}
				return "ok";
			},
		});

		expect(result).toBe("ok");
		expect(attempts).toBe(2);
	});

	test("converts non-rate-limit failures into LLMError", async () => {
		await expect(
			executeOpenAIRetryPolicy({
				providerName: "openai",
				maxRetries: 1,
				operation: async () => {
					const error = new Error("400 openai_error") as Error & {
						status?: number;
					};
					error.status = 400;
					throw error;
				},
			}),
		).rejects.toBeInstanceOf(LLMError);
	});

	test("throws RateLimitError after exhausting retries", async () => {
		await expect(
			executeOpenAIRetryPolicy({
				providerName: "openai",
				maxRetries: 0,
				operation: async () => {
					const error = new Error("rate limited") as Error & {
						status?: number;
						headers?: Record<string, string>;
					};
					error.status = 429;
					error.headers = { "retry-after": "0" };
					throw error;
				},
			}),
		).rejects.toBeInstanceOf(RateLimitError);
	});
});
