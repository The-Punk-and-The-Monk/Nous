import { describe, expect, test } from "bun:test";
import { detectCycle, getRoots, topologicalSort } from "../src/planner/dag.ts";

describe("DAG utilities", () => {
	test("detectCycle returns null for valid DAG", () => {
		const nodes = [
			{ id: "a", dependsOn: [] },
			{ id: "b", dependsOn: ["a"] },
			{ id: "c", dependsOn: ["a", "b"] },
		];
		expect(detectCycle(nodes)).toBeNull();
	});

	test("detectCycle finds a simple cycle", () => {
		const nodes = [
			{ id: "a", dependsOn: ["c"] },
			{ id: "b", dependsOn: ["a"] },
			{ id: "c", dependsOn: ["b"] },
		];
		const cycle = detectCycle(nodes);
		expect(cycle).not.toBeNull();
		expect(cycle?.length).toBeGreaterThan(2);
	});

	test("detectCycle finds a self-loop", () => {
		const nodes = [{ id: "a", dependsOn: ["a"] }];
		const cycle = detectCycle(nodes);
		expect(cycle).not.toBeNull();
	});

	test("topologicalSort returns valid ordering", () => {
		const nodes = [
			{ id: "c", dependsOn: ["a", "b"] },
			{ id: "a", dependsOn: [] },
			{ id: "b", dependsOn: ["a"] },
		];
		const sorted = topologicalSort(nodes);
		expect(sorted).toEqual(["a", "b", "c"]);
	});

	test("topologicalSort throws on cycle", () => {
		const nodes = [
			{ id: "a", dependsOn: ["b"] },
			{ id: "b", dependsOn: ["a"] },
		];
		expect(() => topologicalSort(nodes)).toThrow("cycle");
	});

	test("getRoots returns nodes with no dependencies", () => {
		const nodes = [
			{ id: "a", dependsOn: [] },
			{ id: "b", dependsOn: ["a"] },
			{ id: "c", dependsOn: [] },
			{ id: "d", dependsOn: ["b", "c"] },
		];
		expect(getRoots(nodes)).toEqual(["a", "c"]);
	});

	test("handles empty graph", () => {
		expect(detectCycle([])).toBeNull();
		expect(topologicalSort([])).toEqual([]);
		expect(getRoots([])).toEqual([]);
	});

	test("handles single node", () => {
		const nodes = [{ id: "a", dependsOn: [] }];
		expect(detectCycle(nodes)).toBeNull();
		expect(topologicalSort(nodes)).toEqual(["a"]);
		expect(getRoots(nodes)).toEqual(["a"]);
	});
});
