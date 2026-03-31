import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";
import { assertNotAborted, runSpawnCommand } from "./command.ts";

export const gitDiffDef: ToolDef = {
	name: "git_diff",
	description:
		"Show a Git diff for the current repository or a specific path.",
	inputSchema: {
		type: "object",
		properties: {
			cwd: {
				type: "string",
				description: "Repository working directory. Defaults to the current directory.",
			},
			path: {
				type: "string",
				description: "Optional file or directory path to scope the diff.",
			},
			staged: {
				type: "boolean",
				description: "When true, show the staged diff (`--cached`).",
			},
			baseRef: {
				type: "string",
				description: "Optional Git ref to diff against before applying path filters.",
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

export const gitDiffHandler: ToolHandler = async (input, context) => {
	assertNotAborted(context, "git_diff");
	const cwd = (input.cwd as string | undefined) ?? process.cwd();
	const command = [
		"git",
		"-C",
		cwd,
		"diff",
		"--no-ext-diff",
		"--stat",
		"--patch",
		"--unified=3",
	];

	if (input.staged === true) {
		command.push("--cached");
	}
	if (typeof input.baseRef === "string" && input.baseRef.trim().length > 0) {
		command.push(input.baseRef.trim());
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
