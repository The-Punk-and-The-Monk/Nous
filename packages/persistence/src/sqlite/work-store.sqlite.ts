import type { Database } from "bun:sqlite";
import type {
	Flow,
	FlowStatus,
	FlowThreadBinding,
	FlowThreadBindingRole,
	MergeCandidate,
	MergeCandidateStatus,
	PlanGraph,
	PlanGraphStatus,
	WorkRelation,
	WorkRelationKind,
} from "@nous/core";
import type {
	FlowQuery,
	FlowThreadBindingQuery,
	MergeCandidateQuery,
	PlanGraphQuery,
	WorkRelationQuery,
	WorkStore,
} from "../interfaces/work-store.ts";

export class SQLiteWorkStore implements WorkStore {
	constructor(private readonly db: Database) {}

	createFlow(flow: Flow): void {
		this.db
			.prepare(
				`INSERT INTO flows (
					id, kind, title, summary, owner_thread_id, status, source, priority,
					blocked_reason, primary_intent_id, related_intent_ids, related_task_ids,
					metadata, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				flow.id,
				flow.kind,
				flow.title,
				flow.summary,
				flow.ownerThreadId ?? null,
				flow.status,
				flow.source,
				flow.priority,
				flow.blockedReason ?? null,
				flow.primaryIntentId ?? null,
				JSON.stringify(flow.relatedIntentIds),
				JSON.stringify(flow.relatedTaskIds),
				JSON.stringify(flow.metadata ?? {}),
				flow.createdAt,
				flow.updatedAt,
			);
	}

	getFlowById(id: string): Flow | undefined {
		const row = this.db
			.prepare("SELECT * FROM flows WHERE id = ?")
			.get(id) as RawFlowRow | null;
		return row ? toFlow(row) : undefined;
	}

	updateFlow(id: string, fields: Partial<Flow>): void {
		const sets: string[] = [];
		const params: Array<string | number | null> = [];
		const fieldMap: Record<string, string> = {
			ownerThreadId: "owner_thread_id",
			blockedReason: "blocked_reason",
			primaryIntentId: "primary_intent_id",
			relatedIntentIds: "related_intent_ids",
			relatedTaskIds: "related_task_ids",
			createdAt: "created_at",
			updatedAt: "updated_at",
		};

		for (const [key, value] of Object.entries(fields)) {
			const column = fieldMap[key] ?? key;
			if (
				key === "relatedIntentIds" ||
				key === "relatedTaskIds" ||
				key === "metadata"
			) {
				sets.push(`${column} = ?`);
				params.push(JSON.stringify(value ?? (key === "metadata" ? {} : [])));
				continue;
			}
			sets.push(`${column} = ?`);
			params.push((value as string | number | null) ?? null);
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE flows SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	listFlows(query: FlowQuery = {}): Flow[] {
		const clauses: string[] = [];
		const params: Array<string | number> = [];
		appendInClause(clauses, params, "status", query.statuses);
		appendInClause(clauses, params, "kind", query.kinds);
		appendInClause(clauses, params, "source", query.sources);
		if (query.ownerThreadId) {
			clauses.push("owner_thread_id = ?");
			params.push(query.ownerThreadId);
		}
		const limitClause =
			typeof query.limit === "number" && Number.isFinite(query.limit)
				? ` LIMIT ${Math.max(1, Math.floor(query.limit))}`
				: "";
		const sql = `SELECT * FROM flows${clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY updated_at DESC${limitClause}`;
		return (this.db.prepare(sql).all(...params) as RawFlowRow[]).map(toFlow);
	}

	createPlanGraph(planGraph: PlanGraph): void {
		this.db
			.prepare(
				`INSERT INTO plan_graphs (
					id, intent_id, flow_id, status, topology, planning_depth, metadata, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				planGraph.id,
				planGraph.intentId,
				planGraph.flowId,
				planGraph.status,
				planGraph.topology,
				planGraph.planningDepth,
				JSON.stringify(planGraph.metadata ?? {}),
				planGraph.createdAt,
				planGraph.updatedAt,
			);
	}

	getPlanGraphById(id: string): PlanGraph | undefined {
		const row = this.db
			.prepare("SELECT * FROM plan_graphs WHERE id = ?")
			.get(id) as RawPlanGraphRow | null;
		return row ? toPlanGraph(row) : undefined;
	}

	updatePlanGraph(id: string, fields: Partial<PlanGraph>): void {
		const sets: string[] = [];
		const params: Array<string | null> = [];
		const fieldMap: Record<string, string> = {
			intentId: "intent_id",
			flowId: "flow_id",
			planningDepth: "planning_depth",
			createdAt: "created_at",
			updatedAt: "updated_at",
		};

		for (const [key, value] of Object.entries(fields)) {
			const column = fieldMap[key] ?? key;
			if (key === "metadata") {
				sets.push(`${column} = ?`);
				params.push(JSON.stringify(value ?? {}));
				continue;
			}
			sets.push(`${column} = ?`);
			params.push((value as string | null) ?? null);
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE plan_graphs SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	listPlanGraphs(query: PlanGraphQuery = {}): PlanGraph[] {
		const clauses: string[] = [];
		const params: Array<string | number> = [];
		if (query.flowId) {
			clauses.push("flow_id = ?");
			params.push(query.flowId);
		}
		if (query.intentId) {
			clauses.push("intent_id = ?");
			params.push(query.intentId);
		}
		appendInClause(clauses, params, "status", query.statuses);
		const limitClause =
			typeof query.limit === "number" && Number.isFinite(query.limit)
				? ` LIMIT ${Math.max(1, Math.floor(query.limit))}`
				: "";
		const sql = `SELECT * FROM plan_graphs${clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY updated_at DESC${limitClause}`;
		return (this.db.prepare(sql).all(...params) as RawPlanGraphRow[]).map(
			toPlanGraph,
		);
	}

	createRelation(relation: WorkRelation): void {
		this.db
			.prepare(
				`INSERT INTO work_relations (
					id, from_kind, from_id, to_kind, to_id, kind, flow_id, plan_graph_id,
					rationale, confidence, metadata, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				relation.id,
				relation.fromKind,
				relation.fromId,
				relation.toKind,
				relation.toId,
				relation.kind,
				relation.flowId ?? null,
				relation.planGraphId ?? null,
				relation.rationale ?? null,
				relation.confidence ?? null,
				JSON.stringify(relation.metadata ?? {}),
				relation.createdAt,
			);
	}

	getRelationById(id: string): WorkRelation | undefined {
		const row = this.db
			.prepare("SELECT * FROM work_relations WHERE id = ?")
			.get(id) as RawWorkRelationRow | null;
		return row ? toWorkRelation(row) : undefined;
	}

	listRelations(query: WorkRelationQuery = {}): WorkRelation[] {
		const clauses: string[] = [];
		const params: Array<string | number> = [];
		if (query.flowId) {
			clauses.push("flow_id = ?");
			params.push(query.flowId);
		}
		if (query.planGraphId) {
			clauses.push("plan_graph_id = ?");
			params.push(query.planGraphId);
		}
		if (query.fromId) {
			clauses.push("from_id = ?");
			params.push(query.fromId);
		}
		if (query.toId) {
			clauses.push("to_id = ?");
			params.push(query.toId);
		}
		appendInClause(clauses, params, "kind", query.kinds);
		const limitClause =
			typeof query.limit === "number" && Number.isFinite(query.limit)
				? ` LIMIT ${Math.max(1, Math.floor(query.limit))}`
				: "";
		const sql = `SELECT * FROM work_relations${clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC${limitClause}`;
		return (this.db.prepare(sql).all(...params) as RawWorkRelationRow[]).map(
			toWorkRelation,
		);
	}

	createMergeCandidate(candidate: MergeCandidate): void {
		this.db
			.prepare(
				`INSERT INTO merge_candidates (
					id, left_kind, left_id, right_kind, right_id, proposed_action,
					rationale, confidence, produced_by, status, metadata, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				candidate.id,
				candidate.leftKind,
				candidate.leftId,
				candidate.rightKind,
				candidate.rightId,
				candidate.proposedAction,
				candidate.rationale,
				candidate.confidence,
				candidate.producedBy,
				candidate.status,
				JSON.stringify(candidate.metadata ?? {}),
				candidate.createdAt,
			);
	}

	getMergeCandidateById(id: string): MergeCandidate | undefined {
		const row = this.db
			.prepare("SELECT * FROM merge_candidates WHERE id = ?")
			.get(id) as RawMergeCandidateRow | null;
		return row ? toMergeCandidate(row) : undefined;
	}

	updateMergeCandidate(id: string, fields: Partial<MergeCandidate>): void {
		const sets: string[] = [];
		const params: Array<string | number | null> = [];
		const fieldMap: Record<string, string> = {
			leftKind: "left_kind",
			leftId: "left_id",
			rightKind: "right_kind",
			rightId: "right_id",
			proposedAction: "proposed_action",
			producedBy: "produced_by",
			createdAt: "created_at",
		};

		for (const [key, value] of Object.entries(fields)) {
			const column = fieldMap[key] ?? key;
			if (key === "metadata") {
				sets.push(`${column} = ?`);
				params.push(JSON.stringify(value ?? {}));
				continue;
			}
			sets.push(`${column} = ?`);
			params.push((value as string | number | null) ?? null);
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE merge_candidates SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	listMergeCandidates(query: MergeCandidateQuery = {}): MergeCandidate[] {
		const clauses: string[] = [];
		const params: Array<string | number> = [];
		if (query.leftId) {
			clauses.push("left_id = ?");
			params.push(query.leftId);
		}
		if (query.rightId) {
			clauses.push("right_id = ?");
			params.push(query.rightId);
		}
		appendInClause(clauses, params, "status", query.statuses);
		const limitClause =
			typeof query.limit === "number" && Number.isFinite(query.limit)
				? ` LIMIT ${Math.max(1, Math.floor(query.limit))}`
				: "";
		const sql = `SELECT * FROM merge_candidates${clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC${limitClause}`;
		return (this.db.prepare(sql).all(...params) as RawMergeCandidateRow[]).map(
			toMergeCandidate,
		);
	}

	bindFlowThread(binding: FlowThreadBinding): void {
		this.db
			.prepare(
				`INSERT OR REPLACE INTO flow_thread_bindings (
					flow_id, thread_id, role, metadata, created_at
				) VALUES (?, ?, ?, ?, ?)`,
			)
			.run(
				binding.flowId,
				binding.threadId,
				binding.role,
				JSON.stringify(binding.metadata ?? {}),
				binding.createdAt,
			);
	}

	listFlowThreadBindings(
		query: FlowThreadBindingQuery = {},
	): FlowThreadBinding[] {
		const clauses: string[] = [];
		const params: string[] = [];
		if (query.flowId) {
			clauses.push("flow_id = ?");
			params.push(query.flowId);
		}
		if (query.threadId) {
			clauses.push("thread_id = ?");
			params.push(query.threadId);
		}
		if (query.role) {
			clauses.push("role = ?");
			params.push(query.role);
		}
		const sql = `SELECT * FROM flow_thread_bindings${clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC`;
		return (
			this.db.prepare(sql).all(...params) as RawFlowThreadBindingRow[]
		).map(toFlowThreadBinding);
	}
}

interface RawFlowRow {
	id: string;
	kind: Flow["kind"];
	title: string;
	summary: string;
	owner_thread_id: string | null;
	status: FlowStatus;
	source: Flow["source"];
	priority: number;
	blocked_reason: string | null;
	primary_intent_id: string | null;
	related_intent_ids: string;
	related_task_ids: string;
	metadata: string;
	created_at: string;
	updated_at: string;
}

interface RawPlanGraphRow {
	id: string;
	intent_id: string;
	flow_id: string;
	status: PlanGraphStatus;
	topology: PlanGraph["topology"];
	planning_depth: PlanGraph["planningDepth"];
	metadata: string;
	created_at: string;
	updated_at: string;
}

interface RawWorkRelationRow {
	id: string;
	from_kind: WorkRelation["fromKind"];
	from_id: string;
	to_kind: WorkRelation["toKind"];
	to_id: string;
	kind: WorkRelationKind;
	flow_id: string | null;
	plan_graph_id: string | null;
	rationale: string | null;
	confidence: number | null;
	metadata: string;
	created_at: string;
}

interface RawMergeCandidateRow {
	id: string;
	left_kind: MergeCandidate["leftKind"];
	left_id: string;
	right_kind: MergeCandidate["rightKind"];
	right_id: string;
	proposed_action: MergeCandidate["proposedAction"];
	rationale: string;
	confidence: number;
	produced_by: MergeCandidate["producedBy"];
	status: MergeCandidateStatus;
	metadata: string;
	created_at: string;
}

interface RawFlowThreadBindingRow {
	flow_id: string;
	thread_id: string;
	role: FlowThreadBindingRole;
	metadata: string;
	created_at: string;
}

function toFlow(row: RawFlowRow): Flow {
	return {
		id: row.id,
		kind: row.kind,
		title: row.title,
		summary: row.summary,
		ownerThreadId: row.owner_thread_id ?? undefined,
		status: row.status,
		source: row.source,
		priority: row.priority,
		blockedReason: row.blocked_reason ?? undefined,
		primaryIntentId: row.primary_intent_id ?? undefined,
		relatedIntentIds: parseStringArray(row.related_intent_ids),
		relatedTaskIds: parseStringArray(row.related_task_ids),
		metadata: parseObject(row.metadata),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toPlanGraph(row: RawPlanGraphRow): PlanGraph {
	return {
		id: row.id,
		intentId: row.intent_id,
		flowId: row.flow_id,
		status: row.status,
		topology: row.topology,
		planningDepth: row.planning_depth,
		metadata: parseObject(row.metadata),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toWorkRelation(row: RawWorkRelationRow): WorkRelation {
	return {
		id: row.id,
		fromKind: row.from_kind,
		fromId: row.from_id,
		toKind: row.to_kind,
		toId: row.to_id,
		kind: row.kind,
		flowId: row.flow_id ?? undefined,
		planGraphId: row.plan_graph_id ?? undefined,
		rationale: row.rationale ?? undefined,
		confidence: row.confidence ?? undefined,
		metadata: parseObject(row.metadata),
		createdAt: row.created_at,
	};
}

function toMergeCandidate(row: RawMergeCandidateRow): MergeCandidate {
	return {
		id: row.id,
		leftKind: row.left_kind,
		leftId: row.left_id,
		rightKind: row.right_kind,
		rightId: row.right_id,
		proposedAction: row.proposed_action,
		rationale: row.rationale,
		confidence: row.confidence,
		producedBy: row.produced_by,
		status: row.status,
		metadata: parseObject(row.metadata),
		createdAt: row.created_at,
	};
}

function toFlowThreadBinding(row: RawFlowThreadBindingRow): FlowThreadBinding {
	return {
		flowId: row.flow_id,
		threadId: row.thread_id,
		role: row.role,
		metadata: parseObject(row.metadata),
		createdAt: row.created_at,
	};
}

function parseStringArray(raw: string): string[] {
	try {
		const value = JSON.parse(raw) as unknown[];
		if (!Array.isArray(value)) return [];
		return value
			.map((item) => String(item).trim())
			.filter((item) => item.length > 0);
	} catch {
		return [];
	}
}

function parseObject(raw: string): Record<string, unknown> | undefined {
	try {
		const value = JSON.parse(raw) as unknown;
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return undefined;
		}
		return value as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

function appendInClause(
	clauses: string[],
	params: Array<string | number>,
	column: string,
	values: readonly string[] | undefined,
): void {
	if (!values || values.length === 0) {
		return;
	}
	clauses.push(`${column} IN (${values.map(() => "?").join(", ")})`);
	params.push(...values);
}
