import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";

export const shellDef: ToolDef = {
	name: "shell",
	description:
		"Execute a shell command and return its output. Only allowed commands can be run.",
	inputSchema: {
		type: "object",
		properties: {
			command: { type: "string", description: "The shell command to execute" },
			cwd: { type: "string", description: "Working directory for the command" },
		},
		required: ["command"],
	},
	requiredCapabilities: ["shell.exec"],
	timeoutMs: 60000,
	sideEffectClass: "write",
	idempotency: "non_idempotent",
	interruptibility: "cooperative",
	approvalMode: "ask",
	rollbackPolicy: "manual",
	rollbackHint:
		"Shell commands may have already produced side effects before interruption. Review the environment and roll back manually if needed.",
};

export const shellHandler: ToolHandler = async (input, context) => {
	const command = input.command as string;
	const cwd = (input.cwd as string) ?? process.cwd();

	const proc = Bun.spawn(["sh", "-c", command], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	if (context.signal.aborted) {
		proc.kill();
		throw new Error("shell interrupted before completion");
	}

	const abort = () => {
		try {
			proc.kill();
		} catch {
			// Process may already have exited.
		}
	};
	context.signal.addEventListener("abort", abort, { once: true });

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	const exitCode = await proc.exited;
	context.signal.removeEventListener("abort", abort);

	let output = "";
	if (stdout) output += stdout;
	if (stderr) output += `${output ? "\n" : ""}STDERR: ${stderr}`;
	output += `\n[exit code: ${exitCode}]`;

	return {
		output: output.trim(),
		rollbackPlan: {
			kind: "manual",
			description: `Review and manually roll back any side effects from shell command "${command}" in ${cwd}.`,
		},
	};
};
