import { describe, expect, test } from "bun:test";
import type {
	ContentBlock,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	RelationshipBoundary,
	StreamChunk,
} from "@nous/core";
import { SQLiteMemoryStore, initDatabase } from "@nous/persistence";
import { MemoryService } from "../src/memory/service.ts";
import {
	ReflectionService,
	createDefaultRelationshipBoundary,
} from "../src/proactive/reflection.ts";

describe("ReflectionService", () => {
	test("reflects a promoted signal into a proactive candidate using retrieved memory", async () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const memory = new MemoryService({ store, agentId: "nous" });
		memory.ingestIntentOutcome({
			intentId: "int_auth",
			intentText: "Inspect auth changes",
			outcome: "intent.achieved",
			threadId: "thread_auth",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
				focusedFile: "package.json",
			},
			outputs: [
				"Auth-related package.json changes often justify install and test checks.",
			],
		});

		const llm = new MockProvider(
			{
				emit: true,
				kind: "ambient_intent",
				summary: "Dependency change likely needs follow-up validation",
				messageDraft:
					"Looks like package metadata changed. I can inspect which install/build/test checks are worth running.",
				rationale:
					"Past memory suggests dependency changes often need follow-up validation, and this looks timely.",
				proposedIntentText:
					"Inspect the dependency change in package.json and report which install, build, or test follow-up checks are advisable. Do not modify files.",
				confidence: 0.84,
				valueScore: 0.8,
				interruptionCost: 0.25,
				urgency: "normal",
				recommendedMode: "auto_execute",
				requiresApproval: false,
			},
			(request) => {
				expect(request.messages[0]?.content).toContain("Retrieved memories");
				expect(request.messages[0]?.content).toContain(
					"package.json changes often justify install and test checks",
				);
				expect(request.temperature).toBe(0);
			},
		);
		const service = new ReflectionService({ llm, memory });

		const outcome = await service.reflectSignal({
			signalId: "sig_1",
			signalType: "fs.file_changed",
			summary:
				"Ambient notice: dependency or package metadata file package.json changed in /repo/app. Consider install/build/test follow-up checks.",
			confidence: 0.78,
			threadId: "thread_ambient",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
				focusedFile: "package.json",
			},
			suggestedIntentText:
				"Inspect the recent dependency/configuration change to package.json in /repo/app and report which install, build, or test follow-up checks are advisable. Do not modify files.",
			sourceMemoryIds: [],
			relationshipBoundary: createDefaultRelationshipBoundary({
				autonomyPolicy: {
					allowOffersWithoutPrompt: true,
					allowAmbientAutoExecution: true,
				},
			}),
		});

		expect(outcome.agendaItem.category).toBe("environment_change");
		expect(outcome.retrievedMemories.length).toBeGreaterThan(0);
		expect(outcome.candidate?.kind).toBe("ambient_intent");
		expect(outcome.candidate?.recommendedMode).toBe("ask_first");
		expect(outcome.candidate?.proposedIntentText).toContain(
			"dependency change",
		);
		expect(outcome.run.outcome).toBe("candidate_emitted");
	});

	test("suppresses candidates blocked by relationship boundary", async () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const memory = new MemoryService({ store, agentId: "nous" });
		const llm = new MockProvider({
			emit: true,
			kind: "protective_intervention",
			summary: "Step in now",
			messageDraft: "I should step in now.",
			rationale: "This seemed urgent.",
			confidence: 0.9,
			valueScore: 0.8,
			interruptionCost: 0.7,
			urgency: "high",
			recommendedMode: "ask_first",
			requiresApproval: true,
		});
		const service = new ReflectionService({ llm, memory });
		const boundary: RelationshipBoundary = {
			assistantStyle: {
				warmth: "balanced",
				directness: "balanced",
			},
			proactivityPolicy: {
				initiativeLevel: "minimal",
				allowedKinds: ["suggestion", "silent_watchpoint"],
				blockedKinds: ["protective_intervention"],
				requireApprovalForKinds: ["ambient_intent"],
			},
			interruptionPolicy: {
				maxUnpromptedMessagesPerDay: 2,
				preferredDelivery: "thread",
			},
			autonomyPolicy: {
				allowOffersWithoutPrompt: false,
				allowAmbientAutoExecution: false,
			},
		};

		const outcome = await service.reflectSignal({
			signalId: "sig_2",
			signalType: "git.status_changed",
			summary:
				"Ambient notice: workspace git status changed from clean to dirty in /repo/app.",
			confidence: 0.8,
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
			relationshipBoundary: boundary,
		});

		expect(outcome.candidate).toBeUndefined();
		expect(outcome.run.outcome).toBe("no_action");
	});

	test("suppresses low-value offers when initiative level is minimal", async () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const memory = new MemoryService({ store, agentId: "nous" });
		const llm = new MockProvider({
			emit: true,
			kind: "offer",
			summary: "Offer a friendly nudge",
			messageDraft: "I can gently remind you about this.",
			rationale: "A low-stakes nudge might help.",
			confidence: 0.72,
			valueScore: 0.58,
			interruptionCost: 0.22,
			urgency: "low",
			recommendedMode: "async_notify",
			requiresApproval: false,
		});
		const service = new ReflectionService({ llm, memory });
		const boundary: RelationshipBoundary = {
			assistantStyle: {
				warmth: "balanced",
				directness: "balanced",
			},
			proactivityPolicy: {
				initiativeLevel: "minimal",
				allowedKinds: ["suggestion", "offer", "silent_watchpoint"],
				blockedKinds: [],
				requireApprovalForKinds: [],
			},
			interruptionPolicy: {
				maxUnpromptedMessagesPerDay: 1,
				preferredDelivery: "thread",
			},
			autonomyPolicy: {
				allowOffersWithoutPrompt: true,
				allowAmbientAutoExecution: false,
			},
		};

		const outcome = await service.reflectSignal({
			signalId: "sig_3",
			signalType: "git.status_changed",
			summary:
				"Ambient notice: workspace git status changed from clean to dirty in /repo/app.",
			confidence: 0.7,
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
			relationshipBoundary: boundary,
		});

		expect(outcome.candidate).toBeUndefined();
		expect(outcome.run.outcome).toBe("no_action");
	});
});

class MockProvider implements LLMProvider {
	readonly name = "mock";

	constructor(
		private readonly payload: Record<string, unknown>,
		private readonly inspect?: (request: LLMRequest) => void,
	) {}

	getCapabilities(): LLMProviderCapabilities {
		return {
			structuredOutputModes: ["json_schema"],
		};
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		this.inspect?.(request);
		return {
			id: "mock",
			content: [
				{
					type: "text",
					text: JSON.stringify(this.payload),
				},
			] as ContentBlock[],
			stopReason: "end_turn",
			usage: {
				inputTokens: 1,
				outputTokens: 1,
			},
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
