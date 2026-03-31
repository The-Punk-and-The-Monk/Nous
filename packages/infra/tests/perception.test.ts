import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Intent, now, prefixedId } from "@nous/core";
import {
	SQLiteEventStore,
	SQLiteIntentStore,
	initDatabase,
} from "@nous/persistence";
import {
	FileSystemSensor,
	HeuristicAttentionFilter,
	PerceptionService,
} from "../src/daemon/perception.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("FileSystemSensor", () => {
	test("detects changed files after baseline snapshot", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-perception-"));
		tempDirs.push(root);
		const file = join(root, "package.json");
		writeFileSync(file, '{"name":"demo"}');

		const sensor = new FileSystemSensor();
		expect(sensor.poll(root)).toHaveLength(0);

		writeFileSync(file, '{"name":"demo","version":"1.0.0"}');
		const signals = sensor.poll(root);
		expect(
			signals.some((signal) => signal.signalType === "fs.file_changed"),
		).toBe(true);
	});
});

describe("HeuristicAttentionFilter", () => {
	test("promotes high-value file changes when system is idle", () => {
		const filter = new HeuristicAttentionFilter();
		const result = filter.evaluate(
			{
				id: "sig_1",
				sensorId: "sensor_fs:/tmp/demo",
				timestamp: new Date().toISOString(),
				signalType: "fs.file_changed",
				payload: { path: "package.json", rootDir: "/tmp/demo" },
			},
			0,
		);

		expect(result.disposition).toBe("promote");
		expect(result.relevance).toBeGreaterThan(0.7);
	});

	test("logs ambient signals instead of promoting when work is already active", () => {
		const filter = new HeuristicAttentionFilter();
		const result = filter.evaluate(
			{
				id: "sig_2",
				sensorId: "sensor_fs:/tmp/demo",
				timestamp: new Date().toISOString(),
				signalType: "git.branch_changed",
				payload: { rootDir: "/tmp/demo", from: "main", to: "feature" },
			},
			1,
		);

		expect(result.disposition).toBe("log");
		expect(result.relevance).toBeLessThan(0.5);
	});
});

describe("PerceptionService", () => {
	test("emits promoted notifications for observed scope changes", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-perception-"));
		tempDirs.push(root);
		const file = join(root, "package.json");
		writeFileSync(file, '{"name":"demo"}');

		const db = initDatabase();
		const promotions: string[] = [];
		const service = new PerceptionService({
			eventStore: new SQLiteEventStore(db),
			intentStore: new SQLiteIntentStore(db),
			onPromoted: async ({ message }) => promotions.push(message),
		});

		service.observeScope({ projectRoot: root });
		await service.tick();

		writeFileSync(file, '{"name":"demo","version":"1.0.0"}');
		await service.tick();

		expect(promotions).toHaveLength(1);
		expect(promotions[0]).toContain("Ambient notice");
	});

	test("produces auto-submit candidate for high-value idle file changes", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-perception-"));
		tempDirs.push(root);
		const file = join(root, "package.json");
		writeFileSync(file, '{"name":"demo"}');

		const db = initDatabase();
		const promotions: {
			autoSubmit: boolean;
			suggestedIntentText?: string;
		}[] = [];
		const service = new PerceptionService({
			eventStore: new SQLiteEventStore(db),
			intentStore: new SQLiteIntentStore(db),
			onPromoted: async (promotion) =>
				promotions.push({
					autoSubmit: promotion.autoSubmit,
					suggestedIntentText: promotion.suggestedIntentText,
				}),
			cooldownMs: 0,
		});

		service.observeScope({ projectRoot: root });
		await service.tick();

		writeFileSync(file, '{"name":"demo","version":"1.0.0"}');
		await service.tick();

		expect(promotions).toHaveLength(1);
		expect(promotions[0]?.autoSubmit).toBe(true);
		expect(promotions[0]?.suggestedIntentText).toContain(
			"dependency/configuration change",
		);
	});

	test("suppresses redundant git-status promotion after a file-change notice", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-perception-git-"));
		tempDirs.push(root);
		writeFileSync(join(root, "package.json"), '{"name":"demo"}');
		runGit(root, ["init"]);
		runGit(root, ["config", "user.email", "nous@example.com"]);
		runGit(root, ["config", "user.name", "Nous Test"]);
		runGit(root, ["add", "package.json"]);
		runGit(root, ["commit", "-m", "init"]);

		const db = initDatabase();
		const promotions: string[] = [];
		const service = new PerceptionService({
			eventStore: new SQLiteEventStore(db),
			intentStore: new SQLiteIntentStore(db),
			onPromoted: async ({ message }) => promotions.push(message),
			cooldownMs: 60_000,
		});

		service.observeScope({ projectRoot: root });
		await service.tick();

		writeFileSync(
			join(root, "package.json"),
			'{"name":"demo","version":"1.0.0"}',
		);
		await service.tick();

		expect(promotions).toHaveLength(1);
		expect(promotions[0]).toContain("dependency or package metadata file");
	});

	test("does not promote ambient notices while another intent is active", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-perception-busy-"));
		tempDirs.push(root);
		const file = join(root, "package.json");
		writeFileSync(file, '{"name":"demo"}');

		const db = initDatabase();
		const intentStore = new SQLiteIntentStore(db);
		intentStore.create(makeActiveIntent("Check the repo"));
		const promotions: string[] = [];
		const service = new PerceptionService({
			eventStore: new SQLiteEventStore(db),
			intentStore,
			onPromoted: async ({ message }) => promotions.push(message),
		});

		service.observeScope({ projectRoot: root });
		await service.tick();

		writeFileSync(file, '{"name":"demo","version":"1.0.0"}');
		await service.tick();

		expect(promotions).toHaveLength(0);
	});
});

function makeActiveIntent(raw: string): Intent {
	return {
		id: prefixedId("int"),
		raw,
		goal: {
			summary: raw,
			successCriteria: [],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "never",
		status: "active",
		source: "human",
		createdAt: now(),
	};
}

function runGit(cwd: string, args: string[]): void {
	const result = Bun.spawnSync(["git", "-C", cwd, ...args], {
		stdout: "ignore",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(result.stderr.toString() || `git ${args.join(" ")} failed`);
	}
}
