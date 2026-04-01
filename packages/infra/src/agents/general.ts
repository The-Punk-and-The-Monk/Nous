import type { Agent, CapabilitySet } from "@nous/core";
import { prefixedId } from "@nous/core";

/** Default general-purpose agent with broad capabilities */
export function createGeneralAgent(overrides: Partial<Agent> = {}): Agent {
	const capabilities: CapabilitySet = {
		"shell.exec": {
			allowlist: [
				"ls",
				"cat",
				"echo",
				"grep",
				"find",
				"wc",
				"head",
				"tail",
				"sort",
				"uniq",
				"git",
				"bun",
				"node",
				"npm",
			],
		},
		"fs.read": { paths: ["."] },
		"fs.write": { paths: ["."] },
		"browser.control": false,
		"network.http": false,
		spawn_subagent: false,
		"memory.write": true,
		escalate_to_human: true,
	};

	return {
		id: prefixedId("agent"),
		name: "General Agent",
		role: "executor",
		capabilities,
		memoryId: prefixedId("mem"),
		status: "idle",
		personality: {
			style: "methodical and thorough",
			toolPreferences: [
				"git_status",
				"git_diff",
				"git_log",
				"test_runner",
				"memory_search",
				"file_read",
				"glob",
				"grep",
			],
			systemPrompt:
				"You are a capable general-purpose agent. Break down tasks, use tools to gather information and make changes, and report results clearly.",
		},
		...overrides,
	};
}
