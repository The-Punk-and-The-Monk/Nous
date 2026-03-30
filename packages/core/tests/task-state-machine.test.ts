import { describe, expect, test } from "bun:test";
import {
	InvalidTransitionError,
	canTransition,
	transitionTask,
	validTransitions,
} from "../src/state-machines/task-state-machine.ts";
import { TASK_TRANSITIONS, TERMINAL_STATES } from "../src/types/task.ts";
import type { TaskStatus } from "../src/types/task.ts";

describe("task state machine", () => {
	test("follows the happy path: created → queued → assigned → running → done", () => {
		let status: TaskStatus = "created";
		status = transitionTask(status, "queued");
		expect(status).toBe("queued");
		status = transitionTask(status, "assigned");
		expect(status).toBe("assigned");
		status = transitionTask(status, "running");
		expect(status).toBe("running");
		status = transitionTask(status, "done");
		expect(status).toBe("done");
	});

	test("allows running → failed → queued (retry)", () => {
		let status: TaskStatus = "running";
		status = transitionTask(status, "failed");
		expect(status).toBe("failed");
		status = transitionTask(status, "queued");
		expect(status).toBe("queued");
	});

	test("allows running → timeout → escalated → abandoned", () => {
		let status: TaskStatus = "running";
		status = transitionTask(status, "timeout");
		expect(status).toBe("timeout");
		status = transitionTask(status, "escalated");
		expect(status).toBe("escalated");
		status = transitionTask(status, "abandoned");
		expect(status).toBe("abandoned");
	});

	test("allows running → cancelled", () => {
		let status: TaskStatus = "running";
		status = transitionTask(status, "cancelled");
		expect(status).toBe("cancelled");
	});

	test("throws on invalid transition", () => {
		expect(() => transitionTask("created", "running")).toThrow(
			InvalidTransitionError,
		);
		expect(() => transitionTask("done", "running")).toThrow(
			InvalidTransitionError,
		);
		expect(() => transitionTask("abandoned", "queued")).toThrow(
			InvalidTransitionError,
		);
	});

	test("canTransition returns boolean without throwing", () => {
		expect(canTransition("created", "queued")).toBe(true);
		expect(canTransition("queued", "cancelled")).toBe(true);
		expect(canTransition("created", "done")).toBe(false);
		expect(canTransition("running", "done")).toBe(true);
		expect(canTransition("done", "created")).toBe(false);
	});

	test("validTransitions returns correct targets", () => {
		expect(validTransitions("created")).toEqual(["queued", "cancelled"]);
		expect(validTransitions("running")).toEqual([
			"done",
			"cancelled",
			"failed",
			"timeout",
		]);
		expect(validTransitions("done")).toEqual([]);
		expect(validTransitions("abandoned")).toEqual([]);
	});

	test("terminal states have no outgoing transitions", () => {
		for (const state of TERMINAL_STATES) {
			expect(TASK_TRANSITIONS[state]).toEqual([]);
		}
	});

	test("every transition target is a valid TaskStatus", () => {
		const allStates = new Set(Object.keys(TASK_TRANSITIONS));
		for (const targets of Object.values(TASK_TRANSITIONS)) {
			for (const target of targets) {
				expect(allStates.has(target)).toBe(true);
			}
		}
	});
});
