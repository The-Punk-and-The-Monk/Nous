import { describe, expect, test } from "bun:test";
import type { WorkItem } from "../src/index.ts";

describe("WorkItem compatibility alias", () => {
	test("accepts the existing intent shape during bounded migration", () => {
		const workItem: WorkItem = {
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

		expect(workItem.goal.summary).toBe("Inspect auth changes");
		expect(workItem.status).toBe("active");
	});
});
