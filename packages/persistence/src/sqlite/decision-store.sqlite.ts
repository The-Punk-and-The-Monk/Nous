import type { Database } from "bun:sqlite";
import type {
	Decision,
	DecisionOption,
	DecisionOutcome,
	DecisionResponseMode,
	DecisionStatus,
} from "@nous/core";
import type { DecisionStore } from "../interfaces/decision-store.ts";

export class SQLiteDecisionStore implements DecisionStore {
	constructor(private readonly db: Database) {}

	create(decision: Decision): void {
		this.db
			.prepare(
				`INSERT INTO decisions (
					id, intent_id, thread_id, kind, summary, questions, status,
					response_mode, options, selected_option_id, outcome, related_intent_ids,
					answer_text, answer_message_id, metadata, created_at, answered_at, resolved_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				decision.id,
				decision.intentId,
				decision.threadId,
				decision.kind,
				decision.summary,
				JSON.stringify(decision.questions),
				decision.status,
				decision.responseMode,
				JSON.stringify(decision.options ?? []),
				decision.selectedOptionId ?? null,
				decision.outcome ?? null,
				JSON.stringify(decision.relatedIntentIds ?? []),
				decision.answerText ?? null,
				decision.answerMessageId ?? null,
				JSON.stringify(decision.metadata ?? {}),
				decision.createdAt,
				decision.answeredAt ?? null,
				decision.resolvedAt ?? null,
			);
	}

	getById(id: string): Decision | undefined {
		const row = this.db
			.prepare("SELECT * FROM decisions WHERE id = ?")
			.get(id) as RawDecisionRow | null;
		return row ? toDecision(row) : undefined;
	}

	update(id: string, fields: Partial<Decision>): void {
		const sets: string[] = [];
		const params: (string | null)[] = [];
		const fieldMap: Record<string, string> = {
			intentId: "intent_id",
			threadId: "thread_id",
			responseMode: "response_mode",
			selectedOptionId: "selected_option_id",
			relatedIntentIds: "related_intent_ids",
			answerText: "answer_text",
			answerMessageId: "answer_message_id",
			createdAt: "created_at",
			answeredAt: "answered_at",
			resolvedAt: "resolved_at",
		};

		for (const [key, value] of Object.entries(fields)) {
			const col = fieldMap[key] ?? key;
			if (
				key === "questions" ||
				key === "metadata" ||
				key === "options" ||
				key === "relatedIntentIds"
			) {
				sets.push(`${col} = ?`);
				if (key === "questions") {
					params.push(JSON.stringify(value ?? []));
					continue;
				}
				if (key === "metadata") {
					params.push(JSON.stringify(value ?? {}));
					continue;
				}
				params.push(JSON.stringify(value ?? []));
				continue;
			}
			sets.push(`${col} = ?`);
			params.push((value as string | undefined | null) ?? null);
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE decisions SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	getByStatus(status: DecisionStatus): Decision[] {
		const rows = this.db
			.prepare(
				"SELECT * FROM decisions WHERE status = ? ORDER BY created_at ASC",
			)
			.all(status) as RawDecisionRow[];
		return rows.map(toDecision);
	}

	getPendingByThread(threadId: string): Decision[] {
		const rows = this.db
			.prepare(
				`SELECT * FROM decisions
				 WHERE thread_id = ? AND status = 'pending'
				 ORDER BY created_at ASC`,
			)
			.all(threadId) as RawDecisionRow[];
		return rows.map(toDecision);
	}

	getQueuedByThread(threadId: string): Decision[] {
		const rows = this.db
			.prepare(
				`SELECT * FROM decisions
				 WHERE thread_id = ? AND status = 'queued'
				 ORDER BY created_at ASC`,
			)
			.all(threadId) as RawDecisionRow[];
		return rows.map(toDecision);
	}

	getPendingByIntent(intentId: string): Decision[] {
		const rows = this.db
			.prepare(
				`SELECT * FROM decisions
				 WHERE intent_id = ? AND status = 'pending'
				 ORDER BY created_at ASC`,
			)
			.all(intentId) as RawDecisionRow[];
		return rows.map(toDecision);
	}
}

interface RawDecisionRow {
	id: string;
	intent_id: string;
	thread_id: string;
	kind: string;
	summary: string;
	questions: string;
	status: string;
	response_mode: string | null;
	options: string | null;
	selected_option_id: string | null;
	outcome: string | null;
	related_intent_ids: string | null;
	answer_text: string | null;
	answer_message_id: string | null;
	metadata: string;
	created_at: string;
	answered_at: string | null;
	resolved_at: string | null;
}

function toDecision(row: RawDecisionRow): Decision {
	return {
		id: row.id,
		intentId: row.intent_id,
		threadId: row.thread_id,
		kind: row.kind as Decision["kind"],
		summary: row.summary,
		questions: safeStringArray(row.questions),
		status: row.status as DecisionStatus,
		responseMode: normalizeResponseMode(row.response_mode),
		options: safeDecisionOptions(row.options),
		selectedOptionId: row.selected_option_id ?? undefined,
		outcome: (row.outcome ?? undefined) as DecisionOutcome | undefined,
		relatedIntentIds: safeStringArray(row.related_intent_ids),
		answerText: row.answer_text ?? undefined,
		answerMessageId: row.answer_message_id ?? undefined,
		metadata: safeObject(row.metadata),
		createdAt: row.created_at,
		answeredAt: row.answered_at ?? undefined,
		resolvedAt: row.resolved_at ?? undefined,
	};
}

function normalizeResponseMode(value: string | null): DecisionResponseMode {
	if (
		value === "free_text" ||
		value === "single_select" ||
		value === "approval"
	) {
		return value;
	}
	return "free_text";
}

function safeStringArray(raw: string | null): string[] {
	if (!raw) return [];
	try {
		return JSON.parse(raw)
			.filter((item: unknown): item is string => typeof item === "string")
			.map((item: string) => item.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

function safeDecisionOptions(raw: string | null): DecisionOption[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown[];
		return parsed
			.map((item) => normalizeDecisionOption(item))
			.filter((item): item is DecisionOption => Boolean(item));
	} catch {
		return [];
	}
}

function normalizeDecisionOption(value: unknown): DecisionOption | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	if (
		typeof record.id !== "string" ||
		typeof record.label !== "string" ||
		typeof record.value !== "string"
	) {
		return undefined;
	}
	return {
		id: record.id,
		label: record.label,
		value: record.value,
		description:
			typeof record.description === "string" ? record.description : undefined,
		recommended: record.recommended === true,
	};
}

function safeObject(raw: string): Record<string, unknown> {
	try {
		const value = JSON.parse(raw);
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return value as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
}
