import type { CommunicationPolicy, NousMessage } from "@nous/core";

/** Enforce communication policy on outgoing/incoming messages */
export class PolicyEnforcer {
	constructor(private policy: CommunicationPolicy) {}

	/** Check if an outgoing message is allowed */
	canSend(message: NousMessage): { allowed: boolean; reason?: string } {
		if (!this.policy.networkEnabled) {
			return { allowed: false, reason: "Network communication is disabled" };
		}

		// Check if sharing is enabled for pattern messages
		if (message.type.startsWith("pattern.") && !this.policy.sharing.enabled) {
			return { allowed: false, reason: "Pattern sharing is disabled" };
		}

		// Check if querying is enabled for consult messages
		if (
			message.type.startsWith("consult.request") &&
			!this.policy.queryOthers.enabled
		) {
			return { allowed: false, reason: "Querying other instances is disabled" };
		}

		return { allowed: true };
	}

	/** Check if an incoming message should be accepted */
	canReceive(message: NousMessage): { allowed: boolean; reason?: string } {
		if (!this.policy.networkEnabled) {
			return { allowed: false, reason: "Network communication is disabled" };
		}

		// Check blocked instances
		if (this.policy.respondToQueries.blockedInstances.includes(message.from)) {
			return {
				allowed: false,
				reason: `Instance '${message.from}' is blocked`,
			};
		}

		// Check if responding to queries is enabled
		if (
			message.type.startsWith("consult.request") &&
			!this.policy.respondToQueries.enabled
		) {
			return { allowed: false, reason: "Responding to queries is disabled" };
		}

		return { allowed: true };
	}

	updatePolicy(policy: Partial<CommunicationPolicy>): void {
		Object.assign(this.policy, policy);
	}

	getPolicy(): CommunicationPolicy {
		return { ...this.policy };
	}
}
