import type { CapabilitySet } from "./capability.ts";

export type AgentRole = "orchestrator" | "specialist" | "executor";
export type AgentStatus = "idle" | "working" | "suspended" | "offline";

export interface AgentPersonality {
	style: string;
	toolPreferences: string[];
	systemPrompt: string;
}

export interface Agent {
	id: string;
	name: string;
	role: AgentRole;
	capabilities: CapabilitySet;
	memoryId: string;
	currentTaskId?: string;
	status: AgentStatus;
	personality: AgentPersonality;
}
