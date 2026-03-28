import type { TrustProfile } from "@nous/core";
import { TrustCalculator } from "./trust.ts";
import type { TaskOutcome } from "./trust.ts";

export type FeedbackSignal =
	| "accept" // User accepted the result as-is
	| "edit" // User edited the result
	| "reject" // User rejected the result
	| "undo"; // User undid the action

/** Collects user feedback and updates trust */
export class FeedbackCollector {
	private calculator = new TrustCalculator();
	private profile: TrustProfile;

	constructor(profile: TrustProfile) {
		this.profile = profile;
	}

	/** Record feedback for a completed task */
	recordFeedback(
		signal: FeedbackSignal,
		taskSuccess: boolean,
		complexity: "low" | "medium" | "high" = "medium",
	): TrustProfile {
		const outcome: TaskOutcome = {
			success: taskSuccess,
			wasEdited: signal === "edit",
			wasUndone: signal === "undo",
			wasAcceptedImmediately: signal === "accept",
			complexity,
		};

		this.profile = this.calculator.update(this.profile, outcome);

		// Update counters
		if (taskSuccess) {
			this.profile.tasksCompleted++;
		} else {
			this.profile.tasksFailed++;
		}

		return this.profile;
	}

	getProfile(): TrustProfile {
		return { ...this.profile };
	}
}
