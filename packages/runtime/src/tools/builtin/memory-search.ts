import type { MemoryTier, ToolDef } from "@nous/core";
import { renderMemoryHints } from "../../memory/retrieval.ts";
import type { MemoryService } from "../../memory/service.ts";
import type { ToolHandler } from "../executor.ts";

export interface MemoryToolDependencies {
	memory?: MemoryService;
}

export const memorySearchDef: ToolDef = {
	name: "memory_search",
	description:
		"Search Nous memory for semantically relevant prior context within the current scope.",
	inputSchema: {
		type: "object",
		properties: {
			query: { type: "string", description: "Memory retrieval query" },
			threadId: {
				type: "string",
				description: "Optional thread identifier to bias retrieval.",
			},
			projectRoot: {
				type: "string",
				description: "Optional project root to scope retrieval.",
			},
			focusedFile: {
				type: "string",
				description: "Optional focused file to bias retrieval.",
			},
			limit: {
				type: "number",
				description: "Maximum number of memory results to return.",
			},
			tiers: {
				type: "array",
				items: { type: "string" },
				description: "Optional memory tiers to restrict retrieval.",
			},
		},
		required: ["query"],
	},
	requiredCapabilities: ["memory.write"],
	timeoutMs: 5_000,
	sideEffectClass: "read_only",
	idempotency: "idempotent",
	interruptibility: "after_tool",
	approvalMode: "auto",
	rollbackPolicy: "none",
};

export function memorySearchHandler(
	dependencies: MemoryToolDependencies,
): ToolHandler {
	return async (input, context) => {
		if (!dependencies.memory) {
			throw new Error("memory_search is unavailable because no memory service is configured");
		}
		if (context.signal.aborted) {
			throw new Error("memory_search interrupted before start");
		}

		const results = dependencies.memory.retrieve({
			query: String(input.query ?? ""),
			threadId:
				typeof input.threadId === "string" ? input.threadId : undefined,
			scope: {
				projectRoot:
					typeof input.projectRoot === "string"
						? input.projectRoot
						: undefined,
				workingDirectory:
					typeof input.projectRoot === "string"
						? input.projectRoot
						: undefined,
				focusedFile:
					typeof input.focusedFile === "string"
						? input.focusedFile
						: undefined,
			},
			limit: normalizeLimit(input.limit),
			tiers: normalizeTiers(input.tiers),
		});
		for (const result of results) {
			dependencies.memory.recordAccess(result.entry.id);
		}

		if (results.length === 0) {
			return "No relevant memories found.";
		}

		const hints = renderMemoryHints(results);
		return results
			.map((result, index) => `${index + 1}. ${result.entry.id} ${hints[index] ?? ""}`.trim())
			.join("\n");
	};
}

function normalizeLimit(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.max(1, Math.min(10, Math.floor(value)));
	}
	return 5;
}

function normalizeTiers(value: unknown): MemoryTier[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const allowed: MemoryTier[] = [
		"working",
		"episodic",
		"semantic",
		"procedural",
		"prospective",
	];
	const tiers = value
		.map((item) => String(item))
		.filter((item): item is MemoryTier => allowed.includes(item as MemoryTier));
	return tiers.length > 0 ? tiers : undefined;
}
