import type { MaturityStage, TrustProfile } from "@nous/core";

export interface TaskOutcome {
	success: boolean;
	wasEdited: boolean;
	wasUndone: boolean;
	wasAcceptedImmediately: boolean;
	complexity: "low" | "medium" | "high";
}

/** Calculate trust scores based on task outcomes */
export class TrustCalculator {
	/** Update trust profile based on a task outcome */
	update(profile: TrustProfile, outcome: TaskOutcome): TrustProfile {
		const updated = { ...profile };

		// Reliability: did the task succeed?
		const reliabilityDelta = outcome.success ? 0.02 : -0.05;
		updated.reliabilityScore = clamp(
			updated.reliabilityScore + reliabilityDelta,
			0,
			1,
		);

		// Judgment: was the result accepted without edits?
		if (outcome.success) {
			if (outcome.wasAcceptedImmediately) {
				updated.judgmentScore = clamp(updated.judgmentScore + 0.03, 0, 1);
			} else if (outcome.wasEdited) {
				updated.judgmentScore = clamp(updated.judgmentScore - 0.01, 0, 1);
			}
			if (outcome.wasUndone) {
				updated.judgmentScore = clamp(updated.judgmentScore - 0.1, 0, 1);
			}
		}

		// Proactivity: higher complexity tasks that succeed boost proactivity
		if (outcome.success && outcome.complexity === "high") {
			updated.proactivityScore = clamp(updated.proactivityScore + 0.02, 0, 1);
		}

		// Update overall trust
		updated.overallTrust =
			updated.reliabilityScore * 0.4 +
			updated.judgmentScore * 0.4 +
			updated.proactivityScore * 0.2;

		updated.lastUpdated = new Date().toISOString();

		return updated;
	}

	/** Determine maturity stage based on trust profile */
	assessStage(profile: TrustProfile): MaturityStage {
		if (profile.overallTrust < 0.2) return 0; // Stranger
		if (profile.overallTrust < 0.4) return 1; // Acquaintance
		if (profile.overallTrust < 0.65) return 2; // Colleague
		if (profile.overallTrust < 0.85) return 3; // Trusted Partner
		return 4; // Extended Self
	}

	/** Create initial trust profile */
	static createInitial(
		userId = "default",
		nousInstanceId = "default",
	): TrustProfile {
		return {
			userId,
			nousInstanceId,
			overallTrust: 0.1,
			reliabilityScore: 0.1,
			judgmentScore: 0.1,
			proactivityScore: 0.0,
			maturityStage: 0,
			tasksCompleted: 0,
			tasksFailed: 0,
			lastUpdated: new Date().toISOString(),
		};
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
