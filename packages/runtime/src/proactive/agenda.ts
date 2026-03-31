import type {
	ChannelScope,
	ProactiveCandidate,
	ReflectionAgendaItem,
	ReflectionAgendaMetadata,
	RelationshipBoundary,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { ProactiveStore } from "@nous/persistence";
import type {
	DueProspectiveCommitment,
	MemoryService,
} from "../memory/service.ts";
import type { ReflectSignalInput, ReflectionOutcome } from "./reflection.ts";
import { createSignalAgendaItem } from "./reflection.ts";

const DEFAULT_LOOKAHEAD_MS = 15 * 60_000;
const DEFAULT_LEASE_MS = 5 * 60_000;
const DEFAULT_NO_ACTION_COOLDOWN_MS = 15 * 60_000;
const DEFAULT_CANDIDATE_COOLDOWN_MS = 2 * 60 * 60_000;
const DEFAULT_DELIVERY_COOLDOWN_MS = 6 * 60 * 60_000;

export interface ProactiveRuntimeServiceOptions {
	store: ProactiveStore;
	memory: MemoryService;
	now?: () => string;
	leaseOwner?: string;
	leaseMs?: number;
	lookaheadMs?: number;
	noActionCooldownMs?: number;
	candidateCooldownMs?: number;
	deliveryCooldownMs?: number;
}

export type AgendaEnqueueDisposition = "enqueued" | "existing" | "suppressed";

export interface AgendaEnqueueResult {
	disposition: AgendaEnqueueDisposition;
	item?: ReflectionAgendaItem;
	reason?: string;
}

export class ProactiveRuntimeService {
	private readonly clock: () => string;
	private readonly leaseOwner: string;
	private readonly leaseMs: number;
	private readonly lookaheadMs: number;
	private readonly noActionCooldownMs: number;
	private readonly candidateCooldownMs: number;
	private readonly deliveryCooldownMs: number;

	constructor(private readonly options: ProactiveRuntimeServiceOptions) {
		this.clock = options.now ?? now;
		this.leaseOwner = options.leaseOwner ?? "daemon";
		this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
		this.lookaheadMs = options.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
		this.noActionCooldownMs =
			options.noActionCooldownMs ?? DEFAULT_NO_ACTION_COOLDOWN_MS;
		this.candidateCooldownMs =
			options.candidateCooldownMs ?? DEFAULT_CANDIDATE_COOLDOWN_MS;
		this.deliveryCooldownMs =
			options.deliveryCooldownMs ?? DEFAULT_DELIVERY_COOLDOWN_MS;
	}

	enqueueSignalAgenda(input: ReflectSignalInput): AgendaEnqueueResult {
		return this.queueAgenda(createSignalAgendaItem(input, this.clock()), {
			updateProspectiveStatus: false,
		});
	}

	enqueueDueProspectiveAgendas(
		input: {
			scope?: ChannelScope;
			lookaheadMs?: number;
		} = {},
	): AgendaEnqueueResult[] {
		const commitments = this.options.memory.findDueProspectiveCommitments({
			now: this.clock(),
			lookaheadMs: input.lookaheadMs ?? this.lookaheadMs,
			scope: input.scope,
		});
		return commitments.map((commitment) =>
			this.queueAgenda(createProspectiveAgendaItem(commitment, this.clock()), {
				updateProspectiveStatus: true,
			}),
		);
	}

	releaseStaleLeases(referenceTime = this.clock()): void {
		const leased = this.options.store.listAgendaItems({
			statuses: ["leased"],
		});
		const staleBefore = Date.parse(referenceTime) - this.leaseMs;
		for (const item of leased) {
			if (!item.leasedAt) continue;
			if (Date.parse(item.leasedAt) > staleBefore) continue;
			this.options.store.updateAgendaItem(item.id, {
				status: "queued",
				leasedAt: undefined,
				leaseOwner: undefined,
			});
		}
	}

	leaseDueAgendaItems(limit = 4): ReflectionAgendaItem[] {
		const referenceTime = this.clock();
		this.releaseStaleLeases(referenceTime);
		const queued = this.options.store
			.listAgendaItems({
				statuses: ["queued"],
				dueBefore: referenceTime,
			})
			.filter(
				(item) =>
					!item.cooldownUntil ||
					Date.parse(item.cooldownUntil) <= Date.parse(referenceTime),
			)
			.slice(0, limit);

		for (const item of queued) {
			this.options.store.updateAgendaItem(item.id, {
				status: "leased",
				leasedAt: referenceTime,
				leaseOwner: this.leaseOwner,
			});
		}

		return queued
			.map((item) => this.options.store.getAgendaItemById(item.id) ?? item)
			.filter(Boolean);
	}

	recordReflectionOutcome(outcome: ReflectionOutcome): {
		runId: string;
		candidateId?: string;
	} {
		const agenda =
			this.options.store.getAgendaItemById(outcome.agendaItem.id) ??
			outcome.agendaItem;
		let candidateId: string | undefined;
		let run = outcome.run;

		if (outcome.candidate) {
			const queuedCandidate: ProactiveCandidate = {
				...outcome.candidate,
				status: "queued",
			};
			this.options.store.createCandidate(queuedCandidate);
			candidateId = queuedCandidate.id;
			run = {
				...run,
				producedCandidateIds: [queuedCandidate.id],
				outcome: "candidate_emitted",
			};
		} else {
			run = {
				...run,
				producedCandidateIds: [],
				outcome: "no_action",
			};
		}

		this.options.store.createRun(run);
		this.options.store.updateAgendaItem(agenda.id, {
			status: outcome.candidate ? "synthesized" : "dismissed",
			leasedAt: undefined,
			leaseOwner: undefined,
			lastRunAt: run.finishedAt ?? this.clock(),
			runCount: (agenda.runCount ?? 0) + 1,
			cooldownUntil: addMilliseconds(
				run.finishedAt ?? this.clock(),
				outcome.candidate ? this.candidateCooldownMs : this.noActionCooldownMs,
			),
		});

		const agendaMetadata = readAgendaMetadata(agenda);
		if (agendaMetadata.prospectiveMemoryId && outcome.candidate) {
			this.options.memory.updateProspectiveCommitment(
				agendaMetadata.prospectiveMemoryId,
				{
					fulfillmentStatus: "scheduled",
				},
			);
		}

		return {
			runId: run.id,
			candidateId,
		};
	}

	drainDeliverableCandidates(
		boundary: RelationshipBoundary,
		limit = 4,
	): ProactiveCandidate[] {
		const referenceTime = this.clock();
		let deliveredToday = this.options.store.listCandidates({
			statuses: ["delivered", "converted"],
			createdAfter: startOfDay(referenceTime),
		}).length;

		const queued = this.options.store.listCandidates({
			statuses: ["queued"],
		});
		const deliverable: ProactiveCandidate[] = [];

		for (const candidate of queued) {
			if (
				candidate.expiresAt &&
				Date.parse(candidate.expiresAt) <= Date.parse(referenceTime)
			) {
				this.options.store.updateCandidate(candidate.id, {
					status: "expired",
				});
				continue;
			}

			if (candidate.cooldownKey) {
				const recentWithSameKey = this.options.store
					.listCandidates({
						statuses: ["delivered", "converted"],
						cooldownKey: candidate.cooldownKey,
						createdAfter: addMilliseconds(
							referenceTime,
							-this.deliveryCooldownMs,
						),
					})
					.filter((item) => item.id !== candidate.id);
				if (recentWithSameKey.length > 0) {
					this.options.store.updateCandidate(candidate.id, {
						status: "dismissed",
						metadata: {
							...(candidate.metadata ?? {}),
							suppressedReason: "candidate_cooldown",
						},
					});
					continue;
				}
			}

			if (
				deliveredToday >=
				boundary.interruptionPolicy.maxUnpromptedMessagesPerDay
			) {
				break;
			}

			deliverable.push(candidate);
			deliveredToday += 1;
			if (deliverable.length >= limit) {
				break;
			}
		}

		return deliverable;
	}

	markCandidateDelivered(candidateId: string): void {
		this.options.store.updateCandidate(candidateId, {
			status: "delivered",
			deliveredAt: this.clock(),
		});
	}

	markCandidateConverted(candidateId: string): void {
		this.options.store.updateCandidate(candidateId, {
			status: "converted",
			deliveredAt: this.clock(),
		});
	}

	markCandidateDismissed(candidateId: string, reason: string): void {
		const existing = this.options.store.getCandidateById(candidateId);
		this.options.store.updateCandidate(candidateId, {
			status: "dismissed",
			metadata: {
				...(existing?.metadata ?? {}),
				suppressedReason: reason,
			},
		});
	}

	private queueAgenda(
		item: ReflectionAgendaItem,
		options: { updateProspectiveStatus: boolean },
	): AgendaEnqueueResult {
		const referenceTime = this.clock();
		const existingActive = this.options.store
			.listAgendaItems({
				statuses: ["queued", "leased"],
				dedupeKey: item.dedupeKey,
				limit: 1,
			})
			.at(0);
		if (existingActive) {
			return {
				disposition: "existing",
				item: existingActive,
				reason: "active_duplicate",
			};
		}

		const recentTerminal = this.options.store
			.listAgendaItems({
				statuses: ["synthesized", "dismissed"],
				dedupeKey: item.dedupeKey,
				limit: 1,
			})
			.at(0);
		if (
			recentTerminal?.cooldownUntil &&
			Date.parse(recentTerminal.cooldownUntil) > Date.parse(referenceTime)
		) {
			return {
				disposition: "suppressed",
				item: recentTerminal,
				reason: "agenda_cooldown",
			};
		}

		this.options.store.createAgendaItem(item);
		const stored = this.options.store.getAgendaItemById(item.id) ?? item;
		if (options.updateProspectiveStatus) {
			const metadata = readAgendaMetadata(stored);
			if (metadata.prospectiveMemoryId) {
				this.options.memory.updateProspectiveCommitment(
					metadata.prospectiveMemoryId,
					{
						fulfillmentStatus: "scheduled",
					},
				);
			}
		}
		return {
			disposition: "enqueued",
			item: stored,
		};
	}
}

function createProspectiveAgendaItem(
	commitment: DueProspectiveCommitment,
	createdAt: string,
): ReflectionAgendaItem {
	const metadata = commitment.entry.metadata as Record<string, unknown>;
	const threadId =
		typeof metadata.threadId === "string" ? metadata.threadId : undefined;
	const projectRoot =
		typeof metadata.projectRoot === "string" ? metadata.projectRoot : undefined;
	const reminderKind = resolveReminderKind(commitment, createdAt);
	const summary = buildProspectiveSummary(commitment, reminderKind);
	const reminderAt = commitment.remindAt ?? commitment.dueAt ?? createdAt;
	const agendaMetadata: ReflectionAgendaMetadata = {
		origin: "prospective_memory",
		prospectiveMemoryId: commitment.entry.id,
		prospectiveTitle: commitment.title,
		reminderKind,
		sourceMemoryIds: [commitment.entry.id],
	};

	return {
		id: prefixedId("agenda"),
		category: "deadline",
		summary,
		drivingQuestion:
			"Is there a timely reminder, check-in, or safe follow-up that would genuinely help the user honor this commitment?",
		priority:
			reminderKind === "overdue" ? 95 : reminderKind === "due_at" ? 85 : 72,
		dedupeKey: `prospective:${commitment.entry.id}:${reminderKind}`,
		dueAt: reminderAt,
		budgetClass:
			reminderKind === "overdue" || metadata.blocking === true
				? "standard"
				: "cheap",
		sourceSignalIds: [],
		sourceMemoryIds: [commitment.entry.id],
		sourceIntentIds:
			typeof metadata.intentId === "string" ? [metadata.intentId] : [],
		sourceThreadIds: threadId ? [threadId] : [],
		status: "queued",
		scope: projectRoot
			? {
					projectRoot,
					workingDirectory:
						typeof metadata.projectRoot === "string"
							? metadata.projectRoot
							: projectRoot,
					focusedFile:
						typeof metadata.focusedFile === "string"
							? metadata.focusedFile
							: undefined,
				}
			: undefined,
		createdAt,
		runCount: 0,
		metadata: agendaMetadata,
	};
}

function resolveReminderKind(
	commitment: DueProspectiveCommitment,
	referenceTime: string,
): ReflectionAgendaMetadata["reminderKind"] {
	const dueAt = commitment.dueAt ? Date.parse(commitment.dueAt) : Number.NaN;
	if (!Number.isNaN(dueAt) && dueAt < Date.parse(referenceTime)) {
		return "overdue";
	}
	if (commitment.remindAt) {
		return "remind_at";
	}
	return commitment.reminderKind;
}

function buildProspectiveSummary(
	commitment: DueProspectiveCommitment,
	reminderKind: ReflectionAgendaMetadata["reminderKind"],
): string {
	switch (reminderKind) {
		case "overdue":
			return `A prospective commitment looks overdue: ${commitment.title}`;
		case "remind_at":
			return `A scheduled reminder window opened for: ${commitment.title}`;
		default:
			return `A prospective commitment is nearing its due time: ${commitment.title}`;
	}
}

function readAgendaMetadata(
	item: ReflectionAgendaItem,
): ReflectionAgendaMetadata {
	return {
		origin: "scheduler",
		...(item.metadata ?? {}),
	};
}

function addMilliseconds(timestamp: string, deltaMs: number): string {
	return new Date(Date.parse(timestamp) + deltaMs).toISOString();
}

function startOfDay(timestamp: string): string {
	const date = new Date(timestamp);
	date.setHours(0, 0, 0, 0);
	return date.toISOString();
}
