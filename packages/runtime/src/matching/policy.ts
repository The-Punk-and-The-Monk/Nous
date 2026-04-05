import type { CategoricalMatcherPolicy, ScoredMatcherPolicy } from "@nous/core";

/**
 * Shared runtime helpers for matcher-policy execution.
 *
 * Keep this layer domain-agnostic:
 * - categorical helpers choose among discrete outcomes like chat/work/handoff
 * - scored helpers combine heuristic/semantic signals for thresholded matchers
 *
 * Callers supply the domain semantics; this file only applies configured policy.
 */
type MaybePromise<T> = T | Promise<T>;

export interface MatcherCandidate<T> {
	value: T;
	confidence: number;
	rationale: string;
}

export interface CategoricalMatcherResult<T> {
	candidate: MatcherCandidate<T>;
	source: "heuristic" | "semantic" | "hybrid";
}

export function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export function confidenceLabelToScore(
	confidence: "high" | "medium" | "low",
): number {
	switch (confidence) {
		case "high":
			return 0.9;
		case "medium":
			return 0.7;
		case "low":
			return 0.45;
	}
}

export function scoreToConfidenceLabel(
	score: number,
): "high" | "medium" | "low" {
	if (score >= 0.8) return "high";
	if (score >= 0.6) return "medium";
	return "low";
}

export async function resolveCategoricalMatcher<T>(params: {
	policy: CategoricalMatcherPolicy;
	heuristic?: () => MaybePromise<MatcherCandidate<T> | undefined>;
	semantic?: () => MaybePromise<MatcherCandidate<T> | undefined>;
	fallback: () => MaybePromise<MatcherCandidate<T>>;
	equals?: (left: T, right: T) => boolean;
}): Promise<CategoricalMatcherResult<T>> {
	// Single-mode policies still allow a bounded fallback so callers can stay safe
	// when one source is unavailable.
	const heuristic = params.heuristic;
	const semantic = params.semantic;
	const equals = params.equals ?? Object.is;

	if (params.policy.mode === "heuristic_only") {
		const candidate = (await heuristic?.()) ?? (await semantic?.());
		return candidate
			? { candidate, source: "heuristic" }
			: { candidate: await params.fallback(), source: "heuristic" };
	}

	if (params.policy.mode === "semantic_only") {
		const candidate = (await semantic?.()) ?? (await heuristic?.());
		return candidate
			? { candidate, source: "semantic" }
			: { candidate: await params.fallback(), source: "semantic" };
	}

	const strategy = params.policy.hybrid.combineStrategy;
	if (strategy === "prefer_heuristic") {
		const heuristicCandidate = await heuristic?.();
		if (heuristicCandidate) {
			return { candidate: heuristicCandidate, source: "heuristic" };
		}
		const semanticCandidate = await semantic?.();
		return semanticCandidate
			? { candidate: semanticCandidate, source: "semantic" }
			: { candidate: await params.fallback(), source: "hybrid" };
	}

	if (strategy === "prefer_semantic") {
		const semanticCandidate = await semantic?.();
		if (semanticCandidate) {
			return { candidate: semanticCandidate, source: "semantic" };
		}
		const heuristicCandidate = await heuristic?.();
		return heuristicCandidate
			? { candidate: heuristicCandidate, source: "heuristic" }
			: { candidate: await params.fallback(), source: "hybrid" };
	}

	const [heuristicCandidate, semanticCandidate] = await Promise.all([
		heuristic?.(),
		semantic?.(),
	]);
	if (heuristicCandidate && semanticCandidate) {
		if (equals(heuristicCandidate.value, semanticCandidate.value)) {
			return {
				candidate: {
					value: heuristicCandidate.value,
					confidence: clamp01(
						(heuristicCandidate.confidence + semanticCandidate.confidence) / 2,
					),
					rationale: `${heuristicCandidate.rationale} | ${semanticCandidate.rationale}`,
				},
				source: "hybrid",
			};
		}
		return heuristicCandidate.confidence >= semanticCandidate.confidence
			? { candidate: heuristicCandidate, source: "heuristic" }
			: { candidate: semanticCandidate, source: "semantic" };
	}
	const single = heuristicCandidate ?? semanticCandidate;
	return single
		? {
				candidate: single,
				source: heuristicCandidate ? "heuristic" : "semantic",
			}
		: { candidate: await params.fallback(), source: "hybrid" };
}

export function resolveScoredMatcher(params: {
	policy: ScoredMatcherPolicy;
	heuristicScore?: number;
	semanticScore?: number;
}): {
	score: number;
	source: "heuristic" | "semantic" | "hybrid";
} {
	// The caller interprets the resulting score; this helper only applies the
	// configured heuristic/semantic bias for the current matcher policy.
	const heuristicScore = clamp01(params.heuristicScore ?? 0);
	const semanticScore = clamp01(params.semanticScore ?? 0);

	if (params.policy.mode === "heuristic_only") {
		return { score: heuristicScore, source: "heuristic" };
	}
	if (params.policy.mode === "semantic_only") {
		return { score: semanticScore || heuristicScore, source: "semantic" };
	}
	if (params.policy.hybrid.combineStrategy === "prefer_heuristic") {
		return heuristicScore >= semanticScore
			? { score: heuristicScore, source: "heuristic" }
			: { score: semanticScore, source: "semantic" };
	}
	if (params.policy.hybrid.combineStrategy === "prefer_semantic") {
		return semanticScore >= heuristicScore
			? { score: semanticScore, source: "semantic" }
			: { score: heuristicScore, source: "heuristic" };
	}
	return {
		score: clamp01(
			heuristicScore * params.policy.weights.heuristic +
				semanticScore * params.policy.weights.semantic,
		),
		source: "hybrid",
	};
}
