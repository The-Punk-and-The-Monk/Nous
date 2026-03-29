import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureNousHome } from "../src/config/home.ts";
import {
	allowPermissionAction,
	loadPermissionPolicy,
	resolvePermissionCapabilities,
	revokePermissionAction,
	savePermissionPolicy,
} from "../src/config/permissions.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("Permission policy", () => {
	test("bootstraps default permission rules in ~/.nous/config/permissions.json", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-permissions-"));
		tempDirs.push(root);
		const env = { NOUS_HOME: join(root, ".nous") };

		ensureNousHome({ env, cwd: root });
		const policy = loadPermissionPolicy({ env });

		expect(policy.grantAll).toBe(false);
		expect(policy.rules.some((rule) => rule.action === "fs.read")).toBe(true);
		expect(policy.rules.some((rule) => rule.action === "shell.exec")).toBe(
			true,
		);
	});

	test("resolves only auto-allowed capabilities for a project scope", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-permissions-resolve-"));
		tempDirs.push(root);
		const env = { NOUS_HOME: join(root, ".nous") };
		ensureNousHome({ env, cwd: root });

		const capabilities = resolvePermissionCapabilities(
			loadPermissionPolicy({ env }),
			{ projectRoot: root },
		);

		expect(capabilities["fs.read"]).not.toBe(false);
		expect(capabilities["fs.write"]).toBe(false);
		expect(capabilities["shell.exec"]).not.toBe(false);
		expect(
			(capabilities["shell.exec"] !== false &&
				capabilities["shell.exec"].allowlist.includes("git")) ||
				false,
		).toBe(false);
	});

	test("allow and revoke mutate persisted policy", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-permissions-mutate-"));
		tempDirs.push(root);
		const env = { NOUS_HOME: join(root, ".nous") };
		ensureNousHome({ env, cwd: root });

		const allowed = allowPermissionAction(
			loadPermissionPolicy({ env }),
			"fs.write",
		);
		savePermissionPolicy(allowed, { env });
		let capabilities = resolvePermissionCapabilities(
			loadPermissionPolicy({ env }),
			{
				projectRoot: root,
			},
		);
		expect(capabilities["fs.write"]).not.toBe(false);

		const revoked = revokePermissionAction(
			loadPermissionPolicy({ env }),
			"fs.write",
		);
		savePermissionPolicy(revoked, { env });
		capabilities = resolvePermissionCapabilities(
			loadPermissionPolicy({ env }),
			{
				projectRoot: root,
			},
		);
		expect(capabilities["fs.write"]).toBe(false);
	});
});
