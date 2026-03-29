import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
			"Inspect the recent change",
		);
	});
});
