import { describe, expect, test } from "bun:test";
import { getDaemonPaths } from "../src/daemon/paths.ts";

describe("getDaemonPaths", () => {
	test("returns default .nous paths", () => {
		const paths = getDaemonPaths();
		expect(paths.socketPath.endsWith(".nous/nous.sock")).toBe(true);
		expect(paths.pidPath.endsWith(".nous/nous.pid")).toBe(true);
		expect(paths.dbPath.endsWith(".nous/nous.db")).toBe(true);
	});
});
