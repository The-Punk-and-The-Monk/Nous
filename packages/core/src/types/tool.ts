import type { CapabilityName } from "./capability.ts";

export interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	requiredCapabilities: CapabilityName[];
	timeoutMs: number;
}

export interface ToolResult {
	id: string;
	toolName: string;
	success: boolean;
	output: string;
	durationMs: number;
}
