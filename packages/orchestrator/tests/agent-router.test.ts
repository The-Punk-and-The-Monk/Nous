import { describe, expect, test } from "bun:test";
import type { Agent, Task } from "@nous/core";
import { AgentRouter } from "../src/router/router.ts";

describe("AgentRouter", () => {
	test("ignores non-runtime capability labels when routing", () => {
		const router = new AgentRouter();
		const agent = createAgent();
		router.register(agent);

		const task: Task = {
			id: "task_demo",
			intentId: "int_demo",
			dependsOn: [],
			description: "Explain the workflow",
			capabilitiesRequired: ["conversation design"],
			status: "queued",
			retries: 0,
			maxRetries: 3,
			backoffSeconds: 2,
			createdAt: new Date().toISOString(),
		};

		expect(router.findAgent(task)?.id).toBe(agent.id);
	});

	test("still enforces real runtime capability requirements", () => {
		const router = new AgentRouter();
		const agent = createAgent();
		router.register(agent);

		const task: Task = {
			id: "task_network",
			intentId: "int_demo",
			dependsOn: [],
			description: "Fetch a URL",
			capabilitiesRequired: ["conversation design", "network.http"],
			status: "queued",
			retries: 0,
			maxRetries: 3,
			backoffSeconds: 2,
			createdAt: new Date().toISOString(),
		};

		expect(router.findAgent(task)).toBeUndefined();
	});
});

function createAgent(): Agent {
	return {
		id: "agent_demo",
		name: "Demo Agent",
		role: "executor",
		capabilities: {
			"shell.exec": { allowlist: ["cat"] },
			"fs.read": { paths: ["."] },
			"fs.write": false,
			"browser.control": false,
			"network.http": false,
			spawn_subagent: false,
			"memory.write": true,
			escalate_to_human: true,
		},
		memoryId: "mem_demo",
		status: "idle",
		personality: {
			style: "direct",
			toolPreferences: [],
			systemPrompt: "You are a test agent.",
		},
	};
}
