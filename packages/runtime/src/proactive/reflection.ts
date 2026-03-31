import type {
	ChannelScope,
	LLMMessage,
	LLMProvider,
	ProactiveCandidate,
	ProactiveCandidateKind,
	ProactiveCandidateUrgency,
	ProactiveDeliveryMode,
	ReflectionAgendaCategory,
	ReflectionAgendaItem,
	ReflectionAgendaMetadata,
	ReflectionRun,
	RelationshipBoundary,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import {
	StructuredGenerationEngine,
	type StructuredOutputSpec,
} from "../llm/structured.ts";
import type { RetrievedMemory } from "../memory/retrieval.ts";
import { renderMemoryHints } from "../memory/retrieval.ts";
import type { MemoryService } from "../memory/service.ts";

export interface ReflectSignalInput {
	signalId: string;
	signalType: string;
	summary: string;
	confidence: number;
	scope?: ChannelScope;
	threadId?: string;
	suggestedIntentText?: string;
	sourceMemoryIds?: string[];
	relationshipBoundary?: RelationshipBoundary;
	dedupeKey?: string;
}

export interface ReflectAgendaInput {
	agendaItem: ReflectionAgendaItem;
	relationshipBoundary?: RelationshipBoundary;
}

export interface ReflectionServiceOptions {
	llm: LLMProvider;
	memory: MemoryService;
	now?: () => string;
}

export interface ReflectionOutcome {
	agendaItem: ReflectionAgendaItem;
	run: ReflectionRun;
	retrievedMemories: RetrievedMemory[];
	candidate?: ProactiveCandidate;
}

export class ReflectionService {
	private readonly structured: StructuredGenerationEngine;
	private readonly clock: () => string;

	constructor(private readonly options: ReflectionServiceOptions) {
		this.structured = new StructuredGenerationEngine(options.llm);
		this.clock = options.now ?? now;
	}

	async reflectSignal(input: ReflectSignalInput): Promise<ReflectionOutcome> {
		return this.reflectAgenda({
			agendaItem: createSignalAgendaItem(input, this.clock()),
			relationshipBoundary: input.relationshipBoundary,
		});
	}

	async reflectAgenda(input: ReflectAgendaInput): Promise<ReflectionOutcome> {
		const agendaItem = input.agendaItem;
		const metadata = readAgendaMetadata(agendaItem);
		const summary = agendaItem.summary;
		const retrievalQuery = [
			summary,
			metadata.suggestedIntentText ?? "",
			metadata.signalType ?? "",
			metadata.prospectiveTitle ?? "",
			agendaItem.drivingQuestion,
		]
			.filter(Boolean)
			.join("\n");
		const retrievedMemories = this.options.memory.retrieve({
			query: retrievalQuery,
			scope: agendaItem.scope,
			threadId: agendaItem.sourceThreadIds[0],
			limit: 4,
		});
		for (const result of retrievedMemories) {
			this.options.memory.recordAccess(result.entry.id);
		}

		const boundary =
			input.relationshipBoundary ?? createDefaultRelationshipBoundary();
		const startedAt = this.clock();
		const decision = await this.structured.generate({
			spec: proactiveCandidateSpec,
			system: [
				"You are the lower-frequency reflective layer of Nous.",
				"Only emit a proactive candidate when it is genuinely useful, timely, and appropriately restrained.",
				"Prefer silence over low-value interruption.",
				"If you emit an ambient_intent, keep it read-only / investigative unless the inputs clearly justify otherwise.",
			].join("\n"),
			messages: buildReflectionMessages(
				agendaItem,
				boundary,
				retrievedMemories,
			),
			maxTokens: 600,
			temperature: 0.2,
		});

		const candidate = buildCandidateFromDecision({
			decision,
			agendaItem,
			boundary,
			createdAt: this.clock(),
		});

		const run: ReflectionRun = {
			id: prefixedId("refl"),
			agendaItemIds: [agendaItem.id],
			retrievedMemoryIds: retrievedMemories.map((item) => item.entry.id),
			producedCandidateIds: candidate ? [candidate.id] : [],
			modelClass: agendaItem.budgetClass === "deep" ? "strong" : "fast",
			maxTokensBudget: 600,
			tokensUsed: 0,
			outcome: candidate ? "candidate_emitted" : "no_action",
			startedAt,
			finishedAt: this.clock(),
		};

		return {
			agendaItem,
			run,
			retrievedMemories,
			candidate,
		};
	}
}

export function createDefaultRelationshipBoundary(
	overrides: Partial<RelationshipBoundary> = {},
): RelationshipBoundary {
	return {
		assistantStyle: {
			warmth: "balanced",
			directness: "balanced",
			...(overrides.assistantStyle ?? {}),
		},
		proactivityPolicy: {
			initiativeLevel: "balanced",
			allowedKinds: [
				"suggestion",
				"offer",
				"reminder",
				"ambient_intent",
				"silent_watchpoint",
				"protective_intervention",
			],
			blockedKinds: [],
			requireApprovalForKinds: ["ambient_intent", "protective_intervention"],
			...(overrides.proactivityPolicy ?? {}),
		},
		interruptionPolicy: {
			maxUnpromptedMessagesPerDay: 6,
			preferredDelivery: "thread",
			...(overrides.interruptionPolicy ?? {}),
		},
		autonomyPolicy: {
			allowOffersWithoutPrompt: true,
			allowAmbientAutoExecution: false,
			...(overrides.autonomyPolicy ?? {}),
		},
	};
}

function buildReflectionMessages(
	agendaItem: ReflectionAgendaItem,
	boundary: RelationshipBoundary,
	retrievedMemories: RetrievedMemory[],
): LLMMessage[] {
	const metadata = readAgendaMetadata(agendaItem);
	const memoryHints = renderMemoryHints(retrievedMemories);
	return [
		{
			role: "user",
			content: [
				"Reflect on whether Nous should proactively do anything now.",
				`Agenda category: ${agendaItem.category}`,
				`Agenda summary: ${agendaItem.summary}`,
				`Driving question: ${agendaItem.drivingQuestion}`,
				`Signal type: ${metadata.signalType ?? "n/a"}`,
				`Signal confidence: ${metadata.signalConfidence?.toFixed(2) ?? "n/a"}`,
				`Suggested investigative intent: ${metadata.suggestedIntentText ?? "none"}`,
				`Thread: ${agendaItem.sourceThreadIds[0] ?? "none"}`,
				`Scope: projectRoot=${agendaItem.scope?.projectRoot ?? "unknown"}; focusedFile=${agendaItem.scope?.focusedFile ?? "none"}`,
				metadata.prospectiveTitle
					? `Prospective commitment: ${metadata.prospectiveTitle}`
					: undefined,
				metadata.reminderKind
					? `Prospective reminder kind: ${metadata.reminderKind}`
					: undefined,
				`Relationship boundary:\n${JSON.stringify(boundary, null, 2)}`,
				`Retrieved memories:\n${memoryHints.length > 0 ? memoryHints.map((item) => `- ${item}`).join("\n") : "- none"}`,
			]
				.filter(Boolean)
				.join("\n\n"),
		},
	];
}

export function createSignalAgendaItem(
	input: ReflectSignalInput,
	createdAt: string,
): ReflectionAgendaItem {
	const category = mapSignalTypeToAgendaCategory(input.signalType);
	const metadata: ReflectionAgendaMetadata = {
		origin: "signal",
		signalType: input.signalType,
		signalConfidence: input.confidence,
		suggestedIntentText: input.suggestedIntentText,
		sourceMemoryIds: input.sourceMemoryIds ?? [],
	};
	return {
		id: prefixedId("agenda"),
		category,
		summary: input.summary,
		drivingQuestion: buildDrivingQuestion(input.signalType),
		priority: Math.round(Math.min(100, Math.max(1, input.confidence * 100))),
		dedupeKey:
			input.dedupeKey ??
			`${input.signalType}:${input.scope?.projectRoot ?? "workspace"}:${input.scope?.focusedFile ?? "none"}`,
		budgetClass: input.confidence >= 0.85 ? "standard" : "cheap",
		sourceSignalIds: [input.signalId],
		sourceMemoryIds: input.sourceMemoryIds ?? [],
		sourceIntentIds: [],
		sourceThreadIds: input.threadId ? [input.threadId] : [],
		status: "queued",
		scope: input.scope,
		createdAt,
		runCount: 0,
		metadata,
	};
}

function buildDrivingQuestion(signalType: string): string {
	switch (signalType) {
		case "git.branch_changed":
			return "Does this branch change warrant a proactive summary or safe follow-up check?";
		case "git.status_changed":
			return "Is the workspace state change worth surfacing now, or should Nous stay silent?";
		case "fs.file_changed":
		case "fs.file_created":
			return "Does this file change suggest a timely low-risk follow-up or reminder?";
		default:
			return "Is there any useful proactive action here, or is silence better?";
	}
}

function mapSignalTypeToAgendaCategory(
	signalType: string,
): ReflectionAgendaCategory {
	switch (signalType) {
		case "git.branch_changed":
		case "git.status_changed":
		case "fs.file_changed":
		case "fs.file_created":
			return "environment_change";
		default:
			return "follow_up";
	}
}

interface ProactiveCandidateDecision {
	emit: boolean;
	kind?: ProactiveCandidateKind;
	summary?: string;
	messageDraft?: string;
	rationale?: string;
	proposedIntentText?: string;
	confidence?: number;
	valueScore?: number;
	interruptionCost?: number;
	urgency?: ProactiveCandidateUrgency;
	recommendedMode?: ProactiveDeliveryMode;
	requiresApproval?: boolean;
	cooldownKey?: string;
}

const proactiveCandidateSpec: StructuredOutputSpec<ProactiveCandidateDecision> =
	{
		name: "proactive_candidate",
		description:
			"Return whether Nous should proactively emit a candidate now. If not, set emit=false. Keep the response conservative and policy-aware.",
		schema: {
			type: "object",
			properties: {
				emit: { type: "boolean" },
				kind: {
					type: "string",
					enum: [
						"check_in",
						"celebration",
						"reminder",
						"suggestion",
						"offer",
						"ambient_intent",
						"protective_intervention",
						"silent_watchpoint",
					],
				},
				summary: { type: "string" },
				messageDraft: { type: "string" },
				rationale: { type: "string" },
				proposedIntentText: { type: "string" },
				confidence: { type: "number" },
				valueScore: { type: "number" },
				interruptionCost: { type: "number" },
				urgency: {
					type: "string",
					enum: ["low", "normal", "high"],
				},
				recommendedMode: {
					type: "string",
					enum: ["silent", "async_notify", "ask_first", "auto_execute"],
				},
				requiresApproval: { type: "boolean" },
				cooldownKey: { type: "string" },
			},
			required: ["emit"],
			additionalProperties: false,
		},
		validate(value: unknown): ProactiveCandidateDecision {
			if (!isObject(value)) {
				throw new Error("Proactive candidate decision must be an object");
			}

			const emit = value.emit === true;
			const kind = readCandidateKind(value.kind);
			const urgency = readUrgency(value.urgency);
			const recommendedMode = readDeliveryMode(value.recommendedMode);

			return {
				emit,
				kind,
				summary: readOptionalString(value.summary),
				messageDraft: readOptionalString(value.messageDraft),
				rationale: readOptionalString(value.rationale),
				proposedIntentText: readOptionalString(value.proposedIntentText),
				confidence: readOptionalNumber(value.confidence),
				valueScore: readOptionalNumber(value.valueScore),
				interruptionCost: readOptionalNumber(value.interruptionCost),
				urgency,
				recommendedMode,
				requiresApproval: value.requiresApproval === true,
				cooldownKey: readOptionalString(value.cooldownKey),
			};
		},
	};

function buildCandidateFromDecision(input: {
	decision: ProactiveCandidateDecision;
	agendaItem: ReflectionAgendaItem;
	boundary: RelationshipBoundary;
	createdAt: string;
}): ProactiveCandidate | undefined {
	if (!input.decision.emit) return undefined;
	const metadata = readAgendaMetadata(input.agendaItem);
	const kind = input.decision.kind ?? "suggestion";
	if (input.boundary.proactivityPolicy.blockedKinds.includes(kind)) {
		return undefined;
	}
	if (!input.boundary.proactivityPolicy.allowedKinds.includes(kind)) {
		return undefined;
	}

	const requiresApproval =
		input.decision.requiresApproval === true ||
		input.boundary.proactivityPolicy.requireApprovalForKinds.includes(kind);
	const proposedIntentText =
		kind === "ambient_intent"
			? (input.decision.proposedIntentText ?? metadata.suggestedIntentText)
			: undefined;
	if (kind === "ambient_intent" && !proposedIntentText) {
		return undefined;
	}

	let recommendedMode = input.decision.recommendedMode;
	if (!recommendedMode) {
		recommendedMode =
			kind === "ambient_intent"
				? "ask_first"
				: kind === "silent_watchpoint"
					? "silent"
					: "async_notify";
	}

	if (
		kind === "ambient_intent" &&
		recommendedMode === "auto_execute" &&
		!input.boundary.autonomyPolicy.allowAmbientAutoExecution
	) {
		recommendedMode = "ask_first";
	}
	if (
		kind === "offer" &&
		!input.boundary.autonomyPolicy.allowOffersWithoutPrompt &&
		recommendedMode === "auto_execute"
	) {
		recommendedMode = "async_notify";
	}
	if (requiresApproval && recommendedMode === "auto_execute") {
		recommendedMode = "ask_first";
	}

	return {
		id: prefixedId("pcand"),
		kind,
		summary:
			input.decision.summary?.trim() ||
			compactText(input.agendaItem.summary, 140),
		messageDraft:
			input.decision.messageDraft?.trim() ||
			input.decision.summary?.trim() ||
			compactText(input.agendaItem.summary, 220),
		rationale:
			input.decision.rationale?.trim() ||
			"Reflected on a promoted signal and found enough value to surface it.",
		proposedIntentText,
		confidence: clampScore(
			input.decision.confidence ?? metadata.signalConfidence ?? 0.7,
		),
		valueScore: clampScore(
			input.decision.valueScore ?? metadata.signalConfidence ?? 0.7,
		),
		interruptionCost: clampScore(input.decision.interruptionCost ?? 0.35),
		urgency: input.decision.urgency ?? "normal",
		recommendedMode,
		requiresApproval,
		cooldownKey: input.decision.cooldownKey ?? input.agendaItem.dedupeKey,
		sourceSignalIds: [...input.agendaItem.sourceSignalIds],
		sourceMemoryIds: [...input.agendaItem.sourceMemoryIds],
		sourceIntentIds: [],
		sourceThreadIds: [...input.agendaItem.sourceThreadIds],
		sourceAgendaItemIds: [input.agendaItem.id],
		status: "candidate",
		scope: input.agendaItem.scope,
		createdAt: input.createdAt,
		metadata: {
			agendaCategory: input.agendaItem.category,
			agendaOrigin: metadata.origin,
			reminderKind: metadata.reminderKind,
			prospectiveMemoryId: metadata.prospectiveMemoryId,
		},
	};
}

function readAgendaMetadata(
	item: ReflectionAgendaItem,
): ReflectionAgendaMetadata {
	return {
		origin: "scheduler",
		...(item.metadata ?? {}),
	};
}

function clampScore(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function compactText(text: string, maxLength: number): string {
	const compact = text.replace(/\s+/g, " ").trim();
	if (compact.length <= maxLength) return compact;
	return `${compact.slice(0, maxLength - 3)}...`;
}

function readCandidateKind(value: unknown): ProactiveCandidateKind | undefined {
	switch (value) {
		case "check_in":
		case "celebration":
		case "reminder":
		case "suggestion":
		case "offer":
		case "ambient_intent":
		case "protective_intervention":
		case "silent_watchpoint":
			return value;
		default:
			return undefined;
	}
}

function readUrgency(value: unknown): ProactiveCandidateUrgency | undefined {
	switch (value) {
		case "low":
		case "normal":
		case "high":
			return value;
		default:
			return undefined;
	}
}

function readDeliveryMode(value: unknown): ProactiveDeliveryMode | undefined {
	switch (value) {
		case "silent":
		case "async_notify":
		case "ask_first":
		case "auto_execute":
			return value;
		default:
			return undefined;
	}
}

function readOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
