import type { Event, Task } from "@nous/core";
import { createLogger, isOlderThan, now, prefixedId } from "@nous/core";

const log = createLogger("scheduler");
import type { EventStore, TaskStore } from "@nous/persistence";
import { backoffDelay } from "./backoff.ts";

export interface SchedulerConfig {
	taskStore: TaskStore;
	eventStore: EventStore;
	heartbeatTimeoutMs?: number;
	pollIntervalMs?: number;
	onTaskReady?: (task: Task) => void;
	onEscalation?: (task: Task, reason: string) => void;
	shouldDispatchTask?: (task: Task) => boolean;
}

export class TaskScheduler {
	private taskStore: TaskStore;
	private eventStore: EventStore;
	private heartbeatTimeoutMs: number;
	private pollIntervalMs: number;
	private onTaskReady: (task: Task) => void;
	private onEscalation: (task: Task, reason: string) => void;
	private shouldDispatchTask: (task: Task) => boolean;
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor(config: SchedulerConfig) {
		this.taskStore = config.taskStore;
		this.eventStore = config.eventStore;
		this.heartbeatTimeoutMs = config.heartbeatTimeoutMs ?? 60000;
		this.pollIntervalMs = config.pollIntervalMs ?? 5000;
		this.onTaskReady = config.onTaskReady ?? (() => {});
		this.onEscalation = config.onEscalation ?? (() => {});
		this.shouldDispatchTask = config.shouldDispatchTask ?? (() => true);
	}

	start(): void {
		if (this.intervalId) return;
		this.tick(); // Immediate first tick
		this.intervalId = setInterval(() => this.tick(), this.pollIntervalMs);
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/** Single scheduling cycle */
	tick(): void {
		log.debug("Scheduler tick");
		this.promoteCreatedToQueued();
		this.dispatchReady();
		this.handleStaleHeartbeats();
		this.handleFailedRetries();
	}

	/** Move tasks from 'created' to 'queued' */
	private promoteCreatedToQueued(): void {
		const created = this.taskStore.getByStatus("created");
		for (const task of created) {
			log.debug("Promoting task to queued", { taskId: task.id });
			this.taskStore.update(task.id, { status: "queued", queuedAt: now() });
			this.emitEvent("task.queued", "task", task.id, {});
		}
	}

	/** Find queued tasks whose dependencies are all done */
	private dispatchReady(): void {
		const ready = this.taskStore.getReady();
		for (const task of ready) {
			if (!this.shouldDispatchTask(task)) {
				continue;
			}
			this.onTaskReady(task);
		}
	}

	/** Detect running tasks with stale heartbeats and timeout them */
	private handleStaleHeartbeats(): void {
		const stale = this.taskStore.getRunningWithStaleHeartbeat(
			this.heartbeatTimeoutMs,
		);
		for (const task of stale) {
			log.warn("Task heartbeat stale, timing out", { taskId: task.id });
			this.taskStore.update(task.id, {
				status: "timeout",
				error: `Heartbeat timeout after ${this.heartbeatTimeoutMs}ms`,
			});
			this.emitEvent("task.timeout", "task", task.id, {
				reason: "heartbeat_timeout",
			});

			// Check if we should retry or escalate
			if (task.retries < task.maxRetries) {
				const delay = backoffDelay(task.retries, task.backoffSeconds);
				setTimeout(() => {
					this.taskStore.update(task.id, {
						status: "queued",
						retries: task.retries + 1,
						queuedAt: now(),
					});
					this.emitEvent("task.retried", "task", task.id, {
						attempt: task.retries + 1,
					});
				}, delay);
			} else {
				this.taskStore.update(task.id, {
					status: "escalated",
					escalationReason: "Max retries exceeded after timeout",
				});
				this.emitEvent("task.escalated", "task", task.id, {
					reason: "max_retries_exceeded",
				});
				this.onEscalation(task, "Max retries exceeded after timeout");
			}
		}
	}

	/** Retry failed tasks that haven't exceeded max retries */
	private handleFailedRetries(): void {
		const failed = this.taskStore.getFailedWithRetries();
		for (const task of failed) {
			const delay = backoffDelay(task.retries, task.backoffSeconds);
			setTimeout(() => {
				this.taskStore.update(task.id, {
					status: "queued",
					retries: task.retries + 1,
					queuedAt: now(),
				});
				this.emitEvent("task.retried", "task", task.id, {
					attempt: task.retries + 1,
				});
			}, delay);
		}
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
