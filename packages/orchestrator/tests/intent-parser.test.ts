import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
} from "@nous/core";
import { IntentParser } from "../src/intent/parser.ts";

describe("IntentParser", () => {
	test("requests structured output and parses validated intent data", async () => {
		const provider = new MockProvider(
			'{"goal":{"summary":"Summarize README","successCriteria":["3 bullet points"]},"constraints":[],"priority":1}',
		);
		const parser = new IntentParser(provider);

		const intent = await parser.parse("Read README.md and summarize it");

		expect(intent.goal.summary).toBe("Summarize README");
		expect(intent.goal.successCriteria).toEqual(["3 bullet points"]);
		expect(provider.lastRequest?.responseFormat).toEqual({
			type: "json_schema",
			name: "intent_parse",
			schema: expect.any(Object),
			strict: true,
		});
	});

	test("analyzes task intake with contract and execution depth", async () => {
		const provider = new MockProvider(
			'{"goal":{"summary":"Check auth changes","successCriteria":["Identify impacted files"]},"constraints":[],"priority":1,"humanCheckpoints":"irreversible_only","contract":{"summary":"Investigate auth-related changes and report findings","successCriteria":["Identify impacted files"],"boundaries":["Do not modify files"],"interruptionPolicy":"minimal","deliveryMode":"structured_with_evidence"},"executionDepth":{"planningDepth":"light","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Short investigation task with bounded scope."},"clarificationQuestions":[]}',
		);
		const parser = new IntentParser(provider);

		const intake = await parser.analyze(
			"Inspect the auth changes and tell me what broke",
		);

		expect(intake.intent.humanCheckpoints).toBe("irreversible_only");
		expect(intake.intent.contract?.summary).toContain(
			"Investigate auth-related changes",
		);
		expect(intake.intent.executionDepth?.planningDepth).toBe("light");
		expect(intake.intent.clarificationQuestions).toEqual([]);
		expect(intake.contract.summary).toContain(
			"Investigate auth-related changes",
		);
		expect(intake.executionDepth.planningDepth).toBe("light");
		expect(provider.lastRequest?.responseFormat).toEqual({
			type: "json_schema",
			name: "task_intake",
			schema: expect.any(Object),
			strict: true,
		});
	});

	test("includes user-state grounding in intake analysis input", async () => {
		const provider = new MockProvider(
			'{"goal":{"summary":"Check git status","successCriteria":["Report changed files"]},"constraints":[],"priority":1,"humanCheckpoints":"never","contract":{"summary":"Inspect the current git status and summarize changes","successCriteria":["Report changed files"],"boundaries":["Do not modify files"],"interruptionPolicy":"minimal","deliveryMode":"concise"},"executionDepth":{"planningDepth":"none","timeDepth":"foreground","organizationDepth":"single_agent","initiativeMode":"reactive","rationale":"Bounded read-only request."},"clarificationQuestions":[]}',
		);
		const parser = new IntentParser(provider);

		const intake = await parser.analyze("Check git status", {
			grounding: {
				summary:
					"project=/repo; type=typescript-monorepo; git=dirty; focusedFile=README.md",
				activeIntentSummaries: ["Refactor orchestrator (active)"],
				recentMemoryHints: [
					"[semantic score=0.88] The repo uses Bun workspaces.",
				],
				channelContext: {
					workingDirectory: "/repo",
					projectRoot: "/repo",
					focusedFile: "README.md",
				},
				recentThreadMessages: ["user: please keep this read-only"],
			},
		});

		expect(intake.groundingSummary).toContain("project=/repo");
		const requestMessage = provider.lastRequest?.messages[0];
		expect(requestMessage?.content).toContain("Grounding");
		expect(requestMessage?.content).toContain("Refactor orchestrator (active)");
		expect(requestMessage?.content).toContain(
			"user: please keep this read-only",
		);
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
