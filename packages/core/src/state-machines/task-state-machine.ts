import { NousError } from "../errors.ts";
import type { TaskStatus } from "../types/task.ts";
import { TASK_TRANSITIONS } from "../types/task.ts";

export class InvalidTransitionError extends NousError {
	constructor(from: TaskStatus, to: TaskStatus) {
		super(
			`Invalid task state transition: ${from} → ${to}. ` +
				`Valid transitions from '${from}': [${TASK_TRANSITIONS[from].join(", ")}]`,
		);
		this.name = "InvalidTransitionError";
	}
}

/** Validate and execute a task state transition. Returns the new status or throws. */
export function transitionTask(
	current: TaskStatus,
	next: TaskStatus,
): TaskStatus {
	const validTargets = TASK_TRANSITIONS[current];
	if (!validTargets.includes(next)) {
		throw new InvalidTransitionError(current, next);
	}
	return next;
}

/** Check if a transition is valid without throwing */
export function canTransition(current: TaskStatus, next: TaskStatus): boolean {
	return TASK_TRANSITIONS[current].includes(next);
}

/** Get all valid next states from current */
export function validTransitions(current: TaskStatus): TaskStatus[] {
	return TASK_TRANSITIONS[current];
}
