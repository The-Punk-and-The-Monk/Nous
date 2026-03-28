import { now, prefixedId } from "@nous/core";
import type { Event } from "@nous/core";
import type { EventStore, TaskStore } from "@nous/persistence";

export interface SupervisorConfig {
	taskStore: TaskStore;
	eventStore: EventStore;
	heartbeatCheckIntervalMs?: number;
	heartbeatTimeoutMs?: number;
}

/** Process supervisor — monitors agent heartbeats and handles lifecycle */
export class ProcessSupervisor {
	private taskStore: TaskStore;
	private eventStore: EventStore;
	private heartbeatCheckIntervalMs: number;
	private heartbeatTimeoutMs: number;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private shutdownHandlers: (() => void)[] = [];

	constructor(config: SupervisorConfig) {
		this.taskStore = config.taskStore;
		this.eventStore = config.eventStore;
		this.heartbeatCheckIntervalMs = config.heartbeatCheckIntervalMs ?? 10000;
		this.heartbeatTimeoutMs = config.heartbeatTimeoutMs ?? 60000;
	}

	start(): void {
		// Set up graceful shutdown
		const shutdown = () => this.shutdown();
		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);

		this.intervalId = setInterval(
			() => this.checkHealth(),
			this.heartbeatCheckIntervalMs,
		);
	}

	onShutdown(handler: () => void): void {
		this.shutdownHandlers.push(handler);
	}

	private checkHealth(): void {
		const stale = this.taskStore.getRunningWithStaleHeartbeat(
			this.heartbeatTimeoutMs,
		);
		for (const task of stale) {
			this.emitEvent("task.timeout", "task", task.id, {
				reason: "supervisor_health_check",
			});
		}
	}

	/** Stop the health check interval without triggering shutdown */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	shutdown(): void {
		this.stop();
		for (const handler of this.shutdownHandlers) {
			handler();
		}
		process.exit(0);
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
		};
		this.eventStore.append(event);
	}
}
