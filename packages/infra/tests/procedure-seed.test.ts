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
	test("records traces and promotes a procedure after repeated success", () => {
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
			createdAt: new Date().toISOString(),
		});
		expect(first.candidate.validationState).toBe("proposed");
		expect(first.procedurePromoted).toBe(false);

		const second = store.recordTrace({
			id: "trace_2",
			intentId: "intent_2",
			threadId: "thread_2",
			intentText: "Summarize daemon status and report active intents",
			status: "achieved",
			projectRoot: "/repo/app",
			outputs: ["reported status again"],
			createdAt: new Date().toISOString(),
		});
		expect(second.candidate.validationState).toBe("validated");
		expect(second.procedurePromoted).toBe(true);

		const filesafe = "summarize-daemon-status-and-report-active-intents";
		expect(existsSync(join(root, "traces", "trace_1.json"))).toBe(true);
		expect(existsSync(join(root, "candidates", `${filesafe}.json`))).toBe(true);
		expect(existsSync(join(root, "procedures", `${filesafe}.json`))).toBe(true);

		const procedure = JSON.parse(
			readFileSync(join(root, "procedures", `${filesafe}.json`), "utf8"),
		) as { validationState: string; successCount: number };
		expect(procedure.validationState).toBe("validated");
		expect(procedure.successCount).toBe(2);
	});
});
