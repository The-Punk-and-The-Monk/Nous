import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";
import { assertNotAborted, runSpawnCommand } from "./command.ts";

export const gitLogDef: ToolDef = {
	name: "git_log",
	description:
		"Inspect recent Git commit history for the current repository or a specific path.",
	inputSchema: {
		type: "object",
		properties: {
			cwd: {
				type: "string",
				description: "Repository working directory. Defaults to the current directory.",
			},
			ref: {
				type: "string",
				description: "Optional Git ref or range to inspect before any path filter.",
			},
			path: {
				type: "string",
				description: "Optional file or directory path to scope the history.",
			},
			maxCount: {
				type: "number",
				description: "Maximum number of commits to return. Defaults to 20.",
			},
			stat: {
				type: "boolean",
				description: "Include file-level change stats for each commit. Defaults to false.",
			},
			maxBytes: {
				type: "number",
				description: "Maximum UTF-8 bytes returned before truncation. Defaults to 16000.",
			},
		},
	},
	requiredCapabilities: ["shell.exec"],
	invokesShellCommands: ["git"],
	timeoutMs: 20_000,
	sideEffectClass: "read_only",
	idempotency: "idempotent",
	interruptibility: "cooperative",
	approvalMode: "auto",
	rollbackPolicy: "none",
};

export const gitLogHandler: ToolHandler = async (input, context) => {
	assertNotAborted(context, "git_log");
	const cwd = (input.cwd as string | undefined) ?? process.cwd();
	const maxCount =
		typeof input.maxCount === "number" && Number.isFinite(input.maxCount)
			? Math.max(1, Math.floor(input.maxCount))
			: 20;
	const command = [
		"git",
		"-C",
		cwd,
		"log",
		`--max-count=${maxCount}`,
		"--date=short",
		"--pretty=format:%h %ad %an %s",
	];

	if (input.stat === true) {
		command.push("--stat");
	}
	if (typeof input.ref === "string" && input.ref.trim().length > 0) {
		command.push(input.ref.trim());
	}
	if (typeof input.path === "string" && input.path.trim().length > 0) {
		command.push("--", input.path.trim());
	}

	return runSpawnCommand({
		command,
		cwd,
		signal: context.signal,
		maxOutputBytes:
			typeof input.maxBytes === "number" && Number.isFinite(input.maxBytes)
				? Math.max(512, Math.floor(input.maxBytes))
				: 16_000,
	});
};
