import { describe, expect, test } from "bun:test";
import { backoffDelay } from "../src/scheduler/backoff.ts";

describe("backoffDelay", () => {
	test("increases exponentially with retries", () => {
		const d0 = backoffDelay(0, 2);
		const d1 = backoffDelay(1, 2);
		const d2 = backoffDelay(2, 2);

		// Approximate due to jitter, but should follow 2^n pattern
		expect(d0).toBeGreaterThan(0);
		expect(d1).toBeGreaterThan(d0 * 0.5); // Allow for jitter
		expect(d2).toBeGreaterThan(d1 * 0.5);
	});

	test("respects max seconds cap", () => {
		const d = backoffDelay(20, 2, 10);
		// Max 10 seconds + jitter = ~12.5s at most
		expect(d).toBeLessThanOrEqual(12500);
	});

	test("returns positive values", () => {
		for (let i = 0; i < 10; i++) {
			expect(backoffDelay(i, 1)).toBeGreaterThanOrEqual(0);
		}
	});
});
