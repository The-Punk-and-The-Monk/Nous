import {
	type ChannelScope,
	type ContextContinuityMatcherPolicy,
	DEFAULT_NOUS_MATCHING_CONFIG,
	type MemoryEntry,
} from "@nous/core";

/**
 * Context-continuity restoration is the live runtime gate that decides whether
 * promoted memory is allowed to revive governed work in the current scene.
 *
 * Current caller:
 * - daemon thread-message restoration in `packages/infra/src/daemon/server.ts`
 *
 * Terminology note:
 * - `context continuity` is the umbrella term
 * - `work continuity` remains as a narrower compatibility alias for the same
 *   governed restoration path
 */
export interface ContextContinuityRestorationInput {
	memoryEntry?: MemoryEntry;
	scope?: ChannelScope;
	intentId?: string;
	threadId?: string;
	permissionGranted: boolean;
	boundaryAccepted: boolean;
	policy?: ContextContinuityMatcherPolicy;
}

export interface ContextContinuityRestorationVerdict {
	allowed: boolean;
	reason: string;
	gates: {
		structuredPromotion: boolean;
		liveSceneMatch: boolean;
		permissionBoundary: boolean;
	};
}

export type WorkContinuationRestorationInput =
	ContextContinuityRestorationInput;
export type WorkContinuationRestorationVerdict =
	ContextContinuityRestorationVerdict;

export function evaluateContextContinuityRestoration(
	input: ContextContinuityRestorationInput,
): ContextContinuityRestorationVerdict {
	// Matcher policy decides how much trust to place in tags/metadata/identity
	// matches, but permission + boundary checks remain a hard gate afterward.
	const policy = input.policy ?? DEFAULT_NOUS_MATCHING_CONFIG.contextContinuity;
	const structuredPromotion = isStructuredContextContinuityMemory(
		input.memoryEntry,
		policy,
	);
	if (!structuredPromotion) {
		return {
			allowed: false,
			reason:
				"Rejected restoration because no promoted structured context-continuity memory was supplied.",
			gates: {
				structuredPromotion,
				liveSceneMatch: false,
				permissionBoundary: false,
			},
		};
	}

	const metadata = (input.memoryEntry?.metadata ?? {}) as Record<
		string,
		unknown
	>;
	const liveSceneMatch = matchesLiveScene(metadata, input, policy);
	const permissionBoundary = input.permissionGranted && input.boundaryAccepted;

	if (!liveSceneMatch) {
		return {
			allowed: false,
			reason:
				"Rejected restoration because the current scene did not match the promoted context continuity memory.",
			gates: {
				structuredPromotion,
				liveSceneMatch,
				permissionBoundary,
			},
		};
	}

	if (!permissionBoundary) {
		return {
			allowed: false,
			reason:
				"Rejected restoration because permission or boundary checks did not pass.",
			gates: {
				structuredPromotion,
				liveSceneMatch,
				permissionBoundary,
			},
		};
	}

	return {
		allowed: true,
		reason:
			"Restoration allowed: structured context continuity exists and the live match plus permission/boundary gate passed.",
		gates: {
			structuredPromotion,
			liveSceneMatch,
			permissionBoundary,
		},
	};
}

export function evaluateWorkContinuationRestoration(
	input: WorkContinuationRestorationInput,
): WorkContinuationRestorationVerdict {
	// Compatibility alias for older call sites/tests that still speak in the
	// narrower work-continuity language.
	return evaluateContextContinuityRestoration(input);
}

function isStructuredContextContinuityMemory(
	entry: MemoryEntry | undefined,
	policy: ContextContinuityMatcherPolicy,
): boolean {
	if (!entry || entry.tier !== "semantic") {
		return false;
	}
	const metadata = entry.metadata as Record<string, unknown>;
	const heuristicEnabled =
		policy.mode === "heuristic_only" || policy.mode === "hybrid";
	const semanticEnabled =
		policy.mode === "semantic_only" || policy.mode === "hybrid";
	const tags = Array.isArray(metadata.tags)
		? metadata.tags.filter((tag): tag is string => typeof tag === "string")
		: [];
	const hasStructuredTags =
		(tags.includes("work_continuity") || tags.includes("context_continuity")) &&
		tags.includes("structured");
	const hasStructuredMetadata =
		metadata.factType === "generalized_pattern" &&
		typeof metadata.intentId === "string";

	if (policy.mode === "heuristic_only") {
		return hasStructuredTags;
	}
	if (policy.mode === "semantic_only") {
		return hasStructuredMetadata;
	}
	return (
		(!policy.hybrid.useStructuredPromotionTags || hasStructuredTags) &&
		(!policy.hybrid.useStructuredPromotionMetadata || hasStructuredMetadata)
	);
}

function matchesLiveScene(
	metadata: Record<string, unknown>,
	input: ContextContinuityRestorationInput,
	policy: ContextContinuityMatcherPolicy,
): boolean {
	const heuristicEnabled =
		policy.mode === "heuristic_only" || policy.mode === "hybrid";
	const semanticEnabled =
		policy.mode === "semantic_only" || policy.mode === "hybrid";

	const projectRootMatch = matchesProjectScope(metadata, input.scope);
	const intentMatch = matchesIntentId(metadata, input.intentId);
	const threadMatch = matchesThreadId(metadata, input.threadId);

	if (policy.mode === "heuristic_only") {
		return projectRootMatch && intentMatch;
	}
	if (policy.mode === "semantic_only") {
		return projectRootMatch && (intentMatch || threadMatch);
	}

	return (
		(!policy.hybrid.useProjectScopeMatch ||
			!semanticEnabled ||
			projectRootMatch) &&
		(!policy.hybrid.useIntentIdentityMatch ||
			!semanticEnabled ||
			intentMatch) &&
		(!policy.hybrid.useThreadIdentityMatch ||
			!semanticEnabled ||
			threadMatch) &&
		(heuristicEnabled || semanticEnabled)
	);
}

function matchesProjectScope(
	metadata: Record<string, unknown>,
	scope: ChannelScope | undefined,
): boolean {
	const memoryProjectRoot =
		typeof metadata.projectRoot === "string" ? metadata.projectRoot : undefined;
	const inputProjectRoot = scope?.projectRoot;
	if (!memoryProjectRoot || !inputProjectRoot) {
		return true;
	}
	return memoryProjectRoot === inputProjectRoot;
}

function matchesIntentId(
	metadata: Record<string, unknown>,
	intentId: string | undefined,
): boolean {
	const memoryIntentId =
		typeof metadata.intentId === "string" ? metadata.intentId : undefined;
	if (!memoryIntentId || !intentId) {
		return true;
	}
	return memoryIntentId === intentId;
}

function matchesThreadId(
	metadata: Record<string, unknown>,
	threadId: string | undefined,
): boolean {
	const memoryThreadId =
		typeof metadata.threadId === "string" ? metadata.threadId : undefined;
	if (!memoryThreadId || !threadId) {
		return false;
	}
	return memoryThreadId === threadId;
}
