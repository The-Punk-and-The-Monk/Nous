import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDaemonPaths } from "../src/daemon/paths.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("getDaemonPaths", () => {
	test("returns default user-home .nous paths", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-paths-"));
		tempDirs.push(root);
		process.env.NOUS_HOME = join(root, ".nous");
		const paths = getDaemonPaths();
		expect(paths.socketPath.endsWith(".nous/daemon/nous.sock")).toBe(true);
		expect(paths.pidPath.endsWith(".nous/daemon/nous.pid")).toBe(true);
		expect(paths.dbPath.endsWith(".nous/state/nous.db")).toBe(true);
		process.env.NOUS_HOME = undefined;
	});
});
