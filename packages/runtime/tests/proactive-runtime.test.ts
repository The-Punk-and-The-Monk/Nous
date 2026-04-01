import { describe, expect, test } from "bun:test";
import type {
	ProactiveCandidate,
	ReflectionAgendaItem,
	ReflectionOutcome,
	ReflectionRun,
	RelationshipBoundary,
} from "@nous/core";
import {
	SQLiteMemoryStore,
	SQLiteProactiveStore,
	initDatabase,
} from "@nous/persistence";
import { MemoryService } from "../src/memory/service.ts";
import { ProactiveRuntimeService } from "../src/proactive/agenda.ts";

describe("ProactiveRuntimeService", () => {
	test("dedupes repeated signal agendas by dedupe key", () => {
		const db = initDatabase();
		const memory = new MemoryService({
			store: new SQLiteMemoryStore(db),
			agentId: "nous",
		});
		const store = new SQLiteProactiveStore(db);
		const service = new ProactiveRuntimeService({
			store,
			memory,
			now: () => "2026-03-31T08:06:00.000Z",
		});

		const first = service.enqueueSignalAgenda({
			signalId: "sig_1",
			signalType: "fs.file_changed",
			summary: "package.json changed",
			confidence: 0.82,
			dedupeKey: "signal:/repo/app:package.json",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
				focusedFile: "package.json",
			},
		});
		const second = service.enqueueSignalAgenda({
			signalId: "sig_2",
			signalType: "fs.file_changed",
			summary: "package.json changed again",
			confidence: 0.86,
			dedupeKey: "signal:/repo/app:package.json",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
				focusedFile: "package.json",
			},
		});

		expect(first.disposition).toBe("enqueued");
		expect(second.disposition).toBe("existing");
		expect(store.listAgendaItems({ statuses: ["queued"] })).toHaveLength(1);
	});

	test("queues due prospective commitments as agenda items and marks them scheduled", () => {
		const db = initDatabase();
		const memoryStore = new SQLiteMemoryStore(db);
		const memory = new MemoryService({ store: memoryStore, agentId: "nous" });
		const store = new SQLiteProactiveStore(db);
		const service = new ProactiveRuntimeService({
			store,
			memory,
			now: () => "2026-03-31T08:06:00.000Z",
		});

		const entry = memory.ingestProspectiveCommitment({
			title: "Follow up on auth migration",
			detail: "Ask whether the user wants a summary of what remains.",
			threadId: "thread_1",
			intentId: "int_1",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
			remindAt: "2026-03-31T08:05:00.000Z",
		});

		const results = service.enqueueDueProspectiveAgendas({
			lookaheadMs: 10 * 60_000,
		});
		const leased = service.leaseDueAgendaItems(1);

		expect(results[0]?.disposition).toBe("enqueued");
		expect(leased).toHaveLength(1);
		expect(leased[0]?.metadata).toMatchObject({
			origin: "prospective_memory",
			prospectiveMemoryId: entry.id,
			reminderKind: "remind_at",
		});
		expect(
			(memory.getById(entry.id)?.metadata as Record<string, unknown>)
				.fulfillmentStatus,
		).toBe("scheduled");
	});

	test("persists reflection outcomes and governs candidate delivery by cooldown", () => {
		const db = initDatabase();
		const memory = new MemoryService({
			store: new SQLiteMemoryStore(db),
			agentId: "nous",
		});
		const store = new SQLiteProactiveStore(db);
		const service = new ProactiveRuntimeService({
			store,
			memory,
			now: () => "2026-03-31T08:00:00.000Z",
		});
		const boundary: RelationshipBoundary = {
			assistantStyle: {
				warmth: "balanced",
				directness: "balanced",
			},
			proactivityPolicy: {
				initiativeLevel: "balanced",
				allowedKinds: ["suggestion", "offer", "reminder", "ambient_intent"],
				blockedKinds: [],
				requireApprovalForKinds: ["ambient_intent"],
			},
			interruptionPolicy: {
				maxUnpromptedMessagesPerDay: 5,
				preferredDelivery: "thread",
			},
			autonomyPolicy: {
				allowOffersWithoutPrompt: true,
				allowAmbientAutoExecution: false,
			},
		};

		const agenda = makeAgenda();
		store.createAgendaItem(agenda);
		service.recordReflectionOutcome(
			makeOutcome({
				agendaItem: agenda,
				run: makeRun(),
				candidate: makeCandidate(),
			}),
		);

		const firstBatch = service.drainDeliverableCandidates(boundary, 2);
		expect(firstBatch).toHaveLength(1);
		const firstCandidate = firstBatch[0];
		expect(firstCandidate).toBeDefined();
		if (!firstCandidate) {
			throw new Error("Expected first proactive candidate to exist");
		}
		service.markCandidateDelivered(firstCandidate.id);

		store.createAgendaItem(
			makeAgenda({
				id: "agenda_2",
				createdAt: "2026-03-31T08:10:00.000Z",
			}),
		);
		service.recordReflectionOutcome(
			makeOutcome({
				agendaItem: makeAgenda({
					id: "agenda_2",
					createdAt: "2026-03-31T08:10:00.000Z",
				}),
				run: makeRun({
					id: "run_2",
					agendaItemIds: ["agenda_2"],
					startedAt: "2026-03-31T08:10:01.000Z",
					finishedAt: "2026-03-31T08:10:02.000Z",
				}),
				candidate: makeCandidate({
					id: "cand_2",
					createdAt: "2026-03-31T08:10:02.000Z",
				}),
			}),
		);

		const secondBatch = service.drainDeliverableCandidates(boundary, 2);
		expect(secondBatch).toHaveLength(0);
		expect(store.getCandidateById("cand_2")?.status).toBe("dismissed");
	});

	test("applies delivery quotas per scoped boundary when a resolver is provided", () => {
		const db = initDatabase();
		const memory = new MemoryService({
			store: new SQLiteMemoryStore(db),
			agentId: "nous",
		});
		const store = new SQLiteProactiveStore(db);
		const service = new ProactiveRuntimeService({
			store,
			memory,
			now: () => "2026-03-31T08:00:00.000Z",
		});
		const globalBoundary: RelationshipBoundary = {
			assistantStyle: {
				warmth: "balanced",
				directness: "balanced",
			},
			proactivityPolicy: {
				initiativeLevel: "balanced",
				allowedKinds: ["suggestion", "offer", "reminder", "ambient_intent"],
				blockedKinds: [],
				requireApprovalForKinds: ["ambient_intent"],
			},
			interruptionPolicy: {
				maxUnpromptedMessagesPerDay: 5,
				preferredDelivery: "thread",
			},
			autonomyPolicy: {
				allowOffersWithoutPrompt: true,
				allowAmbientAutoExecution: false,
			},
		};

		store.createCandidate(
			makeCandidate({
				id: "cand_project_a_delivered",
				status: "delivered",
				deliveredAt: "2026-03-31T07:30:00.000Z",
				sourceThreadIds: ["thread_a"],
				scope: {
					projectRoot: "/repo/a",
					workingDirectory: "/repo/a",
				},
				cooldownKey: "cand_project_a_delivered",
			}),
		);
		store.createCandidate(
			makeCandidate({
				id: "cand_project_a_queued",
				status: "queued",
				sourceThreadIds: ["thread_a"],
				scope: {
					projectRoot: "/repo/a",
					workingDirectory: "/repo/a",
				},
				cooldownKey: "cand_project_a_queued",
			}),
		);
		store.createCandidate(
			makeCandidate({
				id: "cand_project_b_queued",
				status: "queued",
				sourceThreadIds: ["thread_b"],
				scope: {
					projectRoot: "/repo/b",
					workingDirectory: "/repo/b",
				},
				cooldownKey: "cand_project_b_queued",
			}),
		);

		const deliverable = service.drainDeliverableCandidates(
			globalBoundary,
			4,
			(candidate) => ({
				...globalBoundary,
				interruptionPolicy: {
					...globalBoundary.interruptionPolicy,
					maxUnpromptedMessagesPerDay:
						candidate.scope?.projectRoot === "/repo/a" ? 1 : 2,
				},
			}),
		);

		expect(deliverable.map((candidate) => candidate.id)).toEqual([
			"cand_project_b_queued",
		]);
	});

	test("shares scoped delivery quotas across threads in the same project", () => {
		const db = initDatabase();
		const memory = new MemoryService({
			store: new SQLiteMemoryStore(db),
			agentId: "nous",
		});
		const store = new SQLiteProactiveStore(db);
		const service = new ProactiveRuntimeService({
			store,
			memory,
			now: () => "2026-03-31T08:00:00.000Z",
		});
		const globalBoundary: RelationshipBoundary = {
			assistantStyle: {
				warmth: "balanced",
				directness: "balanced",
			},
			proactivityPolicy: {
				initiativeLevel: "balanced",
				allowedKinds: ["suggestion", "offer", "reminder", "ambient_intent"],
				blockedKinds: [],
				requireApprovalForKinds: ["ambient_intent"],
			},
			interruptionPolicy: {
				maxUnpromptedMessagesPerDay: 5,
				preferredDelivery: "thread",
			},
			autonomyPolicy: {
				allowOffersWithoutPrompt: true,
				allowAmbientAutoExecution: false,
			},
		};

		store.createCandidate(
			makeCandidate({
				id: "cand_project_shared_delivered",
				status: "delivered",
				deliveredAt: "2026-03-31T07:30:00.000Z",
				sourceThreadIds: ["thread_a"],
				scope: {
					projectRoot: "/repo/a",
					workingDirectory: "/repo/a",
				},
				cooldownKey: "cand_project_shared_delivered",
			}),
		);
		store.createCandidate(
			makeCandidate({
				id: "cand_project_shared_queued",
				status: "queued",
				sourceThreadIds: ["thread_b"],
				scope: {
					projectRoot: "/repo/a",
					workingDirectory: "/repo/a",
				},
				cooldownKey: "cand_project_shared_queued",
			}),
		);

		const deliverable = service.drainDeliverableCandidates(
			globalBoundary,
			4,
			(candidate) => ({
				...globalBoundary,
				interruptionPolicy: {
					...globalBoundary.interruptionPolicy,
					maxUnpromptedMessagesPerDay:
						candidate.scope?.projectRoot === "/repo/a" ? 1 : 2,
				},
			}),
		);

		expect(deliverable).toHaveLength(0);
	});

	test("counts delivered candidates by deliveredAt instead of createdAt", () => {
		const db = initDatabase();
		const memory = new MemoryService({
			store: new SQLiteMemoryStore(db),
			agentId: "nous",
		});
		const store = new SQLiteProactiveStore(db);
		const service = new ProactiveRuntimeService({
			store,
			memory,
			now: () => "2026-03-31T08:00:00.000Z",
		});
		const globalBoundary: RelationshipBoundary = {
			assistantStyle: {
				warmth: "balanced",
				directness: "balanced",
			},
			proactivityPolicy: {
				initiativeLevel: "balanced",
				allowedKinds: ["suggestion", "offer", "reminder", "ambient_intent"],
				blockedKinds: [],
				requireApprovalForKinds: ["ambient_intent"],
			},
			interruptionPolicy: {
				maxUnpromptedMessagesPerDay: 1,
				preferredDelivery: "thread",
			},
			autonomyPolicy: {
				allowOffersWithoutPrompt: true,
				allowAmbientAutoExecution: false,
			},
		};

		store.createCandidate(
			makeCandidate({
				id: "cand_cross_day_delivered",
				status: "delivered",
				createdAt: "2026-03-30T23:59:00.000Z",
				deliveredAt: "2026-03-31T00:10:00.000Z",
				sourceThreadIds: ["thread_cross_day"],
				scope: {
					projectRoot: "/repo/a",
					workingDirectory: "/repo/a",
				},
				cooldownKey: "cand_cross_day_delivered",
			}),
		);
		store.createCandidate(
			makeCandidate({
				id: "cand_cross_day_queued",
				status: "queued",
				sourceThreadIds: ["thread_cross_day_2"],
				scope: {
					projectRoot: "/repo/a",
					workingDirectory: "/repo/a",
				},
				cooldownKey: "cand_cross_day_queued",
			}),
		);

		const deliverable = service.drainDeliverableCandidates(
			globalBoundary,
			4,
			(candidate) => globalBoundary,
		);

		expect(deliverable).toHaveLength(0);
	});

	test("uses deliveredAt for cooldown suppression as well", () => {
		const db = initDatabase();
		const memory = new MemoryService({
			store: new SQLiteMemoryStore(db),
			agentId: "nous",
		});
		const store = new SQLiteProactiveStore(db);
		const service = new ProactiveRuntimeService({
			store,
			memory,
			now: () => "2026-03-31T08:00:00.000Z",
		});
		const boundary: RelationshipBoundary = {
			assistantStyle: {
				warmth: "balanced",
				directness: "balanced",
			},
			proactivityPolicy: {
				initiativeLevel: "balanced",
				allowedKinds: ["suggestion", "offer", "reminder", "ambient_intent"],
				blockedKinds: [],
				requireApprovalForKinds: ["ambient_intent"],
			},
			interruptionPolicy: {
				maxUnpromptedMessagesPerDay: 5,
				preferredDelivery: "thread",
			},
			autonomyPolicy: {
				allowOffersWithoutPrompt: true,
				allowAmbientAutoExecution: false,
			},
		};

		store.createCandidate(
			makeCandidate({
				id: "cand_old_created_recently_delivered",
				status: "delivered",
				createdAt: "2026-03-30T10:00:00.000Z",
				deliveredAt: "2026-03-31T07:30:00.000Z",
				cooldownKey: "shared_cooldown_key",
			}),
		);
		store.createCandidate(
			makeCandidate({
				id: "cand_should_be_suppressed",
				status: "queued",
				cooldownKey: "shared_cooldown_key",
			}),
		);

		const deliverable = service.drainDeliverableCandidates(boundary, 4);

		expect(deliverable).toHaveLength(0);
		expect(store.getCandidateById("cand_should_be_suppressed")?.status).toBe(
			"dismissed",
		);
	});
});

function makeAgenda(
	overrides: Partial<ReflectionAgendaItem> = {},
): ReflectionAgendaItem {
	return {
		id: overrides.id ?? "agenda_1",
		category: overrides.category ?? "environment_change",
		summary:
			overrides.summary ??
			"Ambient notice: package metadata changed in /repo/app.",
		drivingQuestion:
			overrides.drivingQuestion ??
			"Does this change deserve a safe proactive follow-up?",
		priority: overrides.priority ?? 82,
		dedupeKey: overrides.dedupeKey ?? "signal:/repo/app:package.json",
		budgetClass: overrides.budgetClass ?? "cheap",
		sourceSignalIds: overrides.sourceSignalIds ?? ["sig_1"],
		sourceMemoryIds: overrides.sourceMemoryIds ?? ["mem_1"],
		sourceIntentIds: overrides.sourceIntentIds ?? [],
		sourceThreadIds: overrides.sourceThreadIds ?? ["thread_1"],
		status: overrides.status ?? "leased",
		scope: overrides.scope ?? {
			projectRoot: "/repo/app",
			workingDirectory: "/repo/app",
			focusedFile: "package.json",
		},
		createdAt: overrides.createdAt ?? "2026-03-31T08:00:00.000Z",
		leasedAt: overrides.leasedAt ?? "2026-03-31T08:00:00.000Z",
		leaseOwner: overrides.leaseOwner ?? "daemon",
		runCount: overrides.runCount ?? 0,
		metadata: overrides.metadata ?? {
			origin: "signal",
			signalType: "fs.file_changed",
			signalConfidence: 0.82,
			suggestedIntentText: "Inspect the package change read-only.",
		},
	};
}

function makeRun(overrides: Partial<ReflectionRun> = {}): ReflectionRun {
	return {
		id: overrides.id ?? "run_1",
		agendaItemIds: overrides.agendaItemIds ?? ["agenda_1"],
		retrievedMemoryIds: overrides.retrievedMemoryIds ?? ["mem_1"],
		producedCandidateIds: overrides.producedCandidateIds ?? ["cand_1"],
		modelClass: overrides.modelClass ?? "fast",
		maxTokensBudget: overrides.maxTokensBudget ?? 600,
		tokensUsed: overrides.tokensUsed ?? 120,
		outcome: overrides.outcome ?? "candidate_emitted",
		startedAt: overrides.startedAt ?? "2026-03-31T08:00:00.000Z",
		finishedAt: overrides.finishedAt ?? "2026-03-31T08:00:01.000Z",
	};
}

function makeCandidate(
	overrides: Partial<ProactiveCandidate> = {},
): ProactiveCandidate {
	return {
		id: overrides.id ?? "cand_1",
		kind: overrides.kind ?? "suggestion",
		summary: overrides.summary ?? "Suggest a follow-up check",
		messageDraft:
			overrides.messageDraft ??
			"Looks like package metadata changed. I can inspect what follow-up checks are worth running.",
		rationale:
			overrides.rationale ??
			"Past memory suggests package metadata changes often deserve a quick follow-up.",
		proposedIntentText: overrides.proposedIntentText,
		confidence: overrides.confidence ?? 0.82,
		valueScore: overrides.valueScore ?? 0.8,
		interruptionCost: overrides.interruptionCost ?? 0.2,
		urgency: overrides.urgency ?? "normal",
		recommendedMode: overrides.recommendedMode ?? "async_notify",
		requiresApproval: overrides.requiresApproval ?? false,
		cooldownKey: overrides.cooldownKey ?? "signal:/repo/app:package.json",
		expiresAt: overrides.expiresAt,
		sourceSignalIds: overrides.sourceSignalIds ?? ["sig_1"],
		sourceMemoryIds: overrides.sourceMemoryIds ?? ["mem_1"],
		sourceIntentIds: overrides.sourceIntentIds ?? [],
		sourceThreadIds: overrides.sourceThreadIds ?? ["thread_1"],
		sourceAgendaItemIds: overrides.sourceAgendaItemIds ?? ["agenda_1"],
		status: overrides.status ?? "candidate",
		scope: overrides.scope ?? {
			projectRoot: "/repo/app",
			workingDirectory: "/repo/app",
		},
		createdAt: overrides.createdAt ?? "2026-03-31T08:00:01.000Z",
		deliveredAt: overrides.deliveredAt,
		metadata: overrides.metadata ?? { agendaOrigin: "signal" },
	};
}

function makeOutcome(overrides: Partial<ReflectionOutcome>): ReflectionOutcome {
	return {
		agendaItem: overrides.agendaItem ?? makeAgenda(),
		run: overrides.run ?? makeRun(),
		retrievedMemories: overrides.retrievedMemories ?? [],
		candidate: overrides.candidate,
	};
}
