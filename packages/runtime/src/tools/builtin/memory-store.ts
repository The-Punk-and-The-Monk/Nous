import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";
import type { MemoryToolDependencies } from "./memory-search.ts";

export const memoryStoreDef: ToolDef = {
	name: "memory_store",
	description:
		"Store a durable semantic note into Nous memory for future retrieval.",
	inputSchema: {
		type: "object",
		properties: {
			content: {
				type: "string",
				description: "The note content to store as durable memory.",
			},
			factType: {
				type: "string",
				description: "Optional semantic fact type, such as project_fact or user_preference.",
			},
			threadId: {
				type: "string",
				description: "Optional thread identifier associated with the note.",
			},
			intentId: {
				type: "string",
				description: "Optional intent identifier associated with the note.",
			},
			projectRoot: {
				type: "string",
				description: "Optional project root for scope binding.",
			},
			focusedFile: {
				type: "string",
				description: "Optional focused file for scope binding.",
			},
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Optional tags that should travel with the memory note.",
			},
			confidence: {
				type: "number",
				description: "Optional confidence score between 0 and 1.",
			},
		},
		required: ["content"],
	},
	requiredCapabilities: ["memory.write"],
	timeoutMs: 5_000,
	sideEffectClass: "write",
	idempotency: "best_effort",
	interruptibility: "after_tool",
	approvalMode: "auto",
	rollbackPolicy: "manual",
	rollbackHint:
		"Memory notes become part of Nous memory history. Manual cleanup would require deleting the stored memory entry.",
};

export function memoryStoreHandler(
	dependencies: MemoryToolDependencies,
): ToolHandler {
	return async (input, context) => {
		if (!dependencies.memory) {
			throw new Error("memory_store is unavailable because no memory service is configured");
		}
		if (context.signal.aborted) {
			throw new Error("memory_store interrupted before start");
		}

		const entry = dependencies.memory.storeManualNote({
			content: String(input.content ?? "").trim(),
			factType: normalizeFactType(input.factType),
			threadId:
				typeof input.threadId === "string" ? input.threadId : undefined,
			intentId:
				typeof input.intentId === "string" ? input.intentId : undefined,
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
			tags: Array.isArray(input.tags)
				? input.tags.map((value) => String(value))
				: undefined,
			confidence:
				typeof input.confidence === "number" ? input.confidence : undefined,
		});

		return {
			output: `Stored memory ${entry.id} as semantic/${String(entry.metadata.sourceKind)}.`,
			rollbackPlan: {
				kind: "manual",
				description: `Delete memory entry ${entry.id} if this note should not persist.`,
			},
		};
	};
}

function normalizeFactType(
	value: unknown,
):
	| "outcome_summary"
	| "project_fact"
	| "user_preference"
	| "policy"
	| "generalized_pattern"
	| undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	switch (value) {
		case "outcome_summary":
		case "project_fact":
		case "user_preference":
		case "policy":
		case "generalized_pattern":
			return value;
		default:
			return undefined;
	}
}
