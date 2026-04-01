import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";
import { assertNotAborted, runSpawnCommand } from "./command.ts";

const TEST_RUNNER_COMMANDS = [
	"bun",
	"npm",
	"pnpm",
	"yarn",
	"node",
	"python3",
	"uv",
	"cargo",
	"go",
] as const;

type TestRunnerCommand = (typeof TEST_RUNNER_COMMANDS)[number];

export const testRunnerDef: ToolDef = {
	name: "test_runner",
	description:
		"Run a bounded project test command using an explicit runner such as bun, npm, cargo, go, or pytest via python3/uv.",
	inputSchema: {
		type: "object",
		properties: {
			cwd: {
				type: "string",
				description: "Working directory for the test run. Defaults to the current directory.",
			},
			runner: {
				type: "string",
				enum: [...TEST_RUNNER_COMMANDS],
				description:
					"Explicit test runner selection. This keeps execution governed while still supporting common project types.",
			},
			args: {
				type: "array",
				items: { type: "string" },
				description:
					"Optional extra arguments forwarded to the selected test runner.",
			},
			maxBytes: {
				type: "number",
				description: "Maximum UTF-8 bytes returned before truncation. Defaults to 20000.",
			},
		},
		required: ["runner"],
	},
	requiredCapabilities: ["shell.exec"],
	shellCommandInputKey: "runner",
	shellCommandAllowlist: [...TEST_RUNNER_COMMANDS],
	timeoutMs: 180_000,
	sideEffectClass: "write",
	idempotency: "best_effort",
	interruptibility: "cooperative",
	approvalMode: "ask",
	rollbackPolicy: "manual",
	rollbackHint:
		"Test runs may write caches, snapshots, coverage files, or other temporary artifacts. Review the workspace if rollback is needed.",
};

export const testRunnerHandler: ToolHandler = async (input, context) => {
	assertNotAborted(context, "test_runner");
	const cwd = (input.cwd as string | undefined) ?? process.cwd();
	const runner = readRunner(input.runner);
	const args = readArgs(input.args);

	return runSpawnCommand({
		command: buildTestCommand(runner, args),
		cwd,
		signal: context.signal,
		maxOutputBytes:
			typeof input.maxBytes === "number" && Number.isFinite(input.maxBytes)
				? Math.max(512, Math.floor(input.maxBytes))
				: 20_000,
	});
};

function readRunner(value: unknown): TestRunnerCommand {
	if (typeof value !== "string") {
		throw new Error("test_runner requires a string 'runner' field");
	}
	if (TEST_RUNNER_COMMANDS.includes(value as TestRunnerCommand)) {
		return value as TestRunnerCommand;
	}
	throw new Error(
		`Unsupported test runner '${value}'. Allowed: ${TEST_RUNNER_COMMANDS.join(", ")}`,
	);
}

function readArgs(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean);
}

function buildTestCommand(
	runner: TestRunnerCommand,
	args: string[],
): string[] {
	switch (runner) {
		case "bun":
			return ["bun", "test", ...args];
		case "npm":
			return ["npm", "test", ...(args.length > 0 ? ["--", ...args] : [])];
		case "pnpm":
			return ["pnpm", "test", ...args];
		case "yarn":
			return ["yarn", "test", ...args];
		case "node":
			return ["node", "--test", ...args];
		case "python3":
			return ["python3", "-m", "pytest", ...args];
		case "uv":
			return ["uv", "run", "pytest", ...args];
		case "cargo":
			return ["cargo", "test", ...args];
		case "go":
			return ["go", "test", ...(args.length > 0 ? args : ["./..."])];
	}
}
