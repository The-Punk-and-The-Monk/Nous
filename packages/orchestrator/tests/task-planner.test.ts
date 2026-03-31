import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	Intent,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { TaskPlanner } from "../src/planner/planner.ts";

describe("TaskPlanner", () => {
	test("requests structured output and builds a task graph", async () => {
		const provider = new MockProvider(
			'{"tasks":[{"id":1,"description":"Read README.md","dependsOn":[],"capabilitiesRequired":["fs.read"]},{"id":2,"description":"Write summary","dependsOn":[1],"capabilitiesRequired":["memory.write"]}]}',
		);
		const planner = new TaskPlanner(provider);

		const intent: Intent = {
			id: "int_demo",
			raw: "Read README and summarize it",
			goal: {
				summary: "Summarize README",
				successCriteria: ["3 bullet points"],
			},
			constraints: [],
			priority: 1,
			humanCheckpoints: "always",
			status: "active",
			source: "human",
			createdAt: new Date().toISOString(),
		};

		const tasks = await planner.plan(intent);

		expect(tasks).toHaveLength(2);
		expect(tasks[0]?.description).toBe("Read README.md");
		expect(tasks[1]?.dependsOn).toHaveLength(1);
		expect(provider.lastRequest?.responseFormat).toEqual({
			type: "json_schema",
			name: "task_plan",
			schema: expect.any(Object),
			strict: true,
		});
	});

	test("collapses to a single task when planning depth is none", async () => {
		const provider = new MockProvider('{"tasks":[]}');
		const planner = new TaskPlanner(provider);

		const intent: Intent = {
			id: "int_demo",
			raw: "Check git status",
			goal: {
				summary: "Check current git status",
				successCriteria: ["Report changed files"],
			},
			constraints: [],
			priority: 1,
			humanCheckpoints: "always",
			status: "active",
			source: "human",
			createdAt: new Date().toISOString(),
		};

		const tasks = await planner.plan(intent, {
			contract: {
				summary: "Check current git status and summarize findings",
				successCriteria: ["Report changed files"],
				boundaries: ["Do not modify files"],
				interruptionPolicy: "minimal",
				deliveryMode: "concise",
			},
			executionDepth: {
				planningDepth: "none",
				timeDepth: "foreground",
				organizationDepth: "single_agent",
				initiativeMode: "reactive",
				rationale: "Obvious bounded read-only request.",
			},
		});

		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.description).toContain("git status");
		expect(provider.lastRequest).toBeUndefined();
	});

	test("drops invented abstract capability labels that cannot be routed", async () => {
		const provider = new MockProvider(
			'{"tasks":[{"id":1,"description":"Explain the workflow","dependsOn":[],"capabilitiesRequired":["conversation design","planning","fs.read"]}]}',
		);
		const planner = new TaskPlanner(provider);

		const intent: Intent = {
			id: "int_demo",
			raw: "Give me a workflow example",
			goal: {
				summary: "Give a workflow example",
				successCriteria: ["Explain clearly"],
			},
			constraints: [],
			priority: 1,
			humanCheckpoints: "always",
			status: "active",
			source: "human",
			createdAt: new Date().toISOString(),
		};

		const tasks = await planner.plan(intent);

		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.capabilitiesRequired).toEqual(["fs.read"]);
	});
});

class MockProvider implements LLMProvider {
	readonly name = "mock";
	lastRequest?: LLMRequest;

	constructor(private readonly text: string) {}

	getCapabilities(): LLMProviderCapabilities {
		return {
			structuredOutputModes: ["json_schema"],
		};
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		this.lastRequest = request;
		return {
			id: "mock",
			content: [{ type: "text", text: this.text }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
