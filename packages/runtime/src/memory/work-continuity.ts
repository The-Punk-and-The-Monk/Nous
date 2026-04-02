import type { ChannelScope, MemoryEntry } from "@nous/core";

export interface WorkContinuationRestorationInput {
	memoryEntry?: MemoryEntry;
	scope?: ChannelScope;
	intentId?: string;
	permissionGranted: boolean;
	boundaryAccepted: boolean;
}

export interface WorkContinuationRestorationVerdict {
	allowed: boolean;
	reason: string;
	gates: {
		structuredPromotion: boolean;
		liveSceneMatch: boolean;
		permissionBoundary: boolean;
	};
}

export function evaluateWorkContinuationRestoration(
	input: WorkContinuationRestorationInput,
): WorkContinuationRestorationVerdict {
	const structuredPromotion = isStructuredWorkContinuationMemory(
		input.memoryEntry,
	);
	if (!structuredPromotion) {
		return {
			allowed: false,
			reason:
				"Rejected restoration because no promoted structured work-continuity memory was supplied.",
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
	const liveSceneMatch = matchesLiveScene(metadata, input);
	const permissionBoundary = input.permissionGranted && input.boundaryAccepted;

	if (!liveSceneMatch) {
		return {
			allowed: false,
			reason:
				"Rejected restoration because the current scene did not match the promoted work memory.",
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
			"Restoration allowed: structured promotion exists and the live match plus permission/boundary gate passed.",
		gates: {
			structuredPromotion,
			liveSceneMatch,
			permissionBoundary,
		},
	};
}

function isStructuredWorkContinuationMemory(
	entry: MemoryEntry | undefined,
): boolean {
	if (!entry || entry.tier !== "semantic") {
		return false;
	}
	const metadata = entry.metadata as Record<string, unknown>;
	const tags = Array.isArray(metadata.tags)
		? metadata.tags.filter((tag): tag is string => typeof tag === "string")
		: [];
	return tags.includes("work_continuity") && tags.includes("structured");
}

function matchesLiveScene(
	metadata: Record<string, unknown>,
	input: WorkContinuationRestorationInput,
): boolean {
	const memoryProjectRoot =
		typeof metadata.projectRoot === "string" ? metadata.projectRoot : undefined;
	const inputProjectRoot = input.scope?.projectRoot;
	if (
		memoryProjectRoot &&
		inputProjectRoot &&
		memoryProjectRoot !== inputProjectRoot
	) {
		return false;
	}

	const memoryIntentId =
		typeof metadata.intentId === "string" ? metadata.intentId : undefined;
	if (
		input.intentId &&
		memoryIntentId &&
		input.intentId !== memoryIntentId
	) {
		return false;
	}

	return true;
}
