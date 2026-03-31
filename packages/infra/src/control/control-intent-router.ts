import type {
	ControlIntentResolution,
	ControlSurfaceContext,
	ControlSurfaceEntry,
	LLMProvider,
} from "@nous/core";
import { StructuredGenerationEngine } from "@nous/runtime";
import {
	controlSurfaceAvailabilityNote,
	listControlSurfaceEntries,
	primaryControlSurfaceSyntax,
} from "./catalog.ts";

export interface ControlIntentRoutingInput {
	text: string;
	context: ControlSurfaceContext;
}

export class ControlIntentRouter {
	private readonly structured: StructuredGenerationEngine;

	constructor(private readonly llm: LLMProvider) {
		this.structured = new StructuredGenerationEngine(llm);
	}

	async route(
		input: ControlIntentRoutingInput,
	): Promise<ControlIntentResolution> {
		const entries = listControlSurfaceEntries({
			...input.context,
			includeUnavailable: true,
		});
		const resolution = await this.structured.generate({
			spec: CONTROL_INTENT_ROUTING_SPEC,
			system: CONTROL_INTENT_ROUTING_SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: renderRoutingInput(input, entries),
				},
			],
			maxTokens: 700,
			temperature: 0,
		});
		return normalizeResolution(resolution, entries, input.context);
	}
}

const CONTROL_INTENT_ROUTING_SYSTEM_PROMPT = `You are deciding whether a user message inside a Nous client surface is:

- invoke_operation: a request to control, inspect, discover, or navigate the Nous runtime itself
- task_plane: a normal task, thread reply, or conversational message that should be sent into the normal task/intake pipeline
- clarify: the message sounds like control, but is too ambiguous or is missing a required argument

Important:
- prefer task_plane unless the user is clearly trying to control or inspect Nous itself
- "what can you do here?", "show commands", and similar discovery questions are invoke_operation with operationId="control.discover"
- requests to switch/open/attach to a specific thread are invoke_operation with operationId="thread.attach" and the threadId filled in when present
- if the user seems to want a control operation but omitted a required argument, return clarify
- do not invent operation ids that are not present in the provided catalog
- only return invoke_operation for operations that are available in the current surface/context
- if a message could plausibly be either control or normal task work, prefer clarify over guessing
- if the user is asking Nous to work on repository/application/domain content rather than the Nous runtime itself, choose task_plane`;

const CONTROL_INTENT_ROUTING_SPEC = {
	name: "control_intent_routing",
	description:
		"Decide whether a client message is a control-surface operation, normal task-plane input, or needs clarification.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: ["kind", "confidence", "rationale"],
		properties: {
			kind: {
				type: "string",
				enum: ["invoke_operation", "task_plane", "clarify"],
			},
			operationId: { type: "string" },
			confidence: {
				type: "string",
				enum: ["high", "medium", "low"],
			},
			rationale: { type: "string" },
			query: { type: "string" },
			threadId: { type: "string" },
		},
	},
	validate(value: unknown): ControlIntentResolution {
		if (!isObject(value)) {
			throw new Error("Control intent routing payload must be an object");
		}
		const kind =
			value.kind === "invoke_operation" ||
			value.kind === "task_plane" ||
			value.kind === "clarify"
				? value.kind
				: "clarify";
		const confidence =
			value.confidence === "high" ||
			value.confidence === "medium" ||
			value.confidence === "low"
				? value.confidence
				: kind === "invoke_operation"
					? "medium"
					: "low";
		const rationale =
			typeof value.rationale === "string" && value.rationale.trim().length > 0
				? value.rationale.trim()
				: "No rationale provided.";
		const operationId =
			typeof value.operationId === "string" && value.operationId.trim().length > 0
				? value.operationId.trim()
				: undefined;
		const query =
			typeof value.query === "string" && value.query.trim().length > 0
				? value.query.trim()
				: undefined;
		const threadId =
			typeof value.threadId === "string" && value.threadId.trim().length > 0
				? value.threadId.trim()
				: undefined;
		return { kind, operationId, confidence, rationale, query, threadId };
	},
} as const;

function renderRoutingInput(
	input: ControlIntentRoutingInput,
	entries: ControlSurfaceEntry[],
): string {
	const operations = entries.length
		? entries
				.map((entry) => {
					const availability =
						controlSurfaceAvailabilityNote(entry, input.context) ?? "available";
					return [
						`- ${entry.id}`,
						`  title: ${entry.title}`,
						`  summary: ${entry.summary}`,
						`  availability: ${availability}`,
						`  syntax: ${primaryControlSurfaceSyntax(entry, input.context.surface)}`,
						`  tags: ${(entry.tags ?? []).join(", ") || "none"}`,
					].join("\n");
				})
				.join("\n")
		: "- none";
	return [
		`Surface: ${input.context.surface}`,
		`Channel type: ${input.context.channelType}`,
		`Daemon running: ${input.context.daemonRunning ? "yes" : "no"}`,
		`Current thread: ${input.context.currentThreadId ?? "none"}`,
		`Available control-surface operations:\n${operations}`,
		`User message:\n${input.text}`,
	].join("\n\n");
}

function normalizeResolution(
	resolution: ControlIntentResolution,
	entries: ControlSurfaceEntry[],
	context: ControlSurfaceContext,
): ControlIntentResolution {
	if (resolution.kind !== "invoke_operation") {
		return resolution;
	}
	const entry = resolution.operationId
		? entries.find((candidate) => candidate.id === resolution.operationId)
		: undefined;
	if (!entry) {
		return {
			kind: "clarify",
			confidence: "medium",
			rationale:
				"The control interpretation did not resolve to a known operation.",
		};
	}
	if (controlSurfaceAvailabilityNote(entry, context) !== undefined) {
		return {
			kind: "clarify",
			confidence: "medium",
			rationale:
				"The interpreted operation is not available in the current surface/context.",
			operationId: entry.id,
		};
	}
	if (resolution.confidence !== "high") {
		return {
			kind: "clarify",
			confidence: "medium",
			rationale:
				"The control interpretation was not high-confidence enough to execute directly.",
			operationId: entry.id,
			query: resolution.query,
			threadId: resolution.threadId,
		};
	}
	if (entry.id === "thread.attach" && !resolution.threadId) {
		return {
			kind: "clarify",
			confidence: "medium",
			rationale: "Attaching to another thread requires a thread id.",
			operationId: entry.id,
		};
	}
	return resolution;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
