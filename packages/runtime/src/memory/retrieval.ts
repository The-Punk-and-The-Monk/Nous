import type { ChannelScope, MemoryEntry, MemoryTier } from "@nous/core";
import type { MemoryStore } from "@nous/persistence";

export interface MemoryRetrievalInput {
	query: string;
	agentId?: string;
	scope?: ChannelScope;
	threadId?: string;
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
	provenanceScore: number;
	excerpt: string;
	chunkIndex: number;
	chunkCount: number;
}

const EMBEDDING_DIMENSIONS = 256;
const DEFAULT_LIMIT = 12;
const DEFAULT_CANDIDATE_LIMIT = 200;
const CHUNK_TOKEN_LIMIT = 96;
const CHUNK_TOKEN_OVERLAP = 24;

export class LocalEmbeddingModel {
	embedText(text: string): number[] {
		const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
		const tokens = tokenize(text);
		if (tokens.length === 0) return vector;

		// Unigrams
		for (const token of tokens) {
			const hash = hashToken(token);
			const index = Math.abs(hash) % EMBEDDING_DIMENSIONS;
			const sign = hash % 2 === 0 ? 1 : -1;
			vector[index] += sign;
		}

		// Bigrams — capture phrase-level signal
		for (let i = 0; i < tokens.length - 1; i++) {
			const bigram = `${tokens[i]}__${tokens[i + 1]}`;
			const hash = hashToken(bigram);
			const index = Math.abs(hash) % EMBEDDING_DIMENSIONS;
			const sign = hash % 2 === 0 ? 1 : -1;
			vector[index] += sign * 0.7;
		}

		// CJK character-level n-grams (Chinese/Japanese/Korean)
		const cjkChars = text.replace(/[^\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, "");
		for (let i = 0; i < cjkChars.length; i++) {
			const ch = cjkChars[i];
			const hash = hashToken(ch);
			const index = Math.abs(hash) % EMBEDDING_DIMENSIONS;
			vector[index] += 1;
			// CJK bigrams
			if (i < cjkChars.length - 1) {
				const cjkBigram = cjkChars.slice(i, i + 2);
				const biHash = hashToken(cjkBigram);
				const biIndex = Math.abs(biHash) % EMBEDDING_DIMENSIONS;
				vector[biIndex] += 0.8;
			}
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
			buildQueryDocument(input.query, input.scope, input.threadId),
		);
		const candidates = this.collectCandidates(input).filter((entry) =>
			input.tiers && input.tiers.length > 0
				? input.tiers.includes(entry.tier)
				: true,
		);

		const lexicalQueryTokens = new Set(tokenize(input.query));
		const ranked = candidates
			.map((entry) => {
				const hydrated = this.ensureEmbedding(entry);
				const bestChunk = selectBestChunk({
					entry: hydrated,
					queryEmbedding,
					queryTokens: lexicalQueryTokens,
					scope: input.scope,
					threadId: input.threadId,
					embeddingModel: this.embeddingModel,
				});
				const score =
					bestChunk.semanticScore * 0.45 +
					bestChunk.lexicalScore * 0.22 +
					bestChunk.scopeScore * 0.18 +
					bestChunk.provenanceScore * 0.1 +
					computeRetentionScore(hydrated) * 0.05;
				return {
					entry: hydrated,
					score,
					semanticScore: bestChunk.semanticScore,
					lexicalScore: bestChunk.lexicalScore,
					scopeScore: bestChunk.scopeScore,
					provenanceScore: bestChunk.provenanceScore,
					excerpt: bestChunk.excerpt,
					chunkIndex: bestChunk.chunkIndex,
					chunkCount: bestChunk.chunkCount,
				};
			})
			.filter(
				(item) =>
					item.semanticScore > 0 ||
					item.lexicalScore > 0 ||
					item.scopeScore > 0,
			)
			.sort((left, right) => {
				if (right.score !== left.score) return right.score - left.score;
				return (
					(right.entry.lastAccessedAt || "").localeCompare(
						left.entry.lastAccessedAt || "",
					) || right.entry.createdAt.localeCompare(left.entry.createdAt)
				);
			});

		return ranked.slice(0, input.limit ?? DEFAULT_LIMIT);
	}

	private collectCandidates(input: MemoryRetrievalInput): MemoryEntry[] {
		const merged = new Map<string, MemoryEntry>();
		for (const entry of this.store.query({
			agentId: input.agentId,
			limit: input.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT,
		})) {
			merged.set(entry.id, entry);
		}

		const lexicalSearch = buildLexicalSearchQuery(input.query);
		if (lexicalSearch) {
			for (const entry of this.store.search(
				input.agentId ?? "",
				lexicalSearch,
				input.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT,
			)) {
				merged.set(entry.id, entry);
			}
		}

		return [...merged.values()];
	}

	private ensureEmbedding(entry: MemoryEntry): MemoryEntry {
		if (
			entry.embedding &&
			entry.embedding.length === EMBEDDING_DIMENSIONS
		) {
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
		const sourceKind =
			typeof result.entry.metadata?.sourceKind === "string"
				? ` ${result.entry.metadata.sourceKind}`
				: "";
		const chunkLabel =
			result.chunkCount > 1
				? ` chunk=${result.chunkIndex + 1}/${result.chunkCount}`
				: "";
		return `[${result.entry.tier}${sourceKind} score=${score}${chunkLabel}] ${compactText(result.excerpt, 180)}`;
	});
}

function buildQueryDocument(
	query: string,
	scope?: ChannelScope,
	threadId?: string,
): string {
	return [
		query,
		threadId ?? "",
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
	const intentId =
		typeof metadata.intentId === "string" ? metadata.intentId : "";
	const sourceKind =
		typeof metadata.sourceKind === "string" ? metadata.sourceKind : "";
	return [
		entry.content,
		projectRoot,
		threadId,
		intentId,
		sourceKind,
		tags.join(" "),
		labels.join(" "),
	]
		.filter(Boolean)
		.join("\n");
}

function buildChunkDocument(entry: MemoryEntry, chunkText: string): string {
	const metadata = entry.metadata ?? {};
	const tags = Array.isArray(metadata.tags)
		? metadata.tags.map((value) => String(value))
		: [];
	const labels = Array.isArray(metadata.labels)
		? metadata.labels.map((value) => String(value))
		: [];
	const projectRoot =
		typeof metadata.projectRoot === "string" ? metadata.projectRoot : "";
	const focusedFile =
		typeof metadata.focusedFile === "string" ? metadata.focusedFile : "";
	const threadId =
		typeof metadata.threadId === "string" ? metadata.threadId : "";
	const sourceKind =
		typeof metadata.sourceKind === "string" ? metadata.sourceKind : "";
	return [
		chunkText,
		projectRoot,
		focusedFile,
		threadId,
		sourceKind,
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
	threadId?: string,
): number {
	const metadata = entry.metadata ?? {};
	const memoryThreadId =
		typeof metadata.threadId === "string" ? metadata.threadId : undefined;
	if (threadId && memoryThreadId && threadId === memoryThreadId) {
		return 1;
	}
	if (!scope) return 0;
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

function computeProvenanceScore(entry: MemoryEntry): number {
	const metadata = entry.metadata ?? {};
	const provenance =
		metadata.provenance && typeof metadata.provenance === "object"
			? (metadata.provenance as {
					confidence?: unknown;
					evidenceRefs?: unknown[];
				})
			: undefined;
	const explicitConfidence =
		typeof provenance?.confidence === "number" ? provenance.confidence : 0.55;
	const evidenceBoost = Array.isArray(provenance?.evidenceRefs)
		? Math.min(provenance.evidenceRefs.length * 0.08, 0.24)
		: 0;
	return clamp01(explicitConfidence + evidenceBoost);
}

function computeRetentionScore(entry: MemoryEntry): number {
	return clamp01(entry.retentionScore / 3);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function buildLexicalSearchQuery(query: string): string | undefined {
	const latinTokens = [...new Set(tokenize(query))]
		.map((token) => token.replace(/[^a-z0-9_]+/g, ""))
		.filter((token) => token.length > 1)
		.slice(0, 8);
	// Include CJK segments (multi-char) for FTS matching
	const cjkSegments = (query.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]{2,}/g) ?? [])
		.slice(0, 4);
	const allTerms = [
		...latinTokens.map((token) => `"${token}"`),
		...cjkSegments.map((seg) => `"${seg}"`),
	];
	return allTerms.length > 0 ? allTerms.join(" OR ") : undefined;
}

interface ChunkSelectionInput {
	entry: MemoryEntry;
	queryEmbedding: number[];
	queryTokens: Set<string>;
	scope?: ChannelScope;
	threadId?: string;
	embeddingModel: LocalEmbeddingModel;
}

interface ChunkSelectionResult {
	semanticScore: number;
	lexicalScore: number;
	scopeScore: number;
	provenanceScore: number;
	excerpt: string;
	chunkIndex: number;
	chunkCount: number;
}

function selectBestChunk(input: ChunkSelectionInput): ChunkSelectionResult {
	const chunks = buildMemoryChunks(input.entry.content);
	const provenanceScore = computeProvenanceScore(input.entry);
	const scopeScore = computeScopeScore(
		input.entry,
		input.scope,
		input.threadId,
	);
	let best: ChunkSelectionResult | undefined;

	for (const chunk of chunks) {
		const chunkDocument = buildChunkDocument(input.entry, chunk.text);
		const semanticScore = cosineSimilarity(
			input.queryEmbedding,
			input.embeddingModel.embedText(chunkDocument),
		);
		const lexicalScore = computeLexicalScore(
			input.queryTokens,
			tokenize(chunkDocument),
		);
		const candidate: ChunkSelectionResult = {
			semanticScore,
			lexicalScore,
			scopeScore,
			provenanceScore,
			excerpt: chunk.text,
			chunkIndex: chunk.index,
			chunkCount: chunks.length,
		};
		if (!best) {
			best = candidate;
			continue;
		}
		const currentScore =
			candidate.semanticScore * 0.55 +
			candidate.lexicalScore * 0.3 +
			candidate.scopeScore * 0.15;
		const bestScore =
			best.semanticScore * 0.55 +
			best.lexicalScore * 0.3 +
			best.scopeScore * 0.15;
		if (currentScore > bestScore) {
			best = candidate;
		}
	}

	return (
		best ?? {
			semanticScore: 0,
			lexicalScore: 0,
			scopeScore,
			provenanceScore,
			excerpt: compactText(input.entry.content, 240),
			chunkIndex: 0,
			chunkCount: 1,
		}
	);
}

interface MemoryChunk {
	index: number;
	text: string;
}

function buildMemoryChunks(content: string): MemoryChunk[] {
	const tokens = content.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
	if (tokens.length === 0) {
		return [{ index: 0, text: "" }];
	}
	if (tokens.length <= CHUNK_TOKEN_LIMIT) {
		return [{ index: 0, text: tokens.join(" ") }];
	}

	const step = Math.max(CHUNK_TOKEN_LIMIT - CHUNK_TOKEN_OVERLAP, 1);
	const chunks: MemoryChunk[] = [];
	let index = 0;
	for (let start = 0; start < tokens.length; start += step) {
		const slice = tokens.slice(start, start + CHUNK_TOKEN_LIMIT);
		if (slice.length === 0) continue;
		chunks.push({
			index,
			text: slice.join(" "),
		});
		index += 1;
		if (start + CHUNK_TOKEN_LIMIT >= tokens.length) break;
	}
	return chunks;
}

function tokenize(text: string): string[] {
	const lower = text.toLowerCase();
	// Split Latin/numeric tokens
	const latinTokens = lower
		.split(/[^a-z0-9_./-]+/g)
		.map((token) => normalizeToken(token))
		.filter((token): token is string => Boolean(token));
	// Extract CJK characters as individual tokens
	const cjkTokens = (lower.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g) ?? [])
		.flatMap((segment) => segment.split(""));
	return [...latinTokens, ...cjkTokens];
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
