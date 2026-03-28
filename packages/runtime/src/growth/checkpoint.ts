import type {
	GrowthCheckpoint,
	MaturityStage,
	StageTransition,
	TrustProfile,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";

/** Stage requirements for graduation */
const STAGE_REQUIREMENTS: Record<
	MaturityStage,
	{ minTasks: number; minReliability: number; minJudgment: number }
> = {
	0: { minTasks: 0, minReliability: 0, minJudgment: 0 },
	1: { minTasks: 5, minReliability: 0.3, minJudgment: 0.2 },
	2: { minTasks: 20, minReliability: 0.5, minJudgment: 0.4 },
	3: { minTasks: 100, minReliability: 0.7, minJudgment: 0.65 },
	4: { minTasks: 500, minReliability: 0.85, minJudgment: 0.8 },
};

export class GrowthCheckpointManager {
	private checkpoints: GrowthCheckpoint[] = [];

	/** Check if the agent qualifies for stage transition */
	checkTransition(profile: TrustProfile): StageTransition | null {
		const currentStage = profile.maturityStage;
		const nextStage = (currentStage + 1) as MaturityStage;

		if (nextStage > 4) return null;

		const req = STAGE_REQUIREMENTS[nextStage];
		const totalTasks = profile.tasksCompleted + profile.tasksFailed;

		if (
			totalTasks >= req.minTasks &&
			profile.reliabilityScore >= req.minReliability &&
			profile.judgmentScore >= req.minJudgment
		) {
			return {
				id: prefixedId("trans"),
				fromStage: currentStage,
				toStage: nextStage,
				proposedAt: now(),
				evidence: {
					tasksCompleted: profile.tasksCompleted,
					reliabilityScore: profile.reliabilityScore,
					judgmentScore: profile.judgmentScore,
					proactivityScore: profile.proactivityScore,
				},
				requiresHumanApproval: nextStage >= 3,
			};
		}

		return null;
	}

	/** Record a growth checkpoint */
	addCheckpoint(checkpoint: GrowthCheckpoint): void {
		this.checkpoints.push(checkpoint);
	}

	/** Get checkpoint history */
	getCheckpoints(): GrowthCheckpoint[] {
		return [...this.checkpoints];
	}
}
