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
});
