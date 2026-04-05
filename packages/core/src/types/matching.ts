/**
 * Shared matcher vocabulary for live runtime judgment seams.
 *
 * The goal is not to force every subsystem into identical logic; it is to make
 * "heuristic_only / semantic_only / hybrid" mean one consistent thing across:
 * - interaction-mode routing
 * - context continuity restoration
 * - memory retrieval ranking
 * - conflict analysis
 * - relationship-preference detection
 */
export type MatcherMode = "heuristic_only" | "semantic_only" | "hybrid";

/**
 * Hybrid matcher rules are intentionally broad. Each consumer reads only the
 * fields relevant to its own judgment path instead of inventing local config.
 */
export interface HybridMatcherPolicy {
	combineStrategy: "prefer_heuristic" | "prefer_semantic" | "higher_confidence";
	strategy: "heuristic_first" | "semantic_first" | "weighted";
	minimumHeuristicConfidence: number;
	minimumSemanticConfidence: number;
	heuristicWeight: number;
	semanticWeight: number;
	useLexicalHandoffPatterns: boolean;
	useStructuredHandoffSignal: boolean;
	useLexicalActiveWorkPatterns: boolean;
	useLexicalExplicitWorkPatterns: boolean;
	useStructuredRestorationSignal: boolean;
	useLexicalChatRepairPatterns: boolean;
	useAmbiguousChatFallback: boolean;
	useStructuredWorkSignal: boolean;
	useLexicalDecisionPatterns: boolean;
	useResourceClaims: boolean;
	useIntentModeHeuristics: boolean;
	useSemanticActionClassification: boolean;
	useDependencyRules: boolean;
	useOppositionRules: boolean;
	useDirectPreferenceMarkers: boolean;
	useQuotedExampleGuard: boolean;
	useDeliveryPreferenceRules: boolean;
	useAutonomyPreferenceRules: boolean;
	useInitiativePreferenceRules: boolean;
	useSemanticPreferenceRules: boolean;
	useStructuredPromotionTags: boolean;
	useStructuredPromotionMetadata: boolean;
	useProjectScopeMatch: boolean;
	useIntentIdentityMatch: boolean;
	useThreadIdentityMatch: boolean;
}

export interface CategoricalMatcherPolicy {
	mode: MatcherMode;
	hybrid: HybridMatcherPolicy;
}

export interface ScoredMatcherWeights {
	heuristic: number;
	semantic: number;
	lexical: number;
	scope: number;
	provenance: number;
	retention: number;
}

export interface ScoredMatcherPolicy {
	mode: MatcherMode;
	threshold: number;
	weights: ScoredMatcherWeights;
	hybrid: HybridMatcherPolicy;
}

export type InteractionModeHybridRules = HybridMatcherPolicy;
export type InteractionModeMatcherPolicy = CategoricalMatcherPolicy;
export type ConflictMatcherHybridRules = HybridMatcherPolicy;
export type ConflictHybridRules = HybridMatcherPolicy;
export type ConflictMatcherPolicy = CategoricalMatcherPolicy;
export type RelationshipPreferenceHybridRules = HybridMatcherPolicy;
export type RelationshipPreferenceMatcherPolicy = CategoricalMatcherPolicy;
export type ContextContinuityHybridRules = HybridMatcherPolicy;
export type ContextContinuityMatcherPolicy = ScoredMatcherPolicy;
export type MemoryRetrievalHybridRules = ScoredMatcherWeights;
export type MemoryRetrievalMatcherPolicy = ScoredMatcherPolicy;

export interface NousMatchingConfig {
	/** Daemon chat/work/handoff routing before thread messages enter governed work. */
	interactionMode: InteractionModeMatcherPolicy;
	/** Restoration from promoted memory into the current governed context/work. */
	contextContinuity: ContextContinuityMatcherPolicy;
	/** Hybrid lexical/semantic ranking used by memory recall/context packing. */
	memoryRetrieval: MemoryRetrievalMatcherPolicy;
	/** Active-work overlap / dependency / opposition judgment. */
	conflict: ConflictMatcherPolicy;
	/** User preference-note detection before semantic memory ingestion. */
	relationshipPreference: RelationshipPreferenceMatcherPolicy;
}

export type MatchingPolicySet = NousMatchingConfig;

const DEFAULT_HYBRID_MATCHER_POLICY: HybridMatcherPolicy = {
	combineStrategy: "higher_confidence",
	strategy: "weighted",
	minimumHeuristicConfidence: 0.55,
	minimumSemanticConfidence: 0.55,
	heuristicWeight: 0.5,
	semanticWeight: 0.5,
	useLexicalHandoffPatterns: true,
	useStructuredHandoffSignal: true,
	useLexicalActiveWorkPatterns: true,
	useLexicalExplicitWorkPatterns: true,
	useStructuredRestorationSignal: true,
	useLexicalChatRepairPatterns: true,
	useAmbiguousChatFallback: true,
	useStructuredWorkSignal: true,
	useLexicalDecisionPatterns: true,
	useResourceClaims: true,
	useIntentModeHeuristics: true,
	useSemanticActionClassification: true,
	useDependencyRules: true,
	useOppositionRules: true,
	useDirectPreferenceMarkers: true,
	useQuotedExampleGuard: true,
	useDeliveryPreferenceRules: true,
	useAutonomyPreferenceRules: true,
	useInitiativePreferenceRules: true,
	useSemanticPreferenceRules: false,
	useStructuredPromotionTags: true,
	useStructuredPromotionMetadata: true,
	useProjectScopeMatch: true,
	useIntentIdentityMatch: true,
	useThreadIdentityMatch: false,
};

/**
 * Default matcher config prefers bounded hybrid behavior:
 * - obvious lexical routes stay cheap
 * - semantic support exists where ambiguity or richer structure matters
 * - conflict / relationship preference stay heuristic-first to avoid
 *   over-eager semantic escalation in sensitive control paths
 */
export const DEFAULT_MATCHING_POLICY_SET: NousMatchingConfig = {
	interactionMode: {
		mode: "hybrid",
		hybrid: {
			...DEFAULT_HYBRID_MATCHER_POLICY,
			strategy: "weighted",
			combineStrategy: "higher_confidence",
		},
	},
	contextContinuity: {
		mode: "hybrid",
		threshold: 0.55,
		weights: {
			heuristic: 0.5,
			semantic: 0.5,
			lexical: 0,
			scope: 0,
			provenance: 0,
			retention: 0,
		},
		hybrid: {
			...DEFAULT_HYBRID_MATCHER_POLICY,
			strategy: "weighted",
			combineStrategy: "higher_confidence",
		},
	},
	memoryRetrieval: {
		mode: "hybrid",
		threshold: 0.05,
		weights: {
			heuristic: 0,
			semantic: 0.45,
			lexical: 0.2,
			scope: 0.15,
			provenance: 0.1,
			retention: 0.1,
		},
		hybrid: {
			...DEFAULT_HYBRID_MATCHER_POLICY,
			strategy: "weighted",
			combineStrategy: "higher_confidence",
		},
	},
	conflict: {
		mode: "hybrid",
		hybrid: {
			...DEFAULT_HYBRID_MATCHER_POLICY,
			strategy: "heuristic_first",
			combineStrategy: "prefer_heuristic",
			minimumHeuristicConfidence: 0.45,
			minimumSemanticConfidence: 0.55,
		},
	},
	relationshipPreference: {
		mode: "hybrid",
		hybrid: {
			...DEFAULT_HYBRID_MATCHER_POLICY,
			strategy: "heuristic_first",
			combineStrategy: "prefer_heuristic",
			minimumHeuristicConfidence: 0.5,
			minimumSemanticConfidence: 0.7,
		},
	},
};

export const DEFAULT_NOUS_MATCHING_CONFIG: NousMatchingConfig =
	DEFAULT_MATCHING_POLICY_SET;
