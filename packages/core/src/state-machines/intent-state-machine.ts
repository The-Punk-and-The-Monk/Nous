import { NousError } from "../errors.ts";
import type { IntentStatus } from "../types/intent.ts";

const INTENT_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
	active: ["achieved", "abandoned"],
	achieved: [],
	abandoned: [],
};

export class InvalidIntentTransitionError extends NousError {
	constructor(from: IntentStatus, to: IntentStatus) {
		super(`Invalid intent state transition: ${from} → ${to}`);
		this.name = "InvalidIntentTransitionError";
	}
}

export function transitionIntent(
	current: IntentStatus,
	next: IntentStatus,
): IntentStatus {
	const validTargets = INTENT_TRANSITIONS[current];
	if (!validTargets.includes(next)) {
		throw new InvalidIntentTransitionError(current, next);
	}
	return next;
}

export function canTransitionIntent(
	current: IntentStatus,
	next: IntentStatus,
): boolean {
	return INTENT_TRANSITIONS[current].includes(next);
}
