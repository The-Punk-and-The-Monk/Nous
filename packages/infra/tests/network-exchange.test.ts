import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prefixedId } from "@nous/core";
import { createPersistenceBackend } from "@nous/persistence";
import { getNousPaths } from "../src/config/home.ts";
import { setNetworkEnabled } from "../src/config/network.ts";
import { LocalProcedureSeedStore } from "../src/evolution/local-procedure-seed.ts";
import { InterNousSeedExchange } from "../src/network/exchange.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("InterNousSeedExchange", () => {
	test("exports a validated local procedure and imports it into another Nous home", async () => {
		const exporterRoot = mkdtempSync(join(tmpdir(), "nous-network-exporter-"));
		const importerRoot = mkdtempSync(join(tmpdir(), "nous-network-importer-"));
		tempDirs.push(exporterRoot, importerRoot);

		const exporterEnv = { NOUS_HOME: join(exporterRoot, ".nous") };
		const importerEnv = { NOUS_HOME: join(importerRoot, ".nous") };
		setNetworkEnabled(true, { env: exporterEnv, cwd: exporterRoot });
		setNetworkEnabled(true, { env: importerEnv, cwd: importerRoot });

		const exporterPaths = getNousPaths({ env: exporterEnv, cwd: exporterRoot });
		const seeds = new LocalProcedureSeedStore({
			baseDir: exporterPaths.skillsDir,
		});

		seeds.recordTrace({
			id: prefixedId("trace"),
			intentId: prefixedId("intent"),
			intentText: "Refactor auth token refresh flow",
			status: "achieved",
			outputs: ["identified the token refresh boundary"],
			createdAt: new Date().toISOString(),
		});
		seeds.recordTrace({
			id: prefixedId("trace"),
			intentId: prefixedId("intent"),
			intentText: "Refactor auth token refresh flow",
			status: "achieved",
			outputs: ["normalized the retry path"],
			createdAt: new Date().toISOString(),
		});

		const exporterDb = createPersistenceBackend(
			join(exporterPaths.stateDir, "nous.db"),
		);
		const exporter = new InterNousSeedExchange({
			env: exporterEnv,
			cwd: exporterRoot,
			eventStore: exporterDb.events,
		});

		const { bundle, bundlePath } = await exporter.exportProcedureSummary({
			fingerprint: "refactor-auth-token-refresh-flow",
		});
		expect(bundle.kind).toBe("procedure.summary");
		expect(existsSync(bundlePath)).toBe(true);
		expect(
			exporterDb.events
				.query({ entityType: "communication" })
				.some((event) => event.type === "comm.pattern_shared"),
		).toBe(true);
		exporterDb.close();

		const importerPaths = getNousPaths({ env: importerEnv, cwd: importerRoot });
		const importerDb = createPersistenceBackend(
			join(importerPaths.stateDir, "nous.db"),
		);
		const importer = new InterNousSeedExchange({
			env: importerEnv,
			cwd: importerRoot,
			eventStore: importerDb.events,
		});

		const imported = await importer.importProcedureSummary(bundlePath);
		expect(existsSync(imported.storedBundlePath)).toBe(true);
		expect(existsSync(imported.materializedPath)).toBe(true);
		expect(
			JSON.parse(readFileSync(imported.materializedPath, "utf8")),
		).toMatchObject({
			fingerprint: bundle.procedure.fingerprint,
			fromInstanceId: bundle.from.instanceId,
		});
		expect(
			importerDb.events
				.query({ entityType: "communication" })
				.some((event) => event.type === "comm.insight_received"),
		).toBe(true);

		const status = await importer.getStatus();
		expect(status.importedProcedures).toBe(1);
		importerDb.close();
	});
});
