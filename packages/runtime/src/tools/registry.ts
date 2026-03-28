import type { CapabilitySet, LLMToolDef, ToolDef } from "@nous/core";
import { hasCapability } from "@nous/core";

export class ToolRegistry {
	private tools = new Map<string, ToolDef>();

	register(tool: ToolDef): void {
		this.tools.set(tool.name, tool);
	}

	get(name: string): ToolDef | undefined {
		return this.tools.get(name);
	}

	/** Get tools that the agent has capabilities to use */
	getAvailable(capabilities: CapabilitySet): ToolDef[] {
		return [...this.tools.values()].filter((tool) =>
			tool.requiredCapabilities.every((cap) =>
				hasCapability(capabilities, cap),
			),
		);
	}

	/** Convert available tools to LLM tool definitions */
	toLLMTools(capabilities: CapabilitySet): LLMToolDef[] {
		return this.getAvailable(capabilities).map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		}));
	}

	list(): ToolDef[] {
		return [...this.tools.values()];
	}
}
