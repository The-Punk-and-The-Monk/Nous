import type { CapabilitySet, ToolDef, ToolResult } from "@nous/core";
import { prefixedId } from "@nous/core";
import { assertCapabilities } from "./capability-guard.ts";

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
		// Check capabilities
		assertCapabilities(tool, capabilities);

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

function timeout(ms: number, toolName: string): Promise<never> {
	return new Promise((_, reject) =>
		setTimeout(
			() => reject(new Error(`Tool '${toolName}' timed out after ${ms}ms`)),
			ms,
		),
	);
}
