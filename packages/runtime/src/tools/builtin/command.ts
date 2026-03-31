import type { ToolExecutionContext } from "../executor.ts";

const DEFAULT_MAX_OUTPUT_BYTES = 16_000;

export interface SpawnCommandInput {
	command: string[];
	cwd?: string;
	signal: AbortSignal;
	maxOutputBytes?: number;
}

export async function runSpawnCommand(
	input: SpawnCommandInput,
): Promise<string> {
	const cwd = input.cwd ?? process.cwd();
	const proc = Bun.spawn(input.command, {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	if (input.signal.aborted) {
		proc.kill();
		throw new Error(`${input.command[0] ?? "command"} interrupted before completion`);
	}

	const abort = () => {
		try {
			proc.kill();
		} catch {
			// Process may already have exited.
		}
	};
	input.signal.addEventListener("abort", abort, { once: true });

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;
	input.signal.removeEventListener("abort", abort);

	return formatCommandOutput({
		command: input.command,
		stdout,
		stderr,
		exitCode,
		maxOutputBytes: input.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
	});
}

export function assertNotAborted(
	context: ToolExecutionContext,
	toolName: string,
): void {
	if (context.signal.aborted) {
		throw new Error(`${toolName} interrupted before start`);
	}
}

function formatCommandOutput(input: {
	command: string[];
	stdout: string;
	stderr: string;
	exitCode: number;
	maxOutputBytes: number;
}): string {
	let output = "";
	if (input.stdout.trim().length > 0) {
		output += input.stdout.trimEnd();
	}
	if (input.stderr.trim().length > 0) {
		output += `${output ? "\n\n" : ""}STDERR:\n${input.stderr.trimEnd()}`;
	}
	output += `${output ? "\n\n" : ""}[command: ${input.command.join(" ")}]`;
	output += `\n[exit code: ${input.exitCode}]`;

	if (Buffer.byteLength(output, "utf8") <= input.maxOutputBytes) {
		return output;
	}

	const truncated = truncateUtf8(output, input.maxOutputBytes - 64);
	return `${truncated}\n\n[truncated to ${input.maxOutputBytes} bytes]`;
}

function truncateUtf8(value: string, maxBytes: number): string {
	const buffer = Buffer.from(value, "utf8");
	if (buffer.length <= maxBytes) {
		return value;
	}
	return buffer.subarray(0, Math.max(0, maxBytes)).toString("utf8");
}
