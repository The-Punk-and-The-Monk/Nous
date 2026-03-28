import { describe, expect, test } from "bun:test";
import type { LLMMessage } from "@nous/core";
import { ContextManager } from "../src/agent/context.ts";

describe("ContextManager", () => {
	test("estimateTokens provides rough estimate", () => {
		const ctx = new ContextManager();
		const messages: LLMMessage[] = [
			{ role: "user", content: "Hello world" }, // ~11 chars = ~3 tokens
		];
		const tokens = ctx.estimateTokens(messages);
		expect(tokens).toBeGreaterThan(0);
		expect(tokens).toBeLessThan(10);
	});

	test("needsCompaction returns false initially", () => {
		const ctx = new ContextManager(100000, 0.75);
		expect(ctx.needsCompaction()).toBe(false);
	});

	test("needsCompaction returns true after high usage", () => {
		const ctx = new ContextManager(100000, 0.75);
		ctx.updateUsage(80000, 5000);
		expect(ctx.needsCompaction()).toBe(true);
	});

	test("compact preserves first and last messages", () => {
		const ctx = new ContextManager();
		const messages: LLMMessage[] = [
			{ role: "user", content: "First message" },
			{ role: "assistant", content: "Response 1" },
			{ role: "user", content: "Tool result 1" },
			{ role: "assistant", content: "Response 2" },
			{ role: "user", content: "Tool result 2" },
			{ role: "assistant", content: "Response 3" },
			{ role: "user", content: "Tool result 3" },
			{ role: "assistant", content: "Last response" },
		];

		const compacted = ctx.compact(messages);
		// Should keep first + summary + last 4
		expect(compacted.length).toBeLessThan(messages.length);
		expect(compacted[0].content).toBe("First message");
		expect(compacted[compacted.length - 1].content).toBe("Last response");
	});

	test("compact does nothing for 4 or fewer messages", () => {
		const ctx = new ContextManager();
		const messages: LLMMessage[] = [
			{ role: "user", content: "Hi" },
			{ role: "assistant", content: "Hello" },
		];
		const compacted = ctx.compact(messages);
		expect(compacted).toEqual(messages);
	});
});
