import { now, prefixedId } from "@nous/core";
import type { Event } from "@nous/core";
import type { EventStore } from "@nous/persistence";

/** Emits periodic heartbeat events for a running task */
export class HeartbeatEmitter {
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor(
		private eventStore: EventStore,
		private agentId: string,
		private taskId: string,
		private intervalMs = 15000,
	) {}

	start(): void {
		this.emit(); // Emit immediately
		this.intervalId = setInterval(() => this.emit(), this.intervalMs);
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	private emit(): void {
		const event: Event = {
			id: prefixedId("evt"),
			timestamp: now(),
			type: "agent.heartbeat",
			entityType: "agent",
			entityId: this.agentId,
			payload: { taskId: this.taskId },
			agentId: this.agentId,
		};
		this.eventStore.append(event);
	}
}
