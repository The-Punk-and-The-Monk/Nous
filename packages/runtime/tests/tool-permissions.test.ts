import { describe, expect, test } from "bun:test";
import type { CapabilitySet } from "@nous/core";
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
});
