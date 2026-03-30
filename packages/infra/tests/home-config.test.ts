import { afterEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ensureNousHome,
	getNousPaths,
	loadNousConfig,
} from "../src/config/home.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("Nous home config", () => {
	test("defaults to ~/.nous-style user home layout", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-home-"));
		tempDirs.push(root);
		const env = { NOUS_HOME: join(root, ".nous") };

		const paths = ensureNousHome({ env, cwd: root });
		expect(paths.homeDir.endsWith(".nous")).toBe(true);
		expect(paths.configDir.endsWith(".nous/config")).toBe(true);
		expect(paths.daemonDir.endsWith(".nous/daemon")).toBe(true);
		expect(paths.stateDir.endsWith(".nous/state")).toBe(true);
		expect(paths.networkDir.endsWith(".nous/network")).toBe(true);
		expect(paths.artifactsDir.endsWith(".nous/artifacts")).toBe(true);

		const config = JSON.parse(
			readFileSync(join(paths.configDir, "config.json"), "utf8"),
		) as { daemon: { host: string } };
		expect(config.daemon.host).toBe("127.0.0.1");
		const providerConfig = JSON.parse(
			readFileSync(join(paths.configDir, "providers.json"), "utf8"),
		) as {
			provider: {
				priority: string[];
				openaiModel: string;
				claudeModel: string;
			};
		};
		expect(providerConfig.provider.priority[0]).toBe("openai");
		expect(providerConfig.provider.openaiModel).toBe("gpt-5.1");
		const secrets = JSON.parse(
			readFileSync(join(paths.secretsDir, "providers.json"), "utf8"),
		) as {
			providers: { openai: object; anthropic: object; openaiCompat: object };
		};
		expect(secrets.providers.openai).toEqual({});
		const permissions = JSON.parse(
			readFileSync(join(paths.configDir, "permissions.json"), "utf8"),
		) as { grantAll: boolean; rules: Array<{ action: string }> };
		expect(permissions.grantAll).toBe(false);
		expect(permissions.rules.some((rule) => rule.action === "fs.read")).toBe(
			true,
		);
		const network = JSON.parse(
			readFileSync(join(paths.configDir, "network.json"), "utf8"),
		) as { networkEnabled: boolean };
		expect(network.networkEnabled).toBe(false);
	});

	test("loads project-local overrides from nearest .nous directory", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-project-"));
		tempDirs.push(root);
		const env = { NOUS_HOME: join(root, ".home-nous") };
		const projectRoot = join(root, "workspace");
		const nested = join(projectRoot, "packages", "demo");
		mkdirSync(nested, { recursive: true });
		mkdirSync(join(projectRoot, ".nous"), { recursive: true });
		writeFileSync(
			join(projectRoot, ".nous", "sensors.json"),
			JSON.stringify({ sensors: { pollIntervalMs: 1234 } }),
		);

		const paths = getNousPaths({ env, cwd: nested });
		expect(paths.projectDir).toBe(join(projectRoot, ".nous"));

		const config = loadNousConfig({ env, cwd: nested });
		expect(config.sensors.pollIntervalMs).toBe(1234);
	});
});
