import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSecretStore, loadNousSecrets } from "../src/config/secrets.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("Nous secrets", () => {
	test("loads provider secrets from NOUS_HOME secrets file", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-secrets-"));
		tempDirs.push(root);
		const home = join(root, ".nous");
		mkdirSync(join(home, "secrets"), { recursive: true });
		writeFileSync(
			join(home, "secrets", "providers.json"),
			JSON.stringify({
				providers: {
					openai: {
						apiKey: "openai-file-key",
						organization: "org-123",
					},
					anthropic: {
						authToken: "anthropic-token",
					},
				},
			}),
		);

		const secrets = loadNousSecrets({
			env: { NOUS_HOME: home },
		});

		expect(secrets.providers.openai?.apiKey).toBe("openai-file-key");
		expect(secrets.providers.openai?.organization).toBe("org-123");
		expect(secrets.providers.anthropic?.authToken).toBe("anthropic-token");
	});

	test("FileSecretStore returns empty secrets when file is absent", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-secrets-empty-"));
		tempDirs.push(root);
		const home = join(root, ".nous");
		const store = new FileSecretStore({
			env: { NOUS_HOME: home },
		});

		expect(store.getProviderSecrets()).toEqual({});
	});
});
