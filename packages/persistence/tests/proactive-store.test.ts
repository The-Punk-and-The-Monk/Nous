import { beforeEach, describe, expect, test } from "bun:test";
import type {
	ProactiveCandidate,
	ReflectionAgendaItem,
	ReflectionRun,
} from "@nous/core";
import { initDatabase } from "../src/sqlite/connection.ts";
import { SQLiteProactiveStore } from "../src/sqlite/proactive-store.sqlite.ts";

let store: SQLiteProactiveStore;

beforeEach(() => {
	store = new SQLiteProactiveStore(initDatabase());
});

function makeAgenda(
	overrides: Partial<ReflectionAgendaItem> = {},
): ReflectionAgendaItem {
	return {
		id: overrides.id ?? "agenda_1",
		category: overrides.category ?? "follow_up",
		summary: overrides.summary ?? "Check whether follow-up is useful",
		drivingQuestion:
			overrides.drivingQuestion ??
			"Should Nous say anything proactive right now?",
		priority: overrides.priority ?? 72,
		dedupeKey: overrides.dedupeKey ?? "signal:/repo/app:package.json",
		dueAt: overrides.dueAt,
		cooldownUntil: overrides.cooldownUntil,
		budgetClass: overrides.budgetClass ?? "cheap",
		sourceSignalIds: overrides.sourceSignalIds ?? ["sig_1"],
		sourceMemoryIds: overrides.sourceMemoryIds ?? ["mem_1"],
		sourceIntentIds: overrides.sourceIntentIds ?? [],
		sourceThreadIds: overrides.sourceThreadIds ?? ["thread_1"],
		status: overrides.status ?? "queued",
		scope: overrides.scope ?? {
			projectRoot: "/repo/app",
			workingDirectory: "/repo/app",
			focusedFile: "package.json",
		},
		createdAt: overrides.createdAt ?? "2026-03-31T00:00:00.000Z",
		leasedAt: overrides.leasedAt,
		leaseOwner: overrides.leaseOwner,
		lastRunAt: overrides.lastRunAt,
		runCount: overrides.runCount ?? 0,
		metadata: overrides.metadata ?? {
			origin: "signal",
			signalType: "fs.file_changed",
			signalConfidence: 0.82,
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
		tokensUsed: overrides.tokensUsed ?? 200,
		outcome: overrides.outcome ?? "candidate_emitted",
		startedAt: overrides.startedAt ?? "2026-03-31T00:00:01.000Z",
		finishedAt: overrides.finishedAt ?? "2026-03-31T00:00:02.000Z",
		metadata: overrides.metadata ?? { producer: "test" },
	};
}

function makeCandidate(
	overrides: Partial<ProactiveCandidate> = {},
): ProactiveCandidate {
	return {
		id: overrides.id ?? "cand_1",
		kind: overrides.kind ?? "suggestion",
		summary: overrides.summary ?? "Suggest a safe follow-up",
		messageDraft:
			overrides.messageDraft ?? "I can inspect this change for you.",
		rationale: overrides.rationale ?? "It looks timely and useful.",
		proposedIntentText: overrides.proposedIntentText,
		confidence: overrides.confidence ?? 0.82,
		valueScore: overrides.valueScore ?? 0.78,
		interruptionCost: overrides.interruptionCost ?? 0.28,
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
		status: overrides.status ?? "queued",
		scope: overrides.scope ?? {
			projectRoot: "/repo/app",
			workingDirectory: "/repo/app",
		},
		createdAt: overrides.createdAt ?? "2026-03-31T00:00:03.000Z",
		deliveredAt: overrides.deliveredAt,
		metadata: overrides.metadata ?? { agendaOrigin: "signal" },
	};
}

describe("SQLiteProactiveStore", () => {
	test("round-trips agenda items with metadata and lease fields", () => {
		store.createAgendaItem(
			makeAgenda({
				status: "leased",
				leasedAt: "2026-03-31T00:00:05.000Z",
				leaseOwner: "daemon",
				runCount: 2,
			}),
		);

		const retrieved = store.getAgendaItemById("agenda_1");
		expect(retrieved?.status).toBe("leased");
		expect(retrieved?.leaseOwner).toBe("daemon");
		expect(retrieved?.runCount).toBe(2);
		expect(retrieved?.metadata).toMatchObject({
			origin: "signal",
			signalType: "fs.file_changed",
		});
	});

	test("queries agenda items by status, dedupe key, and due date", () => {
		store.createAgendaItem(
			makeAgenda({
				id: "agenda_due",
				status: "queued",
				dueAt: "2026-03-31T00:10:00.000Z",
				dedupeKey: "due",
			}),
		);
		store.createAgendaItem(
			makeAgenda({
				id: "agenda_later",
				status: "queued",
				dueAt: "2026-03-31T02:00:00.000Z",
				dedupeKey: "later",
			}),
		);

		expect(
			store.listAgendaItems({
				statuses: ["queued"],
				dueBefore: "2026-03-31T01:00:00.000Z",
			}),
		).toHaveLength(1);
		expect(
			store.listAgendaItems({
				dedupeKey: "later",
			})[0]?.id,
		).toBe("agenda_later");
	});

	test("round-trips reflection runs", () => {
		store.createRun(makeRun());

		const retrieved = store.getRunById("run_1");
		expect(retrieved?.agendaItemIds).toEqual(["agenda_1"]);
		expect(retrieved?.metadata).toMatchObject({ producer: "test" });
	});

	test("round-trips proactive candidates and supports status queries", () => {
		store.createCandidate(
			makeCandidate({ id: "cand_queued", status: "queued" }),
		);
		store.createCandidate(
			makeCandidate({
				id: "cand_delivered",
				status: "delivered",
				createdAt: "2026-03-31T03:00:00.000Z",
				deliveredAt: "2026-03-31T03:00:10.000Z",
			}),
		);

		const queued = store.listCandidates({ statuses: ["queued"] });
		expect(queued).toHaveLength(1);
		expect(queued[0]?.id).toBe("cand_queued");

		const delivered = store.getCandidateById("cand_delivered");
		expect(delivered?.status).toBe("delivered");
		expect(delivered?.deliveredAt).toBe("2026-03-31T03:00:10.000Z");
	});
});
