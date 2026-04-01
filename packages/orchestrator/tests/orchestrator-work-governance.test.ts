import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { createPersistenceBackend } from "@nous/persistence";
import { Orchestrator } from "../src/orchestrator.ts";

describe("Orchestrator work-governance integration", () => {
	test("creates a flow and plan graph when planning an intent", async () => {
		const provider = new ScriptedProvider([
			'{"goal":{"summary":"Inspect auth changes","successCriteria":["Identify impacted files"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect auth changes and summarize findings","successCriteria":["Identify impacted files"],"boundaries":["Do not modify files"],"interruptionPolicy":"minimal","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"light","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Short bounded investigation."},"clarificationQuestions":[]}',
			'{"tasks":[{"id":1,"description":"Inspect auth changes and summarize findings","dependsOn":[],"capabilitiesRequired":[]},{"id":2,"description":"Check git history for auth files","dependsOn":[],"capabilitiesRequired":["shell.exec"]}]}',
		]);
		const backend = createPersistenceBackend();
		const orchestrator = new Orchestrator({
			llm: provider,
			eventStore: backend.events,
			taskStore: backend.tasks,
			intentStore: backend.intents,
			workStore: backend.work,
		});

		const intent = await orchestrator.submitIntentBackground(
			"Inspect auth changes and summarize findings",
		);

		const storedIntent = backend.intents.getById(intent.id);
		expect(storedIntent?.flowId).toBeDefined();
		expect(storedIntent?.planGraphId).toBeDefined();

		const flow = storedIntent?.flowId
			? backend.work.getFlowById(storedIntent.flowId)
			: undefined;
		expect(flow?.primaryIntentId).toBe(intent.id);
		expect(flow?.relatedIntentIds).toEqual([intent.id]);

		const planGraph = storedIntent?.planGraphId
			? backend.work.getPlanGraphById(storedIntent.planGraphId)
			: undefined;
		expect(planGraph?.intentId).toBe(intent.id);
		expect(planGraph?.planningDepth).toBe("light");
		expect(planGraph?.topology).toBe("parallel");

		const tasks = backend.tasks.getByIntent(intent.id);
		expect(tasks).toHaveLength(2);
		for (const task of tasks) {
			expect(task.flowId).toBe(flow?.id);
			expect(task.planGraphId).toBe(planGraph?.id);
			expect(task.cognitiveOperation).toBe("execution_main");
		}

		backend.close();
	});
});

class ScriptedProvider implements LLMProvider {
	readonly name = "scripted";
	private index = 0;

	constructor(private readonly outputs: string[]) {}

	getCapabilities(): LLMProviderCapabilities {
		return { structuredOutputModes: ["json_schema"] };
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		const text = this.outputs[this.index++];
		if (!text) {
			throw new Error("No scripted provider output remaining");
		}
		return {
			id: `mock_${this.index}`,
			content: [{ type: "text", text }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
