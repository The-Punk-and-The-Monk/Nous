import { describe, expect, test } from "bun:test";
import { DEFAULT_NOUS_MATCHING_CONFIG } from "@nous/core";
import {
	InteractionModeClassifier,
	type InteractionModeDecision,
} from "../src/intake/interaction-mode-classifier.ts";

describe("InteractionModeClassifier", () => {
	test("classifies ambiguous conversational follow-up as chat", async () => {
		const classifier = new InteractionModeClassifier();
		const result = await classifier.classify({
			text: "Can you say that shorter?",
			recentThreadMessages: [
				{ role: "assistant", content: "Here is the long answer." },
				{ role: "human", content: "Can you say that shorter?" },
			],
		});

		expect(result.mode).toBe("chat");
		expect(result.confidence).toBe("high");
	});

	test("classifies explicit transfer language as handoff", async () => {
		const classifier = new InteractionModeClassifier();
		const result = await classifier.classify({
			text: "Attach this to IDE and hand off the context.",
		});

		expect(result.mode).toBe("handoff");
		expect(result.confidence).toBe("high");
	});

	test("classifies explicit work governance language as work", async () => {
		const classifier = new InteractionModeClassifier();
		const result = await classifier.classify({
			text: "Also focus only on token refresh and keep it read-only.",
			activeIntent: {
				id: "intent_1",
				raw: "Inspect auth changes",
				goal: {
					summary: "Inspect auth changes",
					successCriteria: ["Report findings"],
				},
				constraints: [],
				priority: 1,
				humanCheckpoints: "always",
				status: "active",
				source: "human",
				createdAt: new Date().toISOString(),
			},
		});

		expect(result.mode).toBe("work");
		expect(result.confidence).toBe("high");
	});

	test("classifies restoration-approved continuity language as work", async () => {
		const classifier = new InteractionModeClassifier();
		const result = await classifier.classify({
			text: "Continue that auth thing from yesterday.",
			restorationAllowed: true,
		});

		expect(result.mode).toBe("work");
		expect(result.confidence).toBe("medium");
	});

	test("keeps inferred continuity language in chat mode without active work", async () => {
		const classifier = new InteractionModeClassifier();
		const result = await classifier.classify({
			text: "Continue that auth thing from yesterday.",
			recentThreadMessages: [
				{ role: "assistant", content: "Yesterday we discussed auth." },
				{ role: "human", content: "Continue that auth thing from yesterday." },
			],
		});

		expect(result.mode).toBe("chat");
		expect(result.confidence).toBe("medium");
	});

	test("semantic-only mode can classify work even without lexical work phrase", async () => {
		const classifier = new InteractionModeClassifier({
			policy: {
				...DEFAULT_NOUS_MATCHING_CONFIG.interactionMode,
				mode: "semantic_only",
			},
			semanticEvaluator: {
				evaluate: async (): Promise<InteractionModeDecision> => ({
					mode: "work",
					confidence: "high",
					rationale:
						"Semantic evaluator recognized a concrete governed-work request.",
				}),
			},
		});

		const result = await classifier.classify({
			text: "Can you pick back up the auth investigation you were doing?",
		});

		expect(result.mode).toBe("work");
		expect(result.confidence).toBe("high");
	});

	test("hybrid mode keeps chat fallback when heuristic sees only ambiguous chat", async () => {
		const classifier = new InteractionModeClassifier({
			policy: DEFAULT_NOUS_MATCHING_CONFIG.interactionMode,
			semanticEvaluator: {
				evaluate: async (): Promise<InteractionModeDecision> => ({
					mode: "work",
					confidence: "medium",
					rationale: "Semantic evaluator saw possible work intent.",
				}),
			},
		});

		const result = await classifier.classify({
			text: "continue that",
		});

		expect(result.mode).toBe("chat");
	});
});
