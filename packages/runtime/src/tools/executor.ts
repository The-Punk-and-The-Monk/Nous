import type { CapabilitySet, ToolDef, ToolResult } from "@nous/core";
import { prefixedId } from "@nous/core";
import {
	assertCapabilities,
	assertPathAccess,
	assertShellCommandAccess,
} from "./capability-guard.ts";

export type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

export class ToolExecutor {
	private handlers = new Map<string, ToolHandler>();

	registerHandler(toolName: string, handler: ToolHandler): void {
		this.handlers.set(toolName, handler);
	}

	async execute(
		tool: ToolDef,
		input: Record<string, unknown>,
		capabilities: CapabilitySet,
	): Promise<ToolResult> {
		const handler = this.handlers.get(tool.name);
		if (!handler) {
			return {
				id: prefixedId("tr"),
				toolName: tool.name,
				success: false,
				output: `No handler registered for tool: ${tool.name}`,
				durationMs: 0,
			};
		}

		const start = Date.now();
		const timeoutMs = tool.timeoutMs ?? 30000;

		try {
			// Check capabilities
			assertCapabilities(tool, capabilities);
			assertToolInputAccess(tool, input, capabilities);

			const output = await Promise.race([
				handler(input),
				timeout(timeoutMs, tool.name),
			]);

			return {
				id: prefixedId("tr"),
				toolName: tool.name,
				success: true,
				output,
				durationMs: Date.now() - start,
			};
		} catch (err) {
			return {
				id: prefixedId("tr"),
				toolName: tool.name,
				success: false,
				output: (err as Error).message,
				durationMs: Date.now() - start,
			};
		}
	}
}

function assertToolInputAccess(
	tool: ToolDef,
	input: Record<string, unknown>,
	capabilities: CapabilitySet,
): void {
	switch (tool.name) {
		case "shell":
			assertShellCommandAccess(capabilities, String(input.command ?? ""));
			return;
		case "file_read":
			assertPathAccess(capabilities, "fs.read", String(input.path ?? ""));
			return;
		case "file_write":
			assertPathAccess(capabilities, "fs.write", String(input.path ?? ""));
			return;
		case "glob":
			assertPathAccess(
				capabilities,
				"fs.read",
				String(input.cwd ?? process.cwd()),
			);
			return;
		case "grep":
			assertPathAccess(
				capabilities,
				"fs.read",
				String(input.path ?? process.cwd()),
			);
			return;
		default:
			return;
	}
}

function timeout(ms: number, toolName: string): Promise<never> {
	return new Promise((_, reject) =>
		setTimeout(
			() => reject(new Error(`Tool '${toolName}' timed out after ${ms}ms`)),
			ms,
		),
	);
}
