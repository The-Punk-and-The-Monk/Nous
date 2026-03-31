import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";
import { assertNotAborted, runSpawnCommand } from "./command.ts";

export const gitStatusDef: ToolDef = {
	name: "git_status",
	description:
		"Inspect the current Git repository state, including branch and working tree changes.",
	inputSchema: {
		type: "object",
		properties: {
			cwd: {
				type: "string",
				description: "Repository working directory. Defaults to the current directory.",
			},
			porcelain: {
				type: "boolean",
				description: "Use concise porcelain output with branch summary. Defaults to true.",
			},
		},
	},
	requiredCapabilities: ["shell.exec"],
	invokesShellCommands: ["git"],
	timeoutMs: 15_000,
	sideEffectClass: "read_only",
	idempotency: "idempotent",
	interruptibility: "cooperative",
	approvalMode: "auto",
	rollbackPolicy: "none",
};

export const gitStatusHandler: ToolHandler = async (input, context) => {
	assertNotAborted(context, "git_status");
	const cwd = (input.cwd as string | undefined) ?? process.cwd();
	const porcelain = input.porcelain !== false;
	const command = porcelain
		? ["git", "-C", cwd, "status", "--short", "--branch"]
		: ["git", "-C", cwd, "status", "--branch"];

	return runSpawnCommand({
		command,
		cwd,
		signal: context.signal,
		maxOutputBytes: 12_000,
	});
};
