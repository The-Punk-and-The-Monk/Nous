import type { ChannelScope, MemoryEntry, MemoryTier } from "@nous/core";
import type { MemoryStore } from "@nous/persistence";

export interface MemoryRetrievalInput {
	query: string;
	agentId?: string;
	scope?: ChannelScope;
	limit?: number;
	candidateLimit?: number;
	tiers?: MemoryTier[];
}

export interface RetrievedMemory {
	entry: MemoryEntry;
	score: number;
	semanticScore: number;
	lexicalScore: number;
	scopeScore: number;
}

const EMBEDDING_DIMENSIONS = 64;
const DEFAULT_LIMIT = 5;
const DEFAULT_CANDIDATE_LIMIT = 100;

export class LocalEmbeddingModel {
	embedText(text: string): number[] {
		const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
		const tokens = tokenize(text);
		if (tokens.length === 0) return vector;

		for (const token of tokens) {
			const hash = hashToken(token);
			const index = Math.abs(hash) % EMBEDDING_DIMENSIONS;
			const sign = hash % 2 === 0 ? 1 : -1;
			vector[index] += sign;
		}

		return normalizeVector(vector);
	}
}

export class HybridMemoryRetriever {
	constructor(
		private readonly store: MemoryStore,
		private readonly embeddingModel = new LocalEmbeddingModel(),
	) {}

	retrieve(input: MemoryRetrievalInput): RetrievedMemory[] {
		const queryEmbedding = this.embeddingModel.embedText(
			buildQueryDocument(input.query, input.scope),
		);
		const candidates = this.store
			.query({
				agentId: input.agentId,
				limit: input.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT,
			})
			.filter((entry) =>
				input.tiers && input.tiers.length > 0
					? input.tiers.includes(entry.tier)
					: true,
			);

		const lexicalQueryTokens = new Set(tokenize(input.query));
		const ranked = candidates
			.map((entry) => {
				const hydrated = this.ensureEmbedding(entry);
				const semanticScore = cosineSimilarity(
					queryEmbedding,
					hydrated.embedding ?? [],
				);
				const lexicalScore = computeLexicalScore(
					lexicalQueryTokens,
					tokenize(buildMemoryDocument(hydrated)),
				);
				const scopeScore = computeScopeScore(hydrated, input.scope);
				const score =
					semanticScore * 0.55 + lexicalScore * 0.3 + scopeScore * 0.15;
				return {
					entry: hydrated,
					score,
					semanticScore,
					lexicalScore,
					scopeScore,
				};
			})
			.filter((item) => item.score > 0)
			.sort((left, right) => right.score - left.score);

		return ranked.slice(0, input.limit ?? DEFAULT_LIMIT);
	}

	private ensureEmbedding(entry: MemoryEntry): MemoryEntry {
		if (entry.embedding && entry.embedding.length > 0) {
			return entry;
		}

		const embedding = this.embeddingModel.embedText(buildMemoryDocument(entry));
		this.store.update(entry.id, { embedding });
		return {
			...entry,
			embedding,
		};
	}
}

export function renderMemoryHints(results: RetrievedMemory[]): string[] {
	return results.map((result) => {
		const score = result.score.toFixed(2);
		return `[${result.entry.tier} score=${score}] ${compactText(result.entry.content, 180)}`;
	});
}

function buildQueryDocument(query: string, scope?: ChannelScope): string {
	return [
		query,
		scope?.projectRoot ?? "",
		scope?.focusedFile ?? "",
		...(scope?.labels ?? []),
	]
		.filter(Boolean)
		.join("\n");
}

function buildMemoryDocument(entry: MemoryEntry): string {
	const metadata = entry.metadata ?? {};
	const tags = Array.isArray(metadata.tags)
		? metadata.tags.map((value) => String(value))
		: [];
	const labels = Array.isArray(metadata.labels)
		? metadata.labels.map((value) => String(value))
		: [];
	const projectRoot =
		typeof metadata.projectRoot === "string" ? metadata.projectRoot : "";
	const threadId =
		typeof metadata.threadId === "string" ? metadata.threadId : "";
	return [
		entry.content,
		projectRoot,
		threadId,
		tags.join(" "),
		labels.join(" "),
	]
		.filter(Boolean)
		.join("\n");
}

function computeLexicalScore(
	queryTokens: Set<string>,
	candidateTokens: string[],
): number {
	if (queryTokens.size === 0 || candidateTokens.length === 0) return 0;
	const candidateSet = new Set(candidateTokens);
	let overlap = 0;
	for (const token of queryTokens) {
		if (candidateSet.has(token)) overlap += 1;
	}
	return overlap / Math.max(queryTokens.size, candidateSet.size, 1);
}

function computeScopeScore(
	entry: MemoryEntry,
	scope: ChannelScope | undefined,
): number {
	if (!scope) return 0;
	const metadata = entry.metadata ?? {};
	const projectRoot =
		typeof metadata.projectRoot === "string" ? metadata.projectRoot : undefined;
	const focusedFile =
		typeof metadata.focusedFile === "string" ? metadata.focusedFile : undefined;
	if (projectRoot && scope.projectRoot && projectRoot === scope.projectRoot) {
		return focusedFile && scope.focusedFile && focusedFile === scope.focusedFile
			? 1
			: 0.7;
	}
	return 0;
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9_./-]+/g)
		.map((token) => normalizeToken(token))
		.filter((token): token is string => Boolean(token));
}

function normalizeToken(token: string): string | undefined {
	const trimmed = token.trim();
	if (!trimmed) return undefined;
	const synonym = SYNONYM_MAP[trimmed];
	if (synonym) return synonym;
	if (trimmed.endsWith("ing") && trimmed.length > 5) {
		return trimmed.slice(0, -3);
	}
	if (trimmed.endsWith("ed") && trimmed.length > 4) {
		return trimmed.slice(0, -2);
	}
	if (trimmed.endsWith("s") && trimmed.length > 3) {
		return trimmed.slice(0, -1);
	}
	return trimmed;
}

function hashToken(token: string): number {
	let hash = 0;
	for (let i = 0; i < token.length; i += 1) {
		hash = (hash << 5) - hash + token.charCodeAt(i);
		hash |= 0;
	}
	return hash;
}

function normalizeVector(vector: number[]): number[] {
	const magnitude = Math.sqrt(
		vector.reduce((sum, value) => sum + value * value, 0),
	);
	if (magnitude === 0) return vector;
	return vector.map((value) => value / magnitude);
}

function cosineSimilarity(left: number[], right: number[]): number {
	if (left.length === 0 || right.length === 0) return 0;
	const size = Math.min(left.length, right.length);
	let dot = 0;
	for (let index = 0; index < size; index += 1) {
		dot += (left[index] ?? 0) * (right[index] ?? 0);
	}
	return dot;
}

function compactText(text: string, maxLength: number): string {
	const compact = text.replace(/\s+/g, " ").trim();
	if (compact.length <= maxLength) return compact;
	return `${compact.slice(0, maxLength - 3)}...`;
}

const SYNONYM_MAP: Record<string, string> = {
	authentication: "auth",
	authorize: "auth",
	authorization: "auth",
	login: "auth",
	logins: "auth",
	tests: "test",
	spec: "test",
	specs: "test",
	bugfix: "fix",
	bugs: "bug",
	readme: "documentation",
	docs: "documentation",
	documentation: "documentation",
};
