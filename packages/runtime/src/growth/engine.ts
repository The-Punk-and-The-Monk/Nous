import type { Event, StageTransition, TrustProfile } from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { EventStore } from "@nous/persistence";
import { GrowthCheckpointManager } from "./checkpoint.ts";
import { TrustCalculator } from "./trust.ts";
import type { TaskOutcome } from "./trust.ts";

/** The Growth Engine — manages trust, maturity, and capability graduation */
export class GrowthEngine {
	private calculator = new TrustCalculator();
	private checkpoints = new GrowthCheckpointManager();
	private profile: TrustProfile;
	private eventStore: EventStore;
	private agentId: string;

	constructor(eventStore: EventStore, agentId: string, profile?: TrustProfile) {
		this.eventStore = eventStore;
		this.agentId = agentId;
		this.profile = profile ?? TrustCalculator.createInitial();
	}

	/** Process a task outcome and potentially trigger stage transition */
	processOutcome(outcome: TaskOutcome): {
		profile: TrustProfile;
		transition: StageTransition | null;
	} {
		// Update trust scores
		this.profile = this.calculator.update(this.profile, outcome);

		// Update counters
		if (outcome.success) {
			this.profile.tasksCompleted++;
		} else {
			this.profile.tasksFailed++;
		}

		// Check for stage transition
		const transition = this.checkpoints.checkTransition(this.profile);
		if (transition) {
			this.emitEvent("growth.checkpoint_proposed", "agent", this.agentId, {
				fromStage: transition.fromStage,
				toStage: transition.toStage,
				evidence: transition.evidence,
			});

			if (!transition.requiresHumanApproval) {
				// Auto-promote for stages 0→1 and 1→2
				this.profile.maturityStage = transition.toStage;
				this.emitEvent("growth.stage_transition", "agent", this.agentId, {
					fromStage: transition.fromStage,
					toStage: transition.toStage,
				});
			}
		}

		this.emitEvent("growth.trust_updated", "agent", this.agentId, {
			overallTrust: this.profile.overallTrust,
			reliabilityScore: this.profile.reliabilityScore,
			judgmentScore: this.profile.judgmentScore,
			proactivityScore: this.profile.proactivityScore,
		});

		return { profile: this.profile, transition };
	}

	getProfile(): TrustProfile {
		return { ...this.profile };
	}

	/** Approve a pending stage transition (for stages requiring human approval) */
	approveTransition(transition: StageTransition): void {
		this.profile.maturityStage = transition.toStage;
		this.emitEvent("growth.stage_transition", "agent", this.agentId, {
			fromStage: transition.fromStage,
			toStage: transition.toStage,
			approvedByHuman: true,
		});
	}

	private emitEvent(
		type: string,
		entityType: string,
		entityId: string,
		payload: Record<string, unknown>,
	): void {
		const event: Event = {
			id: prefixedId("evt"),
			timestamp: now(),
			type: type as Event["type"],
			entityType: entityType as Event["entityType"],
			entityId,
			payload,
			agentId: this.agentId,
		};
		this.eventStore.append(event);
	}
}
