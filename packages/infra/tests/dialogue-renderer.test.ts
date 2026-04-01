import { describe, expect, test } from "bun:test";
import type { DialogueMessage } from "@nous/core";
import { formatDialogueMessageLines } from "../src/cli/renderers/dialogue.ts";

describe("dialogue renderer", () => {
	test("renders process items without leaking raw runtime ids", () => {
		const message: DialogueMessage = {
			id: "msg_1",
			threadId: "thread_1",
			role: "assistant",
			channel: "daemon",
			direction: "outbound",
			content: "Updated Plan",
			createdAt: "2026-03-31T12:00:00.000Z",
			metadata: {
				presentation: "process",
				phase: "commentary",
				turnId: "msg_human_1",
				processItem: {
					kind: "plan_update",
					title: "Updated Plan",
					details: ["1. Inspect auth flow", "2. Explain the breakage"],
					status: "info",
				},
			},
		};

		const lines = formatDialogueMessageLines(message);
		expect(lines[0]).toContain("Updated Plan");
		expect(lines.join("\n")).not.toContain("task_");
		expect(lines.join("\n")).toContain("Inspect auth flow");
	});

	test("renders final answers as a separate lane", () => {
		const message: DialogueMessage = {
			id: "msg_2",
			threadId: "thread_1",
			role: "assistant",
			channel: "daemon",
			direction: "outbound",
			content: "Completed successfully.",
			createdAt: "2026-03-31T12:01:00.000Z",
			metadata: {
				presentation: "answer",
				phase: "final",
				turnId: "msg_human_1",
				answerArtifact: {
					summary: "The auth regression comes from the removed token refresh guard.",
					evidence: ["Checked auth middleware", "Compared recent diff"],
				},
			},
		};

		const lines = formatDialogueMessageLines(message);
		expect(lines[0]).toContain("Nous");
		expect(lines.join("\n")).toContain("Evidence");
		expect(lines.join("\n")).toContain("removed token refresh guard");
	});

	test("deduplicates evidence when it repeats the summary", () => {
		const message: DialogueMessage = {
			id: "msg_3",
			threadId: "thread_1",
			role: "assistant",
			channel: "daemon",
			direction: "outbound",
			content: "Repeated artifact text.",
			createdAt: "2026-03-31T12:02:00.000Z",
			metadata: {
				presentation: "answer",
				phase: "final",
				turnId: "msg_human_1",
				answerArtifact: {
					summary: "The auth regression comes from the removed token refresh guard.",
					evidence: [
						"The auth regression comes from the removed token refresh guard.",
						"Checked auth middleware",
					],
				},
			},
		};

		const lines = formatDialogueMessageLines(message);
		expect(lines.join("\n")).toContain("Evidence");
		expect(lines.join("\n")).toContain("Checked auth middleware");
		expect(
			lines.filter((line) =>
				line.includes("removed token refresh guard"),
			),
		).toHaveLength(1);
	});

	test("renders thread title in trust receipts when available", () => {
		const message: DialogueMessage = {
			id: "msg_4",
			threadId: "thread_1",
			role: "assistant",
			channel: "daemon",
			direction: "outbound",
			content: "Turn Context",
			createdAt: "2026-03-31T12:03:00.000Z",
			metadata: {
				presentation: "process",
				phase: "commentary",
				turnId: "msg_human_1",
				processItem: {
					kind: "trust_receipt",
					title: "Turn Context",
					status: "info",
				},
				trustReceipt: {
					turnId: "turn_1",
					threadId: "thread_1",
					threadTitle: "积极心理学",
					route: "thread_reply",
					threadResolution: "continued",
					memoryHintCount: 3,
					activeIntentCount: 1,
					scopeLabelCount: 0,
					approvalBoundaryCount: 0,
					createdAt: "2026-03-31T12:03:00.000Z",
				},
			},
		};

		const lines = formatDialogueMessageLines(message);
		expect(lines.join("\n")).toContain(
			"continued existing thread (积极心理学 (thread_1))",
		);
	});
});
