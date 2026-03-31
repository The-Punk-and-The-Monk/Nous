import { describe, expect, test } from "bun:test";
import type { ProgressEvent } from "@nous/orchestrator";
import {
	buildTrustReceiptDelivery,
	projectProgressEvent,
} from "../src/daemon/process-surface.ts";

describe("process surface projection", () => {
	test("builds a trust receipt as a structured process message", () => {
		const delivery = buildTrustReceiptDelivery({
			turnId: "msg_1",
			threadId: "thread_1",
			intentId: "intent_1",
			intentSummary: "Summarize LICENSE.md in one sentence",
			route: "new_intent",
			threadResolution: "created",
			projectRoot: "/repo",
			projectType: "typescript-monorepo",
			gitStatus: "dirty",
			focusedFile: "LICENSE.md",
			memoryHintCount: 3,
			activeIntentCount: 1,
			scopeLabelCount: 0,
			approvalBoundaryCount: 2,
			notes: ["Focused on the current repository scope."],
			createdAt: "2026-03-31T12:00:00.000Z",
		});

		expect(delivery.kind).toBe("notification");
		expect(delivery.metadata.presentation).toBe("process");
		expect(delivery.metadata.processItem?.title).toBe("Turn Context");
		expect(delivery.metadata.trustReceipt?.memoryHintCount).toBe(3);
	});

	test("projects tasks.planned into an Updated Plan process item", () => {
		const deliveries = projectProgressEvent({
			type: "tasks.planned",
			data: {
				intentId: "intent_1",
				taskCount: 2,
				tasks: [
					{ id: "task_1", description: "Read LICENSE.md" },
					{ id: "task_2", description: "Summarize it concisely" },
				],
			},
		});

		expect(deliveries).toHaveLength(1);
		expect(deliveries[0]?.metadata.processItem?.title).toBe("Updated Plan");
		expect(deliveries[0]?.metadata.processItem?.details).toEqual([
			"1. Read LICENSE.md",
			"2. Summarize it concisely",
		]);
	});

	test("suppresses noisy successful read-only tool completions", () => {
		const deliveries = projectProgressEvent({
			type: "tool.executed",
			data: {
				intentId: "intent_1",
				taskId: "task_1",
				toolName: "file_read",
				success: true,
				sideEffectClass: "read_only",
				outputPreview: "contents",
			},
		} as ProgressEvent);

		expect(deliveries).toHaveLength(0);
	});

	test("projects final completion into worked + answer lanes", () => {
		const deliveries = projectProgressEvent(
			{
				type: "intent.achieved",
				data: {
					intentId: "intent_1",
					delivery: {
						summary: "The license permits use only under Anthropic's commercial terms.",
						evidence: ["Read LICENSE.md"],
						risks: [],
						nextSteps: ["Confirm downstream redistribution constraints if needed."],
					},
				},
			},
			{
				turnId: "msg_1",
				intentId: "intent_1",
				workedMs: 42000,
			},
		);

		expect(deliveries).toHaveLength(2);
		expect(deliveries[0]?.metadata.processItem?.title).toBe("Worked for 42s");
		expect(deliveries[1]?.metadata.presentation).toBe("answer");
		expect(deliveries[1]?.metadata.answerArtifact?.evidence).toEqual([
			"Read LICENSE.md",
		]);
	});
});
