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
};

export const shellHandler: ToolHandler = async (input) => {
	const command = input.command as string;
	const cwd = (input.cwd as string) ?? process.cwd();

	const proc = Bun.spawn(["sh", "-c", command], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	const exitCode = await proc.exited;

	let output = "";
	if (stdout) output += stdout;
	if (stderr) output += `${output ? "\n" : ""}STDERR: ${stderr}`;
	output += `\n[exit code: ${exitCode}]`;

	return output.trim();
};
