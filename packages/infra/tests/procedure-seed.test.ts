import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalProcedureSeedStore } from "../src/evolution/local-procedure-seed.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("LocalProcedureSeedStore", () => {
	test("records traces, validates after repeated success, and promotes after the third success", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-procedure-seed-"));
		tempDirs.push(root);
		const store = new LocalProcedureSeedStore({ baseDir: root });

		const first = store.recordTrace({
			id: "trace_1",
			intentId: "intent_1",
			threadId: "thread_1",
			intentText: "Summarize daemon status and report active intents",
			status: "achieved",
			projectRoot: "/repo/app",
			outputs: ["reported status"],
			taskSummaries: ["Inspect daemon state", "Report active intents"],
			usedToolNames: ["git_status", "memory_search"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});
		expect(first.candidate.validationState).toBe("proposed");
		expect(first.procedurePromoted).toBe(false);
		expect(first.candidate.toolNames).toEqual(["git_status", "memory_search"]);

		const second = store.recordTrace({
			id: "trace_2",
			intentId: "intent_2",
			threadId: "thread_2",
			intentText: "Summarize daemon status and report active intents",
			status: "achieved",
			projectRoot: "/repo/app",
			outputs: ["reported status again"],
			taskSummaries: ["Inspect daemon state"],
			usedToolNames: ["git_status"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});
		expect(second.candidate.validationState).toBe("validated");
		expect(second.procedurePromoted).toBe(false);
		expect(second.candidate.attemptCount).toBe(2);
		const filesafe = "summarize-daemon-status-and-report-active-intents";
		expect(existsSync(join(root, "procedures", `${filesafe}.json`))).toBe(
			false,
		);

		const third = store.recordTrace({
			id: "trace_3",
			intentId: "intent_3",
			threadId: "thread_3",
			intentText: "Summarize daemon status and report active intents",
			status: "achieved",
			projectRoot: "/repo/app",
			outputs: ["reported status a third time"],
			taskSummaries: ["Inspect daemon state"],
			usedToolNames: ["git_status"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});
		expect(third.candidate.validationState).toBe("validated");
		expect(third.procedurePromoted).toBe(true);
		expect(third.candidate.successCount).toBe(3);

		expect(existsSync(join(root, "traces", "trace_1.json"))).toBe(true);
		expect(existsSync(join(root, "candidates", `${filesafe}.json`))).toBe(true);
		expect(existsSync(join(root, "procedures", `${filesafe}.json`))).toBe(true);

		const procedure = JSON.parse(
			readFileSync(join(root, "procedures", `${filesafe}.json`), "utf8"),
		) as {
			validationState: string;
			successCount: number;
			attemptCount: number;
			toolNames: string[];
			taskSummaries: string[];
		};
		expect(procedure.validationState).toBe("validated");
		expect(procedure.successCount).toBe(3);
		expect(procedure.attemptCount).toBe(3);
		expect(procedure.toolNames).toEqual(["git_status", "memory_search"]);
		expect(procedure.taskSummaries).toContain("Inspect daemon state");
	});
});
