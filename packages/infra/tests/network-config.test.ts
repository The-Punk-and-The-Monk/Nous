import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ensureNousIdentity,
	getNousNetworkPaths,
	loadCommunicationPolicy,
	setNetworkEnabled,
} from "../src/config/network.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("Network config", () => {
	test("bootstraps identity once and reuses it", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-network-config-"));
		tempDirs.push(root);
		const env = { NOUS_HOME: join(root, ".nous") };

		const first = await ensureNousIdentity({ env, cwd: root });
		const second = await ensureNousIdentity({ env, cwd: root });
		const paths = getNousNetworkPaths({ env, cwd: root });

		expect(first.instanceId).toBe(second.instanceId);
		expect(JSON.parse(readFileSync(paths.identityPath, "utf8"))).toMatchObject({
			instanceId: first.instanceId,
		});
	});

	test("persists network enable state in config/network.json", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-network-policy-"));
		tempDirs.push(root);
		const env = { NOUS_HOME: join(root, ".nous") };

		expect(loadCommunicationPolicy({ env, cwd: root }).networkEnabled).toBe(
			false,
		);

		const updated = setNetworkEnabled(true, { env, cwd: root });
		expect(updated.networkEnabled).toBe(true);
		expect(loadCommunicationPolicy({ env, cwd: root }).networkEnabled).toBe(
			true,
		);
	});
});
