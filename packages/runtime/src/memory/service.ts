import type {
	ChannelScope,
	EpisodicMemoryMetadata,
	MemoryEntry,
	MemoryEvidenceRef,
	MemoryProvenance,
	MemorySourceKind,
	MemorySourceRef,
	MemoryTier,
	SemanticMemoryMetadata,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { MemoryStore } from "@nous/persistence";
import {
	HybridMemoryRetriever,
	type MemoryRetrievalInput,
	type RetrievedMemory,
	renderMemoryHints,
} from "./retrieval.ts";

const DEFAULT_AGENT_ID = "nous";
const MAX_RETENTION_SCORE = 3;

export interface MemoryServiceOptions {
	store: MemoryStore;
	agentId?: string;
	retriever?: HybridMemoryRetriever;
}

export interface IngestHumanIntentInput {
	threadId: string;
	text: string;
	scope: ChannelScope;
	intentId?: string;
}

export interface IngestIntentOutcomeInput {
	intentId: string;
	intentText: string;
	outcome: "intent.achieved" | "escalation";
	scope?: ChannelScope;
	threadId?: string;
	outputs?: string[];
}

export interface MemoryContextQuery
	extends Omit<MemoryRetrievalInput, "agentId"> {
	recordAccess?: boolean;
}

export class MemoryService {
	private readonly agentId: string;
	private readonly retriever: HybridMemoryRetriever;

	constructor(private readonly options: MemoryServiceOptions) {
		this.agentId = options.agentId ?? DEFAULT_AGENT_ID;
		this.retriever =
			options.retriever ?? new HybridMemoryRetriever(this.options.store);
	}

	ingestHumanIntent(input: IngestHumanIntentInput): MemoryEntry {
		const createdAt = now();
		const metadata: EpisodicMemoryMetadata = {
			schemaVersion: "memory.v1",
			sourceKind: "human_intent",
			threadId: input.threadId,
			intentId: input.intentId,
			projectRoot: input.scope.projectRoot,
			focusedFile: input.scope.focusedFile,
			labels: input.scope.labels ?? [],
			tags: ["human", "intent"],
			provenance: this.buildProvenance({
				source: "human_intent",
				observedAt: createdAt,
				sourceRefs: compactRefs([
					{ kind: "thread", id: input.threadId },
					input.intentId ? { kind: "intent", id: input.intentId } : undefined,
				]),
			}),
		};

		return this.store({
			id: prefixedId("mem"),
			tier: "episodic",
			agentId: this.agentId,
			content: `User intent: ${input.text}`,
			metadata,
			createdAt,
			lastAccessedAt: createdAt,
			accessCount: 0,
			retentionScore: 1,
		});
	}

	ingestIntentOutcome(input: IngestIntentOutcomeInput): MemoryEntry {
		const createdAt = now();
		const isAchieved = input.outcome === "intent.achieved";
		const tier: MemoryTier = isAchieved ? "semantic" : "episodic";
		const metadata: EpisodicMemoryMetadata | SemanticMemoryMetadata = isAchieved
			? {
					schemaVersion: "memory.v1",
					sourceKind: "intent_outcome",
					threadId: input.threadId,
					intentId: input.intentId,
					projectRoot: input.scope?.projectRoot,
					focusedFile: input.scope?.focusedFile,
					labels: input.scope?.labels ?? [],
					tags: ["intent", "outcome", "achieved"],
					factType: "outcome_summary",
					confidence: 0.8,
					provenance: this.buildProvenance({
						source: "intent_outcome",
						observedAt: createdAt,
						confidence: 0.8,
						sourceRefs: compactRefs([
							{ kind: "intent", id: input.intentId },
							input.threadId
								? { kind: "thread", id: input.threadId }
								: undefined,
						]),
						evidenceRefs: compactEvidenceRefs([
							{ kind: "intent", id: input.intentId, role: "source" },
						]),
					}),
				}
			: {
					schemaVersion: "memory.v1",
					sourceKind: "intent_outcome",
					threadId: input.threadId,
					intentId: input.intentId,
					projectRoot: input.scope?.projectRoot,
					focusedFile: input.scope?.focusedFile,
					labels: input.scope?.labels ?? [],
					tags: ["intent", "outcome", "escalated"],
					outcomeStatus: "escalated",
					provenance: this.buildProvenance({
						source: "intent_outcome",
						observedAt: createdAt,
						confidence: 0.55,
						sourceRefs: compactRefs([
							{ kind: "intent", id: input.intentId },
							input.threadId
								? { kind: "thread", id: input.threadId }
								: undefined,
						]),
						evidenceRefs: compactEvidenceRefs([
							{ kind: "intent", id: input.intentId, role: "source" },
						]),
					}),
				};

		return this.store({
			id: prefixedId("mem"),
			tier,
			agentId: this.agentId,
			content: buildIntentOutcomeContent(input),
			metadata,
			createdAt,
			lastAccessedAt: createdAt,
			accessCount: 0,
			retentionScore: isAchieved ? 1.2 : 0.8,
		});
	}

	retrieve(input: MemoryContextQuery): RetrievedMemory[] {
		return this.retriever.retrieve({
			...input,
			agentId: this.agentId,
		});
	}

	retrieveForContext(input: MemoryContextQuery): string[] {
		const results = this.retrieve(input);
		if (input.recordAccess !== false) {
			this.recordAccessBatch(results.map((result) => result.entry.id));
		}
		return renderMemoryHints(results);
	}

	recordAccess(memoryId: string): void {
		const entry = this.options.store.getById(memoryId);
		if (!entry) return;
		this.options.store.update(memoryId, {
			lastAccessedAt: now(),
			accessCount: entry.accessCount + 1,
			retentionScore: Math.min(
				entry.retentionScore + 0.05,
				MAX_RETENTION_SCORE,
			),
		});
	}

	private store(entry: MemoryEntry): MemoryEntry {
		this.options.store.store(entry);
		return entry;
	}

	private recordAccessBatch(memoryIds: string[]): void {
		for (const memoryId of memoryIds) {
			this.recordAccess(memoryId);
		}
	}

	private buildProvenance(input: {
		source: MemorySourceKind;
		observedAt: string;
		sourceRefs?: MemorySourceRef[];
		evidenceRefs?: MemoryEvidenceRef[];
		parentMemoryIds?: string[];
		confidence?: number;
	}): MemoryProvenance {
		return {
			source: input.source,
			observedAt: input.observedAt,
			producer: {
				layer: "runtime",
				name: "MemoryService",
				version: "v1",
			},
			sourceRefs: input.sourceRefs,
			evidenceRefs: input.evidenceRefs,
			parentMemoryIds: input.parentMemoryIds,
			confidence: input.confidence,
		};
	}
}

function buildIntentOutcomeContent(input: IngestIntentOutcomeInput): string {
	const outputs = (input.outputs ?? [])
		.filter(Boolean)
		.slice(-3)
		.map((output, index) => `Output ${index + 1}: ${compactText(output, 280)}`);

	return [
		`Intent outcome: ${input.outcome === "intent.achieved" ? "achieved" : "escalated"}`,
		`Intent: ${input.intentText}`,
		outputs.join("\n") || "No task output captured.",
	].join("\n");
}

function compactText(text: string, maxLength: number): string {
	const compact = text.replace(/\s+/g, " ").trim();
	if (compact.length <= maxLength) return compact;
	return `${compact.slice(0, maxLength - 3)}...`;
}

function compactRefs(
	refs: Array<MemorySourceRef | undefined>,
): MemorySourceRef[] | undefined {
	const compact = refs.filter((ref): ref is MemorySourceRef => Boolean(ref));
	return compact.length > 0 ? compact : undefined;
}

function compactEvidenceRefs(
	refs: Array<MemoryEvidenceRef | undefined>,
): MemoryEvidenceRef[] | undefined {
	const compact = refs.filter((ref): ref is MemoryEvidenceRef => Boolean(ref));
	return compact.length > 0 ? compact : undefined;
}
