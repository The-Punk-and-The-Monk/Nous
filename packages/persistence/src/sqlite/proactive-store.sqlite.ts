import type { Database } from "bun:sqlite";
import type {
	ChannelScope,
	ProactiveCandidate,
	ProactiveCandidateMetadata,
	ProactiveCandidateStatus,
	ReflectionAgendaItem,
	ReflectionAgendaMetadata,
	ReflectionAgendaStatus,
	ReflectionRun,
	ReflectionRunOutcome,
} from "@nous/core";
import type {
	ProactiveCandidateQuery,
	ProactiveStore,
	ReflectionAgendaQuery,
	ReflectionRunQuery,
} from "../interfaces/proactive-store.ts";

export class SQLiteProactiveStore implements ProactiveStore {
	constructor(private readonly db: Database) {}

	createAgendaItem(item: ReflectionAgendaItem): void {
		this.db
			.prepare(
				`INSERT INTO reflection_agenda_items (
					id, category, summary, driving_question, priority, dedupe_key, due_at,
					cooldown_until, budget_class, source_signal_ids, source_memory_ids,
					source_intent_ids, source_thread_ids, status, scope, created_at,
					leased_at, lease_owner, last_run_at, run_count, metadata
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				item.id,
				item.category,
				item.summary,
				item.drivingQuestion,
				item.priority,
				item.dedupeKey,
				item.dueAt ?? null,
				item.cooldownUntil ?? null,
				item.budgetClass,
				JSON.stringify(item.sourceSignalIds),
				JSON.stringify(item.sourceMemoryIds),
				JSON.stringify(item.sourceIntentIds),
				JSON.stringify(item.sourceThreadIds),
				item.status,
				item.scope ? JSON.stringify(item.scope) : null,
				item.createdAt,
				item.leasedAt ?? null,
				item.leaseOwner ?? null,
				item.lastRunAt ?? null,
				item.runCount,
				item.metadata ? JSON.stringify(item.metadata) : null,
			);
	}

	getAgendaItemById(id: string): ReflectionAgendaItem | undefined {
		const row = this.db
			.prepare("SELECT * FROM reflection_agenda_items WHERE id = ?")
			.get(id) as RawAgendaRow | null;
		return row ? toAgendaItem(row) : undefined;
	}

	updateAgendaItem(id: string, fields: Partial<ReflectionAgendaItem>): void {
		updateJsonRecord(this.db, "reflection_agenda_items", "id", id, fields, {
			drivingQuestion: "driving_question",
			dedupeKey: "dedupe_key",
			dueAt: "due_at",
			cooldownUntil: "cooldown_until",
			budgetClass: "budget_class",
			sourceSignalIds: "source_signal_ids",
			sourceMemoryIds: "source_memory_ids",
			sourceIntentIds: "source_intent_ids",
			sourceThreadIds: "source_thread_ids",
			createdAt: "created_at",
			leasedAt: "leased_at",
			leaseOwner: "lease_owner",
			lastRunAt: "last_run_at",
			runCount: "run_count",
		});
	}

	listAgendaItems(query: ReflectionAgendaQuery = {}): ReflectionAgendaItem[] {
		const conditions: string[] = [];
		const params: (string | number)[] = [];

		if (query.statuses && query.statuses.length > 0) {
			conditions.push(
				`status IN (${query.statuses.map(() => "?").join(", ")})`,
			);
			params.push(...query.statuses);
		}
		if (query.dedupeKey) {
			conditions.push("dedupe_key = ?");
			params.push(query.dedupeKey);
		}
		if (query.dueBefore) {
			conditions.push("(due_at IS NULL OR due_at <= ?)");
			params.push(query.dueBefore);
		}
		if (query.projectRoot) {
			conditions.push("json_extract(scope, '$.projectRoot') = ?");
			params.push(query.projectRoot);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const limit = query.limit ? `LIMIT ${query.limit}` : "";
		const rows = this.db
			.prepare(
				`SELECT * FROM reflection_agenda_items ${where}
				 ORDER BY COALESCE(due_at, created_at) ASC, created_at ASC ${limit}`,
			)
			.all(...params) as RawAgendaRow[];
		return rows.map(toAgendaItem);
	}

	createRun(run: ReflectionRun): void {
		this.db
			.prepare(
				`INSERT INTO reflection_runs (
					id, agenda_item_ids, retrieved_memory_ids, produced_candidate_ids,
					model_class, max_tokens_budget, tokens_used, outcome,
					started_at, finished_at, metadata
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				run.id,
				JSON.stringify(run.agendaItemIds),
				JSON.stringify(run.retrievedMemoryIds),
				JSON.stringify(run.producedCandidateIds),
				run.modelClass,
				run.maxTokensBudget,
				run.tokensUsed,
				run.outcome,
				run.startedAt,
				run.finishedAt ?? null,
				run.metadata ? JSON.stringify(run.metadata) : null,
			);
	}

	getRunById(id: string): ReflectionRun | undefined {
		const row = this.db
			.prepare("SELECT * FROM reflection_runs WHERE id = ?")
			.get(id) as RawRunRow | null;
		return row ? toReflectionRun(row) : undefined;
	}

	listRuns(query: ReflectionRunQuery = {}): ReflectionRun[] {
		const conditions: string[] = [];
		const params: (string | number)[] = [];
		if (query.outcome) {
			conditions.push("outcome = ?");
			params.push(query.outcome);
		}
		if (query.startedAfter) {
			conditions.push("started_at >= ?");
			params.push(query.startedAfter);
		}
		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const limit = query.limit ? `LIMIT ${query.limit}` : "";
		const rows = this.db
			.prepare(
				`SELECT * FROM reflection_runs ${where}
				 ORDER BY started_at DESC ${limit}`,
			)
			.all(...params) as RawRunRow[];
		return rows.map(toReflectionRun);
	}

	createCandidate(candidate: ProactiveCandidate): void {
		this.db
			.prepare(
				`INSERT INTO proactive_candidates (
					id, kind, summary, message_draft, rationale, proposed_intent_text,
					confidence, value_score, interruption_cost, urgency,
					recommended_mode, requires_approval, cooldown_key, expires_at,
					source_signal_ids, source_memory_ids, source_intent_ids,
					source_thread_ids, source_agenda_item_ids, status, scope,
					created_at, delivered_at, metadata
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				candidate.id,
				candidate.kind,
				candidate.summary,
				candidate.messageDraft,
				candidate.rationale,
				candidate.proposedIntentText ?? null,
				candidate.confidence,
				candidate.valueScore,
				candidate.interruptionCost,
				candidate.urgency,
				candidate.recommendedMode,
				candidate.requiresApproval ? 1 : 0,
				candidate.cooldownKey ?? null,
				candidate.expiresAt ?? null,
				JSON.stringify(candidate.sourceSignalIds),
				JSON.stringify(candidate.sourceMemoryIds),
				JSON.stringify(candidate.sourceIntentIds),
				JSON.stringify(candidate.sourceThreadIds),
				JSON.stringify(candidate.sourceAgendaItemIds),
				candidate.status,
				candidate.scope ? JSON.stringify(candidate.scope) : null,
				candidate.createdAt,
				candidate.deliveredAt ?? null,
				candidate.metadata ? JSON.stringify(candidate.metadata) : null,
			);
	}

	getCandidateById(id: string): ProactiveCandidate | undefined {
		const row = this.db
			.prepare("SELECT * FROM proactive_candidates WHERE id = ?")
			.get(id) as RawCandidateRow | null;
		return row ? toCandidate(row) : undefined;
	}

	updateCandidate(id: string, fields: Partial<ProactiveCandidate>): void {
		updateJsonRecord(this.db, "proactive_candidates", "id", id, fields, {
			messageDraft: "message_draft",
			proposedIntentText: "proposed_intent_text",
			valueScore: "value_score",
			interruptionCost: "interruption_cost",
			recommendedMode: "recommended_mode",
			requiresApproval: "requires_approval",
			cooldownKey: "cooldown_key",
			expiresAt: "expires_at",
			sourceSignalIds: "source_signal_ids",
			sourceMemoryIds: "source_memory_ids",
			sourceIntentIds: "source_intent_ids",
			sourceThreadIds: "source_thread_ids",
			sourceAgendaItemIds: "source_agenda_item_ids",
			createdAt: "created_at",
			deliveredAt: "delivered_at",
		});
	}

	listCandidates(query: ProactiveCandidateQuery = {}): ProactiveCandidate[] {
		const conditions: string[] = [];
		const params: (string | number)[] = [];

		if (query.statuses && query.statuses.length > 0) {
			conditions.push(
				`status IN (${query.statuses.map(() => "?").join(", ")})`,
			);
			params.push(...query.statuses);
		}
		if (query.cooldownKey) {
			conditions.push("cooldown_key = ?");
			params.push(query.cooldownKey);
		}
		if (query.createdAfter) {
			conditions.push("created_at >= ?");
			params.push(query.createdAfter);
		}
		if (query.createdBefore) {
			conditions.push("created_at <= ?");
			params.push(query.createdBefore);
		}
		if (query.deliveredAfter) {
			conditions.push("delivered_at >= ?");
			params.push(query.deliveredAfter);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const limit = query.limit ? `LIMIT ${query.limit}` : "";
		const rows = this.db
			.prepare(
				`SELECT * FROM proactive_candidates ${where}
				 ORDER BY created_at ASC ${limit}`,
			)
			.all(...params) as RawCandidateRow[];
		return rows.map(toCandidate);
	}
}

type ColumnValue = string | number | null;

function updateJsonRecord<T extends Record<string, unknown>>(
	db: Database,
	tableName: string,
	idColumn: string,
	id: string,
	fields: Partial<T>,
	fieldMap: Record<string, string>,
): void {
	const sets: string[] = [];
	const params: ColumnValue[] = [];

	for (const [key, value] of Object.entries(fields)) {
		const column = fieldMap[key] ?? key;
		sets.push(`${column} = ?`);
		if (
			key === "scope" ||
			key === "metadata" ||
			key === "sourceSignalIds" ||
			key === "sourceMemoryIds" ||
			key === "sourceIntentIds" ||
			key === "sourceThreadIds" ||
			key === "sourceAgendaItemIds" ||
			key === "agendaItemIds" ||
			key === "retrievedMemoryIds" ||
			key === "producedCandidateIds"
		) {
			params.push(value ? JSON.stringify(value) : null);
			continue;
		}
		if (key === "requiresApproval") {
			params.push(value === true ? 1 : 0);
			continue;
		}
		params.push((value as ColumnValue | undefined) ?? null);
	}

	if (sets.length === 0) return;
	params.push(id);
	db.prepare(
		`UPDATE ${tableName} SET ${sets.join(", ")} WHERE ${idColumn} = ?`,
	).run(...params);
}

interface RawAgendaRow {
	id: string;
	category: string;
	summary: string;
	driving_question: string;
	priority: number;
	dedupe_key: string;
	due_at: string | null;
	cooldown_until: string | null;
	budget_class: string;
	source_signal_ids: string;
	source_memory_ids: string;
	source_intent_ids: string;
	source_thread_ids: string;
	status: string;
	scope: string | null;
	created_at: string;
	leased_at: string | null;
	lease_owner: string | null;
	last_run_at: string | null;
	run_count: number;
	metadata: string | null;
}

interface RawRunRow {
	id: string;
	agenda_item_ids: string;
	retrieved_memory_ids: string;
	produced_candidate_ids: string;
	model_class: string;
	max_tokens_budget: number;
	tokens_used: number;
	outcome: string;
	started_at: string;
	finished_at: string | null;
	metadata: string | null;
}

interface RawCandidateRow {
	id: string;
	kind: string;
	summary: string;
	message_draft: string;
	rationale: string;
	proposed_intent_text: string | null;
	confidence: number;
	value_score: number;
	interruption_cost: number;
	urgency: string;
	recommended_mode: string;
	requires_approval: number;
	cooldown_key: string | null;
	expires_at: string | null;
	source_signal_ids: string;
	source_memory_ids: string;
	source_intent_ids: string;
	source_thread_ids: string;
	source_agenda_item_ids: string;
	status: string;
	scope: string | null;
	created_at: string;
	delivered_at: string | null;
	metadata: string | null;
}

function toAgendaItem(row: RawAgendaRow): ReflectionAgendaItem {
	return {
		id: row.id,
		category: row.category as ReflectionAgendaItem["category"],
		summary: row.summary,
		drivingQuestion: row.driving_question,
		priority: row.priority,
		dedupeKey: row.dedupe_key,
		dueAt: row.due_at ?? undefined,
		cooldownUntil: row.cooldown_until ?? undefined,
		budgetClass: row.budget_class as ReflectionAgendaItem["budgetClass"],
		sourceSignalIds: parseStringArray(row.source_signal_ids),
		sourceMemoryIds: parseStringArray(row.source_memory_ids),
		sourceIntentIds: parseStringArray(row.source_intent_ids),
		sourceThreadIds: parseStringArray(row.source_thread_ids),
		status: row.status as ReflectionAgendaStatus,
		scope: parseScope(row.scope),
		createdAt: row.created_at,
		leasedAt: row.leased_at ?? undefined,
		leaseOwner: row.lease_owner ?? undefined,
		lastRunAt: row.last_run_at ?? undefined,
		runCount: row.run_count,
		metadata: parseObject<ReflectionAgendaMetadata>(row.metadata),
	};
}

function toReflectionRun(row: RawRunRow): ReflectionRun {
	return {
		id: row.id,
		agendaItemIds: parseStringArray(row.agenda_item_ids),
		retrievedMemoryIds: parseStringArray(row.retrieved_memory_ids),
		producedCandidateIds: parseStringArray(row.produced_candidate_ids),
		modelClass: row.model_class as ReflectionRun["modelClass"],
		maxTokensBudget: row.max_tokens_budget,
		tokensUsed: row.tokens_used,
		outcome: row.outcome as ReflectionRunOutcome,
		startedAt: row.started_at,
		finishedAt: row.finished_at ?? undefined,
		metadata: parseObject<Record<string, unknown>>(row.metadata),
	};
}

function toCandidate(row: RawCandidateRow): ProactiveCandidate {
	return {
		id: row.id,
		kind: row.kind as ProactiveCandidate["kind"],
		summary: row.summary,
		messageDraft: row.message_draft,
		rationale: row.rationale,
		proposedIntentText: row.proposed_intent_text ?? undefined,
		confidence: row.confidence,
		valueScore: row.value_score,
		interruptionCost: row.interruption_cost,
		urgency: row.urgency as ProactiveCandidate["urgency"],
		recommendedMode:
			row.recommended_mode as ProactiveCandidate["recommendedMode"],
		requiresApproval: row.requires_approval === 1,
		cooldownKey: row.cooldown_key ?? undefined,
		expiresAt: row.expires_at ?? undefined,
		sourceSignalIds: parseStringArray(row.source_signal_ids),
		sourceMemoryIds: parseStringArray(row.source_memory_ids),
		sourceIntentIds: parseStringArray(row.source_intent_ids),
		sourceThreadIds: parseStringArray(row.source_thread_ids),
		sourceAgendaItemIds: parseStringArray(row.source_agenda_item_ids),
		status: row.status as ProactiveCandidateStatus,
		scope: parseScope(row.scope),
		createdAt: row.created_at,
		deliveredAt: row.delivered_at ?? undefined,
		metadata: parseObject<ProactiveCandidateMetadata>(row.metadata),
	};
}

function parseStringArray(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const value = JSON.parse(raw) as unknown[];
		return value.filter((item): item is string => typeof item === "string");
	} catch {
		return [];
	}
}

function parseScope(raw: string | null): ChannelScope | undefined {
	if (!raw) return undefined;
	return parseObject<ChannelScope>(raw);
}

function parseObject<T>(raw: string | null): T | undefined {
	if (!raw) return undefined;
	try {
		const value = JSON.parse(raw);
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return value as T;
		}
		return undefined;
	} catch {
		return undefined;
	}
}
