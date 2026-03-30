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

describe("Orchestrator clarification resume", () => {
	test("reuses the original intent after clarification and resumes planning", async () => {
		const provider = new ScriptedProvider([
			'{"goal":{"summary":"Inspect auth changes","successCriteria":["Identify what is broken"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect auth-related changes and report findings","successCriteria":["Identify what is broken"],"boundaries":["Do not modify files until clarified"],"interruptionPolicy":"interactive","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"light","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Need branch clarification before investigation."},"clarificationQuestions":["Which branch or commit should I inspect?"]}',
			'{"goal":{"summary":"Inspect auth changes on feature/auth-refresh","successCriteria":["Identify what is broken in auth flow"]},"constraints":[],"priority":1,"humanCheckpoints":"always","contract":{"summary":"Inspect auth-related changes on feature/auth-refresh and report findings","successCriteria":["Identify what is broken in auth flow"],"boundaries":["Do not modify files"],"interruptionPolicy":"minimal","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"light","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Clarification resolved; bounded investigation can proceed."},"clarificationQuestions":[]}',
			'{"tasks":[{"id":1,"description":"Inspect auth changes on feature/auth-refresh and report findings","dependsOn":[],"capabilitiesRequired":[]}]}',
		]);
		const backend = createPersistenceBackend();
		const orchestrator = new Orchestrator({
			llm: provider,
			eventStore: backend.events,
			taskStore: backend.tasks,
			intentStore: backend.intents,
		});

		const initial = await orchestrator.submitIntentBackground(
			"Inspect the auth changes and tell me what broke",
		);
		expect(initial.id).toBeDefined();
		expect(initial.status).toBe("awaiting_clarification");
		expect(backend.tasks.getByIntent(initial.id)).toHaveLength(0);

		const resumed = await orchestrator.respondToClarification(
			initial.id,
			"Look at feature/auth-refresh and keep it read-only.",
		);
		expect(resumed.id).toBe(initial.id);
		expect(resumed.status).toBe("active");
		expect(resumed.clarificationQuestions).toEqual([]);
		expect(resumed.workingText).toContain("User clarification response");
		expect(backend.tasks.getByIntent(initial.id)).toHaveLength(1);
		expect(backend.intents.getById(initial.id)?.contract?.summary).toContain(
			"feature/auth-refresh",
		);

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
