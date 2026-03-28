import type { Agent, CapabilitySet } from "@nous/core";
import { prefixedId } from "@nous/core";

/** Read-only analyst agent focused on code analysis */
export function createAnalystAgent(overrides: Partial<Agent> = {}): Agent {
	const capabilities: CapabilitySet = {
		"shell.exec": { allowlist: ["git", "wc", "head", "tail"] },
		"fs.read": { paths: ["."] },
		"fs.write": false,
		"browser.control": false,
		"network.http": false,
		spawn_subagent: false,
		"memory.write": true,
		escalate_to_human: true,
	};

	return {
		id: prefixedId("agent"),
		name: "Analyst Agent",
		role: "specialist",
		capabilities,
		memoryId: prefixedId("mem"),
		status: "idle",
		personality: {
			style: "analytical and precise",
			toolPreferences: ["file_read", "glob", "grep"],
			systemPrompt:
				"You are a code analyst agent. Read and analyze code, provide summaries, identify patterns, and report findings. You do not modify files.",
		},
		...overrides,
	};
}
