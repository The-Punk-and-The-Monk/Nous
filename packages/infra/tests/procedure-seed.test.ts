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

	test("does not promote when repeated success exists but the success rate is still below threshold", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-procedure-seed-threshold-"));
		tempDirs.push(root);
		const store = new LocalProcedureSeedStore({ baseDir: root });
		const filesafe = "summarize-daemon-status-and-report-active-intents";

		store.recordTrace({
			id: "trace_a",
			intentId: "intent_a",
			threadId: "thread_a",
			intentText: "Summarize daemon status and report active intents",
			status: "achieved",
			projectRoot: "/repo/app",
			outputs: ["reported status"],
			taskSummaries: ["Inspect daemon state"],
			usedToolNames: ["git_status"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});
		store.recordTrace({
			id: "trace_b",
			intentId: "intent_b",
			threadId: "thread_b",
			intentText: "Summarize daemon status and report active intents",
			status: "achieved",
			projectRoot: "/repo/app",
			outputs: ["reported status again"],
			taskSummaries: ["Inspect daemon state"],
			usedToolNames: ["git_status"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});
		store.recordTrace({
			id: "trace_c",
			intentId: "intent_c",
			threadId: "thread_c",
			intentText: "Summarize daemon status and report active intents",
			status: "escalated",
			projectRoot: "/repo/app",
			outputs: ["needed escalation"],
			taskSummaries: ["Inspect daemon state"],
			usedToolNames: ["git_status"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});
		const fourth = store.recordTrace({
			id: "trace_d",
			intentId: "intent_d",
			threadId: "thread_d",
			intentText: "Summarize daemon status and report active intents",
			status: "achieved",
			projectRoot: "/repo/app",
			outputs: ["reported status a fourth time"],
			taskSummaries: ["Inspect daemon state"],
			usedToolNames: ["git_status"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});

		expect(fourth.candidate.validationState).toBe("validated");
		expect(fourth.candidate.successCount).toBe(3);
		expect(fourth.candidate.attemptCount).toBe(4);
		expect(fourth.procedurePromoted).toBe(false);
		expect(existsSync(join(root, "procedures", `${filesafe}.json`))).toBe(
			false,
		);
	});

	test("removes an already promoted procedure if later failures drop it below the promotion floor", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-procedure-seed-demotion-"));
		tempDirs.push(root);
		const store = new LocalProcedureSeedStore({ baseDir: root });
		const filesafe = "summarize-daemon-status-and-report-active-intents";

		for (const traceId of ["trace_1", "trace_2", "trace_3"]) {
			store.recordTrace({
				id: traceId,
				intentId: `${traceId}_intent`,
				threadId: `${traceId}_thread`,
				intentText: "Summarize daemon status and report active intents",
				status: "achieved",
				projectRoot: "/repo/app",
				outputs: ["reported status"],
				taskSummaries: ["Inspect daemon state"],
				usedToolNames: ["git_status"],
				riskyToolNames: [],
				createdAt: new Date().toISOString(),
			});
		}

		expect(existsSync(join(root, "procedures", `${filesafe}.json`))).toBe(true);

		const degraded = store.recordTrace({
			id: "trace_4",
			intentId: "intent_4",
			threadId: "thread_4",
			intentText: "Summarize daemon status and report active intents",
			status: "escalated",
			projectRoot: "/repo/app",
			outputs: ["needed escalation"],
			taskSummaries: ["Inspect daemon state"],
			usedToolNames: ["git_status"],
			riskyToolNames: [],
			createdAt: new Date().toISOString(),
		});

		expect(degraded.candidate.successCount).toBe(3);
		expect(degraded.candidate.attemptCount).toBe(4);
		expect(degraded.procedurePromoted).toBe(false);
		expect(existsSync(join(root, "procedures", `${filesafe}.json`))).toBe(
			false,
		);
	});
});
