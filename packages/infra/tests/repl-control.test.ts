import { describe, expect, test } from "bun:test";
import { resolveReplControlInput } from "../src/cli/repl-control.ts";

describe("REPL control router", () => {
	test("maps slash discovery commands into the control plane", () => {
		const resolution = resolveReplControlInput("/commands network", {
			daemonRunning: true,
		});

		expect(resolution.kind).toBe("execute");
		if (resolution.kind !== "execute") {
			throw new Error("expected execute resolution");
		}
		expect(resolution.action).toBe("show_commands");
		expect(resolution.query).toBe("network");
		expect(resolution.source).toBe("slash");
	});

	test("maps natural-language capability discovery into the control plane", () => {
		const resolution = resolveReplControlInput("你现在能做什么", {
			daemonRunning: true,
		});

		expect(resolution.kind).toBe("execute");
		if (resolution.kind !== "execute") {
			throw new Error("expected execute resolution");
		}
		expect(resolution.action).toBe("show_commands");
		expect(resolution.source).toBe("natural_language");
		expect(resolution.interpretedAs).toBe("/commands");
	});

	test("maps explicit natural-language status requests into /status", () => {
		const resolution = resolveReplControlInput("show daemon status", {
			daemonRunning: true,
		});

		expect(resolution.kind).toBe("execute");
		if (resolution.kind !== "execute") {
			throw new Error("expected execute resolution");
		}
		expect(resolution.action).toBe("show_status");
		expect(resolution.interpretedAs).toBe("/status");
	});

	test("asks for clarification when a control mapping is plausible but not safe", () => {
		const resolution = resolveReplControlInput("看看状态", {
			daemonRunning: true,
		});

		expect(resolution.kind).toBe("clarify");
		if (resolution.kind !== "clarify") {
			throw new Error("expected clarify resolution");
		}
		expect(resolution.operationId).toBe("status.overview");
	});

	test("maps thread attachment requests when a concrete thread id is present", () => {
		const resolution = resolveReplControlInput("attach to thread_abc123", {
			daemonRunning: true,
		});

		expect(resolution.kind).toBe("execute");
		if (resolution.kind !== "execute") {
			throw new Error("expected execute resolution");
		}
		expect(resolution.action).toBe("attach_thread");
		expect(resolution.threadId).toBe("thread_abc123");
	});

	test("leaves ordinary task text in the task plane", () => {
		const resolution = resolveReplControlInput("帮我总结一下 README.md", {
			daemonRunning: true,
		});

		expect(resolution).toEqual({
			kind: "submit",
			text: "帮我总结一下 README.md",
		});
	});
});
