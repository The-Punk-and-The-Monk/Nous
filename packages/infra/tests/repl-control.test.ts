import { describe, expect, test } from "bun:test";
import {
	resolveSlashCommand,
	shouldAttemptModelControlResolution,
	translateControlResolution,
} from "../src/cli/repl-control.ts";

describe("REPL control local layer", () => {
	test("resolves slash discovery commands deterministically", () => {
		const resolution = resolveSlashCommand("/commands network");

		expect(resolution).toEqual({
			kind: "execute",
			action: "show_commands",
			query: "network",
			interpretedAs: "/commands network",
		});
	});

	test("requires a thread id for slash attach", () => {
		const resolution = resolveSlashCommand("/attach");

		expect(resolution?.kind).toBe("clarify");
		if (!resolution || resolution.kind !== "clarify") {
			throw new Error("expected clarify resolution");
		}
		expect(resolution.message).toContain("/attach thread_abc123");
	});

	test("translates model control discovery results into local actions", () => {
		const resolved = translateControlResolution("你现在能做什么", {
			resolution: {
				kind: "invoke_operation",
				operationId: "control.discover",
				confidence: "high",
				rationale: "The user is asking about available controls.",
			},
		});

		expect(resolved).toEqual({
			kind: "execute",
			action: "show_commands",
			query: undefined,
			interpretedAs: "/commands",
			source: "model",
		});
	});

	test("falls back to task-plane submission when the model says so", () => {
		const resolved = translateControlResolution("帮我总结 README", {
			resolution: {
				kind: "task_plane",
				confidence: "high",
				rationale: "The user is asking for normal work on repository content.",
			},
		});

		expect(resolved).toEqual({
			kind: "submit",
			text: "帮我总结 README",
		});
	});

	test("keeps obvious repository work off the control-routing path", () => {
		expect(
			shouldAttemptModelControlResolution("用一句话总结一下 README.md"),
		).toBe(false);
		expect(
			shouldAttemptModelControlResolution("Inspect src/app.ts and explain it"),
		).toBe(false);
	});

	test("still detects likely natural-language control requests", () => {
		expect(shouldAttemptModelControlResolution("show daemon status")).toBe(
			true,
		);
		expect(shouldAttemptModelControlResolution("你现在能做什么")).toBe(true);
	});
});
