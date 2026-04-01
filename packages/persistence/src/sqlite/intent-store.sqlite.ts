import type { Database } from "bun:sqlite";
import type {
	ApprovalWaitDirective,
	CancellationDirective,
	ExecutionDepthDecision,
	Intent,
	IntentExecutionDirective,
	IntentExecutionDirectiveStatus,
	IntentRevisionRecord,
	IntentStatus,
	PauseDirective,
	PendingIntentCancellation,
	PendingIntentPause,
	PendingIntentRevision,
	ResumeDirective,
	ScopeRevisionDirective,
	TaskContract,
} from "@nous/core";
import type { IntentStore } from "../interfaces/intent-store.ts";

export class SQLiteIntentStore implements IntentStore {
	constructor(private db: Database) {}

	create(intent: Intent): void {
		this.db
			.prepare(
				`INSERT INTO intents (id, raw, goal, constraints, priority, human_checkpoints, metadata, status, source, created_at, achieved_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				intent.id,
				intent.raw,
				JSON.stringify(intent.goal),
				JSON.stringify(intent.constraints),
				intent.priority,
				intent.humanCheckpoints,
				JSON.stringify(serializeIntentMetadata(intent)),
				intent.status,
				intent.source,
				intent.createdAt,
				intent.achievedAt ?? null,
			);
	}

	getById(id: string): Intent | undefined {
		const row = this.db
			.prepare("SELECT * FROM intents WHERE id = ?")
			.get(id) as RawIntentRow | null;
		return row ? toIntent(row) : undefined;
	}

	update(id: string, fields: Partial<Intent>): void {
		const sets: string[] = [];
		const params: (string | number | null)[] = [];

		const fieldMap: Record<string, string> = {
			humanCheckpoints: "human_checkpoints",
			createdAt: "created_at",
			achievedAt: "achieved_at",
		};
		const metadataPatch = extractIntentMetadata(fields);
		if (metadataPatch) {
			const row = this.db
				.prepare("SELECT metadata FROM intents WHERE id = ?")
				.get(id) as { metadata: string } | null;
			const current = deserializeIntentMetadata(row?.metadata);
			sets.push("metadata = ?");
			params.push(JSON.stringify({ ...current, ...metadataPatch }));
		}

		for (const [key, value] of Object.entries(fields)) {
			if (
				key === "contract" ||
				key === "executionDepth" ||
				key === "clarificationQuestions" ||
				key === "workingText" ||
				key === "pendingRevision" ||
				key === "revisionHistory" ||
				key === "executionDirectives" ||
				key === "pendingCancellation" ||
				key === "pendingPause"
			) {
				continue;
			}
			const col = fieldMap[key] ?? key;
			if (key === "goal" || key === "constraints") {
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
			.prepare(`UPDATE intents SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	getByStatus(status: IntentStatus): Intent[] {
		const rows = this.db
			.prepare("SELECT * FROM intents WHERE status = ? ORDER BY created_at ASC")
			.all(status) as RawIntentRow[];
		return rows.map(toIntent);
	}

	getActive(): Intent[] {
		const rows = this.db
			.prepare(
				`SELECT * FROM intents
				 WHERE status IN ('active', 'awaiting_clarification', 'awaiting_decision')
				 ORDER BY created_at ASC`,
			)
			.all() as RawIntentRow[];
		return rows.map(toIntent);
	}
}

interface RawIntentRow {
	id: string;
	raw: string;
	goal: string;
	constraints: string;
	priority: number;
	human_checkpoints: string;
	metadata: string;
	status: string;
	source: string;
	created_at: string;
	achieved_at: string | null;
}

function toIntent(row: RawIntentRow): Intent {
	const metadata = deserializeIntentMetadata(row.metadata);
	return {
		id: row.id,
		flowId: metadata.flowId,
		planGraphId: metadata.planGraphId,
		sourceEnvelopeId: metadata.sourceEnvelopeId,
		raw: row.raw,
		workingText: metadata.workingText,
		goal: JSON.parse(row.goal),
		constraints: JSON.parse(row.constraints),
		priority: row.priority,
		humanCheckpoints: row.human_checkpoints as Intent["humanCheckpoints"],
		contract: metadata.contract,
		executionDepth: metadata.executionDepth,
		clarificationQuestions: metadata.clarificationQuestions,
		revisionHistory: metadata.revisionHistory,
		executionDirectives: metadata.executionDirectives,
		pendingRevision: metadata.pendingRevision,
		pendingCancellation: metadata.pendingCancellation,
		pendingPause: metadata.pendingPause,
		status: row.status as IntentStatus,
		source: row.source as Intent["source"],
		createdAt: row.created_at,
		achievedAt: row.achieved_at ?? undefined,
	};
}

interface IntentMetadata {
	flowId?: string;
	planGraphId?: string;
	sourceEnvelopeId?: string;
	contract?: TaskContract;
	executionDepth?: ExecutionDepthDecision;
	clarificationQuestions?: string[];
	revisionHistory?: IntentRevisionRecord[];
	executionDirectives?: IntentExecutionDirective[];
	workingText?: string;
	pendingRevision?: PendingIntentRevision;
	pendingCancellation?: PendingIntentCancellation;
	pendingPause?: PendingIntentPause;
}

function serializeIntentMetadata(intent: Partial<Intent>): IntentMetadata {
	return {
		flowId: intent.flowId,
		planGraphId: intent.planGraphId,
		sourceEnvelopeId: intent.sourceEnvelopeId,
		contract: intent.contract,
		executionDepth: intent.executionDepth,
		clarificationQuestions: intent.clarificationQuestions,
		revisionHistory: intent.revisionHistory,
		executionDirectives: intent.executionDirectives,
		workingText: intent.workingText,
		pendingRevision: intent.pendingRevision,
		pendingCancellation: intent.pendingCancellation,
		pendingPause: intent.pendingPause,
	};
}

function deserializeIntentMetadata(
	raw: string | undefined | null,
): IntentMetadata {
	if (!raw) return {};
	try {
		const value = JSON.parse(raw) as IntentMetadata;
		return {
			flowId:
				typeof value.flowId === "string" && value.flowId.trim().length > 0
					? value.flowId
					: undefined,
			planGraphId:
				typeof value.planGraphId === "string" &&
				value.planGraphId.trim().length > 0
					? value.planGraphId
					: undefined,
			sourceEnvelopeId:
				typeof value.sourceEnvelopeId === "string" &&
				value.sourceEnvelopeId.trim().length > 0
					? value.sourceEnvelopeId
					: undefined,
			contract: value.contract,
			executionDepth: value.executionDepth,
			clarificationQuestions: Array.isArray(value.clarificationQuestions)
				? value.clarificationQuestions
						.map((item) => String(item).trim())
						.filter(Boolean)
				: undefined,
			revisionHistory: normalizeRevisionHistory(value.revisionHistory),
			executionDirectives: normalizeExecutionDirectives(
				value.executionDirectives,
			),
			pendingRevision: normalizePendingRevision(value.pendingRevision),
			pendingCancellation: normalizePendingCancellation(
				value.pendingCancellation,
			),
			pendingPause: normalizePendingPause(value.pendingPause),
			workingText:
				typeof value.workingText === "string" &&
				value.workingText.trim().length > 0
					? value.workingText
					: undefined,
		};
	} catch {
		return {};
	}
}

function extractIntentMetadata(
	fields: Partial<Intent>,
): Partial<IntentMetadata> | undefined {
	const hasMetadataField =
		"flowId" in fields ||
		"planGraphId" in fields ||
		"sourceEnvelopeId" in fields ||
		"contract" in fields ||
		"executionDepth" in fields ||
		"clarificationQuestions" in fields ||
		"revisionHistory" in fields ||
		"executionDirectives" in fields ||
		"workingText" in fields ||
		"pendingRevision" in fields ||
		"pendingCancellation" in fields ||
		"pendingPause" in fields;
	if (!hasMetadataField) return undefined;
	const patch: Partial<IntentMetadata> = {};
	if ("flowId" in fields) {
		patch.flowId = fields.flowId;
	}
	if ("planGraphId" in fields) {
		patch.planGraphId = fields.planGraphId;
	}
	if ("sourceEnvelopeId" in fields) {
		patch.sourceEnvelopeId = fields.sourceEnvelopeId;
	}
	if ("contract" in fields) {
		patch.contract = fields.contract;
	}
	if ("executionDepth" in fields) {
		patch.executionDepth = fields.executionDepth;
	}
	if ("clarificationQuestions" in fields) {
		patch.clarificationQuestions = fields.clarificationQuestions;
	}
	if ("revisionHistory" in fields) {
		patch.revisionHistory = fields.revisionHistory;
	}
	if ("executionDirectives" in fields) {
		patch.executionDirectives = fields.executionDirectives;
	}
	if ("workingText" in fields) {
		patch.workingText = fields.workingText;
	}
	if ("pendingRevision" in fields) {
		patch.pendingRevision = fields.pendingRevision;
	}
	if ("pendingCancellation" in fields) {
		patch.pendingCancellation = fields.pendingCancellation;
	}
	if ("pendingPause" in fields) {
		patch.pendingPause = fields.pendingPause;
	}
	return patch;
}

function normalizeExecutionDirectives(
	value: unknown,
): IntentExecutionDirective[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const normalized = value
		.map((item) => normalizeExecutionDirective(item))
		.filter((item): item is IntentExecutionDirective => Boolean(item));
	return normalized.length > 0 ? normalized : undefined;
}

function normalizeExecutionDirective(
	value: unknown,
): IntentExecutionDirective | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}

	const candidate = value as Record<string, unknown>;
	const id =
		typeof candidate.id === "string" && candidate.id.trim().length > 0
			? candidate.id
			: undefined;
	const requestedAt =
		typeof candidate.requestedAt === "string" &&
		candidate.requestedAt.trim().length > 0
			? candidate.requestedAt
			: undefined;
	const status: IntentExecutionDirectiveStatus | undefined =
		candidate.status === "requested" ||
		candidate.status === "applied" ||
		candidate.status === "superseded"
			? candidate.status
			: undefined;
	if (!id || !requestedAt || !status) {
		return undefined;
	}

	const base = {
		id,
		requestedAt,
		status,
		sourceMessageIds: Array.isArray(candidate.sourceMessageIds)
			? candidate.sourceMessageIds
					.map((item) => String(item).trim())
					.filter(Boolean)
			: undefined,
		notes: Array.isArray(candidate.notes)
			? candidate.notes.map((item) => String(item).trim()).filter(Boolean)
			: undefined,
		appliedAt:
			typeof candidate.appliedAt === "string" &&
			candidate.appliedAt.trim().length > 0
				? candidate.appliedAt
				: undefined,
	};

	if (candidate.kind === "scope_revision") {
		const revisionText =
			typeof candidate.revisionText === "string"
				? candidate.revisionText.trim()
				: "";
		const applyMode =
			candidate.applyMode === "pre_plan_revise" ||
			candidate.applyMode === "immediate_replan" ||
			candidate.applyMode === "deferred_replan"
				? candidate.applyMode
				: undefined;
		const applyPolicy =
			candidate.applyPolicy === "immediate" ||
			candidate.applyPolicy === "next_execution_boundary"
				? candidate.applyPolicy
				: undefined;
		if (!revisionText || !applyMode || !applyPolicy) {
			return undefined;
		}
		return {
			...base,
			kind: "scope_revision",
			revisionText,
			applyMode,
			applyPolicy,
			revisionIds: Array.isArray(candidate.revisionIds)
				? candidate.revisionIds
						.map((item) => String(item).trim())
						.filter(Boolean)
				: undefined,
		} satisfies ScopeRevisionDirective;
	}

	if (candidate.kind === "cancellation") {
		const mode =
			candidate.mode === "immediate_if_safe" ||
			candidate.mode === "after_current_boundary"
				? candidate.mode
				: undefined;
		if (!mode) {
			return undefined;
		}
		return {
			...base,
			kind: "cancellation",
			reason:
				typeof candidate.reason === "string" &&
				candidate.reason.trim().length > 0
					? candidate.reason.trim()
					: undefined,
			mode,
		} satisfies CancellationDirective;
	}

	if (candidate.kind === "pause") {
		const mode =
			candidate.mode === "immediate" || candidate.mode === "after_current_task"
				? candidate.mode
				: undefined;
		const resumeStatus =
			candidate.resumeStatus === "active" ||
			candidate.resumeStatus === "awaiting_clarification" ||
			candidate.resumeStatus === "awaiting_decision"
				? candidate.resumeStatus
				: undefined;
		if (!mode || !resumeStatus) {
			return undefined;
		}
		return {
			...base,
			kind: "pause",
			reason:
				typeof candidate.reason === "string" &&
				candidate.reason.trim().length > 0
					? candidate.reason.trim()
					: undefined,
			mode,
			resumeStatus,
		} satisfies PauseDirective;
	}

	if (candidate.kind === "resume") {
		return {
			...base,
			kind: "resume",
			reason:
				typeof candidate.reason === "string" &&
				candidate.reason.trim().length > 0
					? candidate.reason.trim()
					: undefined,
		} satisfies ResumeDirective;
	}

	if (candidate.kind === "approval_wait") {
		const reason =
			typeof candidate.reason === "string" && candidate.reason.trim().length > 0
				? candidate.reason.trim()
				: undefined;
		if (!reason || typeof candidate.rollbackAvailable !== "boolean") {
			return undefined;
		}
		return {
			...base,
			kind: "approval_wait",
			reason,
			taskId:
				typeof candidate.taskId === "string" &&
				candidate.taskId.trim().length > 0
					? candidate.taskId.trim()
					: undefined,
			toolNames: Array.isArray(candidate.toolNames)
				? candidate.toolNames.map((item) => String(item).trim()).filter(Boolean)
				: undefined,
			rollbackAvailable: candidate.rollbackAvailable,
		} satisfies ApprovalWaitDirective;
	}

	return undefined;
}

function normalizePendingRevision(
	value: unknown,
): PendingIntentRevision | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}

	const candidate = value as Record<string, unknown>;
	if (candidate.kind !== "scope_update") {
		return undefined;
	}

	const revisionText =
		typeof candidate.revisionText === "string"
			? candidate.revisionText.trim()
			: "";
	const requestedAt =
		typeof candidate.requestedAt === "string" &&
		candidate.requestedAt.trim().length > 0
			? candidate.requestedAt
			: undefined;
	const applyPolicy =
		candidate.applyPolicy === "next_execution_boundary"
			? "next_execution_boundary"
			: undefined;
	if (!revisionText || !requestedAt || !applyPolicy) {
		return undefined;
	}

	return {
		kind: "scope_update",
		revisionText,
		requestedAt,
		applyPolicy,
		revisionIds: Array.isArray(candidate.revisionIds)
			? candidate.revisionIds.map((item) => String(item).trim()).filter(Boolean)
			: undefined,
		sourceMessageIds: Array.isArray(candidate.sourceMessageIds)
			? candidate.sourceMessageIds
					.map((item) => String(item).trim())
					.filter(Boolean)
			: undefined,
	};
}

function normalizePendingCancellation(
	value: unknown,
): PendingIntentCancellation | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const candidate = value as Record<string, unknown>;
	const requestedAt =
		typeof candidate.requestedAt === "string" &&
		candidate.requestedAt.trim().length > 0
			? candidate.requestedAt
			: undefined;
	const mode =
		candidate.mode === "immediate_if_safe" ||
		candidate.mode === "after_current_boundary"
			? candidate.mode
			: undefined;
	if (!requestedAt || !mode) {
		return undefined;
	}

	return {
		requestedAt,
		reason:
			typeof candidate.reason === "string" && candidate.reason.trim().length > 0
				? candidate.reason.trim()
				: undefined,
		mode,
	};
}

function normalizePendingPause(value: unknown): PendingIntentPause | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const candidate = value as Record<string, unknown>;
	const requestedAt =
		typeof candidate.requestedAt === "string" &&
		candidate.requestedAt.trim().length > 0
			? candidate.requestedAt
			: undefined;
	const mode =
		candidate.mode === "immediate" || candidate.mode === "after_current_task"
			? candidate.mode
			: undefined;
	const resumeStatus =
		candidate.resumeStatus === "active" ||
		candidate.resumeStatus === "awaiting_clarification" ||
		candidate.resumeStatus === "awaiting_decision"
			? candidate.resumeStatus
			: undefined;
	if (!requestedAt || !mode || !resumeStatus) {
		return undefined;
	}
	return {
		requestedAt,
		mode,
		resumeStatus,
		reason:
			typeof candidate.reason === "string" && candidate.reason.trim().length > 0
				? candidate.reason.trim()
				: undefined,
	};
}

function normalizeRevisionHistory(
	value: unknown,
): IntentRevisionRecord[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const normalized = value
		.map((item) => normalizeRevisionRecord(item))
		.filter((item): item is IntentRevisionRecord => Boolean(item));
	return normalized.length > 0 ? normalized : undefined;
}

function normalizeRevisionRecord(
	value: unknown,
): IntentRevisionRecord | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}

	const candidate = value as Record<string, unknown>;
	const id =
		typeof candidate.id === "string" && candidate.id.trim().length > 0
			? candidate.id
			: undefined;
	const requestedText =
		typeof candidate.requestedText === "string"
			? candidate.requestedText.trim()
			: "";
	const requestedAt =
		typeof candidate.requestedAt === "string" &&
		candidate.requestedAt.trim().length > 0
			? candidate.requestedAt
			: undefined;
	const status: IntentExecutionDirectiveStatus | undefined =
		candidate.status === "requested" ||
		candidate.status === "applied" ||
		candidate.status === "superseded"
			? candidate.status
			: undefined;
	const applyMode =
		candidate.applyMode === "pre_plan_revise" ||
		candidate.applyMode === "immediate_replan" ||
		candidate.applyMode === "deferred_replan"
			? candidate.applyMode
			: undefined;
	if (!id || !requestedText || !requestedAt || !status || !applyMode) {
		return undefined;
	}

	return {
		id,
		kind: "scope_update",
		requestedText,
		requestedAt,
		status,
		applyMode,
		appliedAt:
			typeof candidate.appliedAt === "string" &&
			candidate.appliedAt.trim().length > 0
				? candidate.appliedAt
				: undefined,
		notes: Array.isArray(candidate.notes)
			? candidate.notes.map((item) => String(item).trim()).filter(Boolean)
			: undefined,
	};
}
