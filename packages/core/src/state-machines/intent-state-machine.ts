import { NousError } from "../errors.ts";
import type { IntentStatus } from "../types/intent.ts";

const INTENT_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
	active: [
		"paused",
		"awaiting_clarification",
		"awaiting_decision",
		"achieved",
		"abandoned",
	],
	paused: [
		"active",
		"awaiting_clarification",
		"awaiting_decision",
		"abandoned",
	],
	awaiting_clarification: [
		"active",
		"paused",
		"awaiting_decision",
		"achieved",
		"abandoned",
	],
	awaiting_decision: [
		"active",
		"paused",
		"awaiting_clarification",
		"achieved",
		"abandoned",
	],
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
