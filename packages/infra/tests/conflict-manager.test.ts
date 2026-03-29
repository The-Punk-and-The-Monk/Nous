import { describe, expect, test } from "bun:test";
import {
	StaticIntentConflictManager,
	deriveResourceClaims,
} from "../src/daemon/conflict-manager.ts";

describe("deriveResourceClaims", () => {
	test("extracts explicit file targets from intent text", () => {
		const claims = deriveResourceClaims(
			"Refactor src/auth.ts and tests/auth.test.ts",
			{
				projectRoot: "/repo",
			},
		);
		expect(claims.map((claim) => claim.key)).toEqual([
			"file:/repo/src/auth.ts",
			"file:/repo/tests/auth.test.ts",
		]);
		expect(claims.every((claim) => claim.mode === "write")).toBe(true);
	});

	test("falls back to scope claim when no explicit target is present", () => {
		const claims = deriveResourceClaims("Analyze the repository structure", {
			workingDirectory: "/repo",
		});
		expect(claims).toEqual([
			{
				key: "scope:/repo",
				mode: "read",
				source: "scope",
			},
		]);
	});
});

describe("StaticIntentConflictManager", () => {
	test("queues overlapping write intents sequentially", async () => {
		const manager = new StaticIntentConflictManager();
		const order: string[] = [];

		const first = manager.schedule(
			{
				text: "Refactor src/auth.ts",
				scope: { projectRoot: "/repo" },
			},
			async () => {
				order.push("first:start");
				await new Promise((resolve) => setTimeout(resolve, 10));
				order.push("first:end");
			},
		);

		const second = manager.schedule(
			{
				text: "Fix src/auth.ts tests",
				scope: { projectRoot: "/repo" },
			},
			async () => {
				order.push("second:start");
				order.push("second:end");
			},
		);

		expect(first.queued).toBe(false);
		expect(second.queued).toBe(true);
		expect(second.verdict).toBe("dependent");

		await Promise.all([first.completion, second.completion]);
		expect(order).toEqual([
			"first:start",
			"first:end",
			"second:start",
			"second:end",
		]);
	});

	test("allows concurrent read-only intents on the same scope", async () => {
		const manager = new StaticIntentConflictManager();
		let running = 0;
		let maxRunning = 0;

		const run = async () => {
			running += 1;
			maxRunning = Math.max(maxRunning, running);
			await new Promise((resolve) => setTimeout(resolve, 10));
			running -= 1;
		};

		const first = manager.schedule(
			{
				text: "Analyze repository structure",
				scope: { projectRoot: "/repo" },
			},
			run,
		);
		const second = manager.schedule(
			{
				text: "Read package layout",
				scope: { projectRoot: "/repo" },
			},
			run,
		);

		expect(second.queued).toBe(false);
		expect(second.verdict).toBe("independent");
		await Promise.all([first.completion, second.completion]);
		expect(maxRunning).toBe(2);
	});

	test("detects semantic dependency and sequences conservatively", async () => {
		const manager = new StaticIntentConflictManager();
		const first = manager.schedule(
			{
				text: "Refactor src/auth.ts",
				scope: { projectRoot: "/repo" },
			},
			async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
			},
		);
		const second = manager.schedule(
			{
				text: "Fix tests for src/auth.ts after refactor",
				scope: { projectRoot: "/repo" },
			},
			async () => {},
		);

		expect(second.queued).toBe(true);
		expect(second.verdict).toBe("dependent");
		await Promise.all([first.completion, second.completion]);
	});

	test("detects semantic conflict and flags review", async () => {
		const manager = new StaticIntentConflictManager();
		const first = manager.schedule(
			{
				text: "Add dark mode to src/theme.ts",
				scope: { projectRoot: "/repo" },
			},
			async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
			},
		);
		const second = manager.schedule(
			{
				text: "Remove dark mode from src/theme.ts",
				scope: { projectRoot: "/repo" },
			},
			async () => {},
		);

		expect(second.queued).toBe(true);
		expect(second.verdict).toBe("conflicting");
		expect(second.requiresReview).toBe(true);
		await Promise.all([first.completion, second.completion]);
	});
});
