import type { Database } from "bun:sqlite";
import type { Task, TaskStatus } from "@nous/core";
import type { TaskStore } from "../interfaces/task-store.ts";

export class SQLiteTaskStore implements TaskStore {
	constructor(private db: Database) {}

	create(task: Task): void {
		this.db
			.prepare(
				`INSERT INTO tasks (id, intent_id, flow_id, plan_graph_id, parent_task_id, depends_on, description,
			 assigned_agent_id, capabilities_required, cognitive_operation, status, retries, max_retries,
			 backoff_seconds, created_at, queued_at, started_at, last_heartbeat,
			 completed_at, result, error, escalation_reason)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				task.id,
				task.intentId,
				task.flowId ?? null,
				task.planGraphId ?? null,
				task.parentTaskId ?? null,
				JSON.stringify(task.dependsOn),
				task.description,
				task.assignedAgentId ?? null,
				JSON.stringify(task.capabilitiesRequired),
				task.cognitiveOperation ?? null,
				task.status,
				task.retries,
				task.maxRetries,
				task.backoffSeconds,
				task.createdAt,
				task.queuedAt ?? null,
				task.startedAt ?? null,
				task.lastHeartbeat ?? null,
				task.completedAt ?? null,
				task.result !== undefined ? JSON.stringify(task.result) : null,
				task.error ?? null,
				task.escalationReason ?? null,
			);
	}

	getById(id: string): Task | undefined {
		const row = this.db
			.prepare("SELECT * FROM tasks WHERE id = ?")
			.get(id) as RawTaskRow | null;
		return row ? toTask(row) : undefined;
	}

	update(id: string, fields: Partial<Task>): void {
		const sets: string[] = [];
		const params: (string | number | null)[] = [];

		const fieldMap: Record<string, string> = {
			intentId: "intent_id",
			flowId: "flow_id",
			planGraphId: "plan_graph_id",
			parentTaskId: "parent_task_id",
			assignedAgentId: "assigned_agent_id",
			capabilitiesRequired: "capabilities_required",
			cognitiveOperation: "cognitive_operation",
			maxRetries: "max_retries",
			backoffSeconds: "backoff_seconds",
			createdAt: "created_at",
			queuedAt: "queued_at",
			startedAt: "started_at",
			lastHeartbeat: "last_heartbeat",
			completedAt: "completed_at",
			escalationReason: "escalation_reason",
		};

		for (const [key, value] of Object.entries(fields)) {
			const col = fieldMap[key] ?? key;
			if (
				key === "dependsOn" ||
				key === "capabilitiesRequired" ||
				key === "result"
			) {
				sets.push(`${col} = ?`);
				params.push(JSON.stringify(value));
			} else {
				sets.push(`${col} = ?`);
				params.push((value as string | number | null) ?? null);
			}
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	delete(id: string): void {
		this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
	}

	getByStatus(status: TaskStatus): Task[] {
		const rows = this.db
			.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC")
			.all(status) as RawTaskRow[];
		return rows.map(toTask);
	}

	getByIntent(intentId: string): Task[] {
		const rows = this.db
			.prepare(
				"SELECT * FROM tasks WHERE intent_id = ? ORDER BY created_at ASC",
			)
			.all(intentId) as RawTaskRow[];
		return rows.map(toTask);
	}

	getByAgent(agentId: string): Task[] {
		const rows = this.db
			.prepare("SELECT * FROM tasks WHERE assigned_agent_id = ?")
			.all(agentId) as RawTaskRow[];
		return rows.map(toTask);
	}

	getDependents(taskId: string): Task[] {
		// Tasks whose depends_on array contains this taskId
		const rows = this.db
			.prepare(
				`SELECT * FROM tasks WHERE depends_on LIKE ? AND status != 'done' AND status != 'abandoned'`,
			)
			.all(`%"${taskId}"%`) as RawTaskRow[];
		return rows.map(toTask);
	}

	getReady(): Task[] {
		// Tasks that are queued and all dependencies are done
		const queued = this.getByStatus("queued");
		return queued.filter((task) => {
			if (task.dependsOn.length === 0) return true;
			return task.dependsOn.every((depId) => {
				const dep = this.getById(depId);
				return dep?.status === "done";
			});
		});
	}

	getRunningWithStaleHeartbeat(thresholdMs: number): Task[] {
		const cutoff = new Date(Date.now() - thresholdMs).toISOString();
		const rows = this.db
			.prepare(
				`SELECT * FROM tasks WHERE status = 'running' AND last_heartbeat < ?`,
			)
			.all(cutoff) as RawTaskRow[];
		return rows.map(toTask);
	}

	getFailedWithRetries(): Task[] {
		const rows = this.db
			.prepare(
				`SELECT * FROM tasks WHERE status = 'failed' AND retries < max_retries`,
			)
			.all() as RawTaskRow[];
		return rows.map(toTask);
	}

	count(status?: TaskStatus): number {
		if (status) {
			return (
				this.db
					.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = ?")
					.get(status) as { c: number }
			).c;
		}
		return (
			this.db.prepare("SELECT COUNT(*) as c FROM tasks").get() as {
				c: number;
			}
		).c;
	}
}

interface RawTaskRow {
	id: string;
	intent_id: string;
	flow_id: string | null;
	plan_graph_id: string | null;
	parent_task_id: string | null;
	depends_on: string;
	description: string;
	assigned_agent_id: string | null;
	capabilities_required: string;
	cognitive_operation: string | null;
	status: string;
	retries: number;
	max_retries: number;
	backoff_seconds: number;
	created_at: string;
	queued_at: string | null;
	started_at: string | null;
	last_heartbeat: string | null;
	completed_at: string | null;
	result: string | null;
	error: string | null;
	escalation_reason: string | null;
}

function toTask(row: RawTaskRow): Task {
	return {
		id: row.id,
		intentId: row.intent_id,
		flowId: row.flow_id ?? undefined,
		planGraphId: row.plan_graph_id ?? undefined,
		parentTaskId: row.parent_task_id ?? undefined,
		dependsOn: JSON.parse(row.depends_on),
		description: row.description,
		assignedAgentId: row.assigned_agent_id ?? undefined,
		capabilitiesRequired: JSON.parse(row.capabilities_required),
		cognitiveOperation: row.cognitive_operation as Task["cognitiveOperation"],
		status: row.status as TaskStatus,
		retries: row.retries,
		maxRetries: row.max_retries,
		backoffSeconds: row.backoff_seconds,
		createdAt: row.created_at,
		queuedAt: row.queued_at ?? undefined,
		startedAt: row.started_at ?? undefined,
		lastHeartbeat: row.last_heartbeat ?? undefined,
		completedAt: row.completed_at ?? undefined,
		result: row.result ? JSON.parse(row.result) : undefined,
		error: row.error ?? undefined,
		escalationReason: row.escalation_reason ?? undefined,
	};
}
