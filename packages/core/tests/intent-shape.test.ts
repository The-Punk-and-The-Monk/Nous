import { describe, expect, test } from "bun:test";
import type { Intent } from "../src/index.ts";

describe("Intent core type", () => {
	test("accepts the current governed intent shape", () => {
		const intent: Intent = {
			id: "intent_1",
			raw: "Inspect auth changes",
			workingText: "Inspect auth changes",
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
		};

		expect(intent.goal.summary).toBe("Inspect auth changes");
		expect(intent.status).toBe("active");
	});
});
