import type { ChannelScope } from "@nous/core";

export interface ResourceClaim {
	key: string;
	mode: "read" | "write";
	source: "explicit" | "scope";
}

export interface ConflictDecision {
	queued: boolean;
	overlaps: string[];
	verdict: "independent" | "resource_contention" | "dependent" | "conflicting";
	reason?: string;
	requiresReview?: boolean;
}

export interface ScheduleIntentInput {
	text: string;
	scope: ChannelScope;
}

interface ActiveClaim {
	mode: ResourceClaim["mode"];
	promise: Promise<void>;
	text: string;
	scopeKey: string;
	claims: ResourceClaim[];
}

export class StaticIntentConflictManager {
	private readonly activeClaims = new Map<string, ActiveClaim[]>();

	schedule(
		input: ScheduleIntentInput,
		run: () => Promise<void>,
	): ConflictDecision & { completion: Promise<void> } {
		const claims = deriveResourceClaims(input.text, input.scope);
		const scopeKey = deriveScopeKey(input.scope);
		const overlaps = new Set<string>();
		const blockers = new Set<Promise<void>>();
		let verdict: ConflictDecision["verdict"] = "independent";
		let requiresReview = false;
		let reason: string | undefined;

		const activeExecutions = dedupeActiveExecutions(this.activeClaims);

		for (const claim of claims) {
			for (const active of this.activeClaims.get(claim.key) ?? []) {
				if (active.mode === "write" || claim.mode === "write") {
					overlaps.add(claim.key);
					blockers.add(active.promise);
				}
			}
		}

		for (const active of activeExecutions) {
			if (active.scopeKey !== scopeKey && overlaps.size === 0) continue;
			const semantic = analyzeSemanticRelationship(input.text, active.text);
			if (semantic === "conflicting") {
				verdict = "conflicting";
				requiresReview = true;
				reason =
					"Detected a potential semantic conflict with active work. Sequencing conservatively until reviewed.";
				blockers.add(active.promise);
				continue;
			}
			if (semantic === "dependent" && verdict !== "conflicting") {
				verdict = "dependent";
				reason =
					"Detected a likely dependency on active work. Running sequentially.";
				blockers.add(active.promise);
			}
		}

		if (verdict === "independent" && overlaps.size > 0) {
			verdict = "resource_contention";
			reason = `Detected overlapping active work on ${[...overlaps].join(", ")}. Running sequentially.`;
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
			current.push({
				mode: claim.mode,
				promise: completion,
				text: input.text,
				scopeKey,
				claims,
			});
			this.activeClaims.set(claim.key, current);
		}

		const overlapList = [...overlaps];
		return {
			queued: blockers.size > 0,
			overlaps: overlapList,
			verdict,
			reason,
			requiresReview,
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

function deriveScopeKey(scope: ChannelScope): string {
	return (
		normalizeTarget(scope.projectRoot) ??
		normalizeTarget(scope.workingDirectory) ??
		"global"
	);
}

function dedupeActiveExecutions(
	index: Map<string, ActiveClaim[]>,
): ActiveClaim[] {
	const seen = new Set<Promise<void>>();
	const active: ActiveClaim[] = [];
	for (const claims of index.values()) {
		for (const claim of claims) {
			if (seen.has(claim.promise)) continue;
			seen.add(claim.promise);
			active.push(claim);
		}
	}
	return active;
}

function analyzeSemanticRelationship(
	incomingText: string,
	activeText: string,
): "independent" | "dependent" | "conflicting" {
	const incoming = classifyIntent(incomingText);
	const active = classifyIntent(activeText);

	if (incoming.target && active.target && incoming.target !== active.target) {
		return "independent";
	}

	if (
		areOpposedActions(incoming.action, active.action) ||
		(incoming.action === "deploy" && active.action === "rollback") ||
		(incoming.action === "rollback" && active.action === "deploy")
	) {
		return "conflicting";
	}

	if (
		(incoming.action === "test" &&
			["refactor", "migrate", "rename", "fix"].includes(active.action)) ||
		(active.action === "test" &&
			["refactor", "migrate", "rename", "fix"].includes(incoming.action)) ||
		(incoming.action === "deploy" &&
			["build", "test", "fix", "refactor"].includes(active.action)) ||
		(active.action === "deploy" &&
			["build", "test", "fix", "refactor"].includes(incoming.action))
	) {
		return "dependent";
	}

	return "independent";
}

function classifyIntent(text: string): { action: string; target?: string } {
	const normalized = text.toLowerCase();
	const explicitTargets = extractExplicitTargets(text, {});
	return {
		action: inferIntentAction(normalized),
		target: explicitTargets[0],
	};
}

function inferIntentAction(text: string): string {
	if (/\b(deploy|release|ship)\b/.test(text)) return "deploy";
	if (/\b(rollback|revert)\b/.test(text)) return "rollback";
	if (/\b(test|tests|spec)\b/.test(text)) return "test";
	if (/\b(refactor)\b/.test(text)) return "refactor";
	if (/\b(rename)\b/.test(text)) return "rename";
	if (/\b(migrate)\b/.test(text)) return "migrate";
	if (/\b(build)\b/.test(text)) return "build";
	if (/\b(fix|repair)\b/.test(text)) return "fix";
	if (/\b(remove|delete|disable)\b/.test(text)) return "remove";
	if (/\b(add|create|enable|implement)\b/.test(text)) return "add";
	return "read";
}

function areOpposedActions(left: string, right: string): boolean {
	return (
		(left === "remove" && right === "add") ||
		(left === "add" && right === "remove")
	);
}

function normalizeTarget(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
}
