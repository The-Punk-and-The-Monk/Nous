import type { Task, TaskStatus } from "@nous/core";

export interface TaskStore {
	create(task: Task): void;
	getById(id: string): Task | undefined;
	update(id: string, fields: Partial<Task>): void;
	delete(id: string): void;
	getByStatus(status: TaskStatus): Task[];
	getByIntent(intentId: string): Task[];
	getByAgent(agentId: string): Task[];
	getDependents(taskId: string): Task[];
	getReady(): Task[];
	getRunningWithStaleHeartbeat(thresholdMs: number): Task[];
	getFailedWithRetries(): Task[];
	count(status?: TaskStatus): number;
}
