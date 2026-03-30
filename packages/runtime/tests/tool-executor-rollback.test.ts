import { afterEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilitySet } from "@nous/core";
import {
	fileWriteDef,
	fileWriteHandler,
} from "../src/tools/builtin/file-write.ts";
import { ToolExecutor } from "../src/tools/executor.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("ToolExecutor rollback contract", () => {
	test("file_write captures restore_file rollback for existing files", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-runtime-rollback-"));
		tempDirs.push(root);
		const target = join(root, "notes.txt");
		writeFileSync(target, "before", "utf-8");

		const executor = new ToolExecutor();
		executor.registerHandler(fileWriteDef.name, fileWriteHandler);

		const result = await executor.execute(
			fileWriteDef,
			{
				path: target,
				content: "after",
			},
			allowWrite(root),
		);

		expect(result.success).toBe(true);
		expect(result.rollbackPlan).toEqual({
			kind: "restore_file",
			path: target,
			content: "before",
		});
		if (!result.rollbackPlan) {
			throw new Error("Expected rollback plan for existing file");
		}

		const rollback = await executor.rollback(
			result.rollbackPlan,
			allowWrite(root),
		);
		expect(rollback.success).toBe(true);
		expect(readFileSync(target, "utf-8")).toBe("before");
	});

	test("file_write captures delete_file rollback for newly created files", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-runtime-rollback-"));
		tempDirs.push(root);
		const target = join(root, "new.txt");

		const executor = new ToolExecutor();
		executor.registerHandler(fileWriteDef.name, fileWriteHandler);

		const result = await executor.execute(
			fileWriteDef,
			{
				path: target,
				content: "created",
			},
			allowWrite(root),
		);

		expect(result.success).toBe(true);
		expect(result.rollbackPlan).toEqual({
			kind: "delete_file",
			path: target,
		});
		expect(existsSync(target)).toBe(true);
		if (!result.rollbackPlan) {
			throw new Error("Expected rollback plan for new file");
		}

		const rollback = await executor.rollback(
			result.rollbackPlan,
			allowWrite(root),
		);
		expect(rollback.success).toBe(true);
		expect(existsSync(target)).toBe(false);
	});
});

function allowWrite(root: string): CapabilitySet {
	return {
		"shell.exec": false,
		"fs.read": { paths: [root] },
		"fs.write": { paths: [root] },
		"browser.control": false,
		"network.http": false,
		spawn_subagent: false,
		"memory.write": false,
		escalate_to_human: true,
	};
}
