import { describe, expect, test } from "bun:test";
import type { CapabilitySet, ToolDef } from "@nous/core";
import {
	fileReadDef,
	fileReadHandler,
} from "../src/tools/builtin/file-read.ts";
import { shellDef, shellHandler } from "../src/tools/builtin/shell.ts";
import { ToolExecutor } from "../src/tools/executor.ts";

const capabilities: CapabilitySet = {
	"shell.exec": { allowlist: ["ls"] },
	"fs.read": { paths: ["/tmp"] },
	"fs.write": false,
	"browser.control": false,
	"network.http": false,
	spawn_subagent: false,
	"memory.write": false,
	escalate_to_human: true,
};

describe("ToolExecutor permission enforcement", () => {
	test("blocks shell commands outside the permission allowlist", async () => {
		const executor = new ToolExecutor();
		executor.registerHandler(shellDef.name, shellHandler);

		const result = await executor.execute(
			shellDef,
			{ command: "git status" },
			capabilities,
		);

		expect(result.success).toBe(false);
		expect(result.output).toContain("shell.exec");
	});

	test("blocks file reads outside the allowed path set", async () => {
		const executor = new ToolExecutor();
		executor.registerHandler(fileReadDef.name, fileReadHandler);

		const result = await executor.execute(
			fileReadDef,
			{ path: "/Users/demo/private.txt" },
			capabilities,
		);

		expect(result.success).toBe(false);
		expect(result.output).toContain("fs.read");
	});

	test("enforces input-driven shell command allowlists for structured tools", async () => {
		const executor = new ToolExecutor();
		const dynamicShellTool: ToolDef = {
			name: "dynamic_shell_tool",
			description: "Test helper for input-driven shell command permissions.",
			inputSchema: {
				type: "object",
				properties: {
					runner: { type: "string" },
				},
				required: ["runner"],
			},
			requiredCapabilities: ["shell.exec"],
			shellCommandInputKey: "runner",
			shellCommandAllowlist: ["npm", "bun"],
			timeoutMs: 1_000,
			sideEffectClass: "read_only",
			idempotency: "idempotent",
			interruptibility: "cooperative",
			approvalMode: "auto",
			rollbackPolicy: "none",
		};

		executor.registerHandler(dynamicShellTool.name, async () => "ok");

		const unsupported = await executor.execute(
			dynamicShellTool,
			{ runner: "git" },
			capabilities,
		);
		expect(unsupported.success).toBe(false);
		expect(unsupported.output).toContain("unsupported shell command");

		const denied = await executor.execute(
			dynamicShellTool,
			{ runner: "npm" },
			capabilities,
		);
		expect(denied.success).toBe(false);
		expect(denied.output).toContain("shell.exec");
	});
});
