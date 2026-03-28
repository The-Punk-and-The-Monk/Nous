import { describe, expect, test } from "bun:test";
import { prefixedId, ulid } from "../src/utils/id.ts";

describe("ULID generation", () => {
	test("generates 26-character string", () => {
		const id = ulid();
		expect(id).toHaveLength(26);
	});

	test("uses only Crockford Base32 characters", () => {
		const valid = /^[0-9A-HJKMNP-TV-Z]+$/;
		for (let i = 0; i < 100; i++) {
			expect(ulid()).toMatch(valid);
		}
	});

	test("is lexicographically sortable by time", () => {
		const first = ulid();
		// Small delay to ensure different timestamp
		const start = Date.now();
		while (Date.now() === start) {
			// spin until ms ticks
		}
		const second = ulid();
		expect(first < second).toBe(true);
	});

	test("generates unique IDs", () => {
		const ids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			ids.add(ulid());
		}
		expect(ids.size).toBe(1000);
	});
});

describe("prefixedId", () => {
	test("prepends prefix with underscore", () => {
		const id = prefixedId("task");
		expect(id).toMatch(/^task_[0-9A-HJKMNP-TV-Z]{26}$/);
	});

	test("works with different prefixes", () => {
		expect(prefixedId("evt")).toMatch(/^evt_/);
		expect(prefixedId("agent")).toMatch(/^agent_/);
		expect(prefixedId("mem")).toMatch(/^mem_/);
	});
});
