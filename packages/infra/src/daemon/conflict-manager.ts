import type { ChannelScope } from "@nous/core";

export interface ResourceClaim {
	key: string;
	mode: "read" | "write";
	source: "explicit" | "scope";
}

export interface ConflictDecision {
	queued: boolean;
	overlaps: string[];
	reason?: string;
}

export interface ScheduleIntentInput {
	text: string;
	scope: ChannelScope;
}

interface ActiveClaim {
	mode: ResourceClaim["mode"];
	promise: Promise<void>;
}

export class StaticIntentConflictManager {
	private readonly activeClaims = new Map<string, ActiveClaim[]>();

	schedule(
		input: ScheduleIntentInput,
		run: () => Promise<void>,
	): ConflictDecision & { completion: Promise<void> } {
		const claims = deriveResourceClaims(input.text, input.scope);
		const overlaps = new Set<string>();
		const blockers = new Set<Promise<void>>();

		for (const claim of claims) {
			for (const active of this.activeClaims.get(claim.key) ?? []) {
				if (active.mode === "write" || claim.mode === "write") {
					overlaps.add(claim.key);
					blockers.add(active.promise);
				}
			}
		}

		const completion = Promise.all([...blockers])
			.then(run)
			.finally(() => {
				for (const claim of claims) {
					const current = this.activeClaims.get(claim.key) ?? [];
					const remaining = current.filter(
						(entry) => entry.promise !== completion,
					);
					if (remaining.length > 0) {
						this.activeClaims.set(claim.key, remaining);
					} else {
						this.activeClaims.delete(claim.key);
					}
				}
			});

		for (const claim of claims) {
			const current = this.activeClaims.get(claim.key) ?? [];
			current.push({ mode: claim.mode, promise: completion });
			this.activeClaims.set(claim.key, current);
		}

		const overlapList = [...overlaps];
		return {
			queued: overlapList.length > 0,
			overlaps: overlapList,
			reason:
				overlapList.length > 0
					? `Detected overlapping active work on ${overlapList.join(", ")}. Running sequentially.`
					: undefined,
			completion,
		};
	}
}

export function deriveResourceClaims(
	text: string,
	scope: ChannelScope,
): ResourceClaim[] {
	const explicitTargets = extractExplicitTargets(text, scope);
	const mode = inferIntentMode(text);

	if (explicitTargets.length > 0) {
		return explicitTargets.map((target) => ({
			key: `file:${target}`,
			mode,
			source: "explicit" as const,
		}));
	}

	const scopeRoot =
		normalizeTarget(scope.projectRoot) ??
		normalizeTarget(scope.workingDirectory) ??
		"global";
	return [
		{
			key: `scope:${scopeRoot}`,
			mode,
			source: "scope",
		},
	];
}

function extractExplicitTargets(text: string, scope: ChannelScope): string[] {
	const matches = text.match(
		/(?:\.{0,2}\/)?[\w-./]+\.(?:ts|tsx|js|jsx|py|md|json|yaml|yml|css|html|go|rs|java|sh|sql)/gi,
	);
	if (!matches) return [];

	const base =
		normalizeTarget(scope.projectRoot) ??
		normalizeTarget(scope.workingDirectory);
	const targets = new Set<string>();
	for (const match of matches) {
		const normalized = normalizeTarget(match);
		if (!normalized) continue;
		if (normalized.startsWith("/") || !base) {
			targets.add(normalized);
			continue;
		}
		targets.add(`${base}/${normalized}`.replace(/\/+/g, "/"));
	}
	return [...targets];
}

function inferIntentMode(text: string): ResourceClaim["mode"] {
	return /\b(refactor|edit|modify|change|update|fix|write|rename|remove|delete|implement|create|add|migrate|replace)\b/i.test(
		text,
	)
		? "write"
		: "read";
}

function normalizeTarget(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
}
