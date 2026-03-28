import { describe, expect, test } from "bun:test";
import { TrustCalculator } from "../src/growth/trust.ts";
import type { TaskOutcome } from "../src/growth/trust.ts";

describe("TrustCalculator", () => {
	test("initial profile has low trust", () => {
		const profile = TrustCalculator.createInitial();
		expect(profile.overallTrust).toBe(0.1);
		expect(profile.maturityStage).toBe(0);
		expect(profile.tasksCompleted).toBe(0);
	});

	test("successful task increases reliability", () => {
		const calc = new TrustCalculator();
		const initial = TrustCalculator.createInitial();
		const outcome: TaskOutcome = {
			success: true,
			wasEdited: false,
			wasUndone: false,
			wasAcceptedImmediately: true,
			complexity: "medium",
		};
		const updated = calc.update(initial, outcome);
		expect(updated.reliabilityScore).toBeGreaterThan(initial.reliabilityScore);
		expect(updated.judgmentScore).toBeGreaterThan(initial.judgmentScore);
	});

	test("failed task decreases reliability", () => {
		const calc = new TrustCalculator();
		const initial = TrustCalculator.createInitial();
		initial.reliabilityScore = 0.5;
		const outcome: TaskOutcome = {
			success: false,
			wasEdited: false,
			wasUndone: false,
			wasAcceptedImmediately: false,
			complexity: "medium",
		};
		const updated = calc.update(initial, outcome);
		expect(updated.reliabilityScore).toBeLessThan(initial.reliabilityScore);
	});

	test("undone task severely impacts judgment", () => {
		const calc = new TrustCalculator();
		const initial = TrustCalculator.createInitial();
		initial.judgmentScore = 0.5;
		const outcome: TaskOutcome = {
			success: true,
			wasEdited: false,
			wasUndone: true,
			wasAcceptedImmediately: false,
			complexity: "medium",
		};
		const updated = calc.update(initial, outcome);
		expect(updated.judgmentScore).toBeLessThan(0.5);
	});

	test("assessStage maps trust to maturity stages", () => {
		const calc = new TrustCalculator();
		const profile = TrustCalculator.createInitial();

		profile.overallTrust = 0.1;
		expect(calc.assessStage(profile)).toBe(0);

		profile.overallTrust = 0.3;
		expect(calc.assessStage(profile)).toBe(1);

		profile.overallTrust = 0.5;
		expect(calc.assessStage(profile)).toBe(2);

		profile.overallTrust = 0.75;
		expect(calc.assessStage(profile)).toBe(3);

		profile.overallTrust = 0.9;
		expect(calc.assessStage(profile)).toBe(4);
	});

	test("scores stay clamped between 0 and 1", () => {
		const calc = new TrustCalculator();
		let profile = TrustCalculator.createInitial();
		profile.reliabilityScore = 0.99;
		profile.judgmentScore = 0.99;

		// Many successful outcomes
		for (let i = 0; i < 100; i++) {
			profile = calc.update(profile, {
				success: true,
				wasEdited: false,
				wasUndone: false,
				wasAcceptedImmediately: true,
				complexity: "high",
			});
		}

		expect(profile.reliabilityScore).toBeLessThanOrEqual(1);
		expect(profile.judgmentScore).toBeLessThanOrEqual(1);
		expect(profile.proactivityScore).toBeLessThanOrEqual(1);
	});
});
