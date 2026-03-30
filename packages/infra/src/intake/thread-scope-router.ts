import type { DialogueMessage, Intent, LLMProvider } from "@nous/core";
import { StructuredGenerationEngine } from "@nous/runtime";

export type ThreadScopeDisposition =
	| "current_intent"
	| "pause_current_intent"
	| "resume_current_intent"
	| "cancel_current_intent"
	| "new_intent"
	| "ambiguous";

export interface ThreadScopeRoutingDecision {
	disposition: ThreadScopeDisposition;
	rationale: string;
}

export interface ThreadScopeRoutingInput {
	text: string;
	intent: Intent;
	recentThreadMessages?: Pick<DialogueMessage, "role" | "content">[];
}

export class ThreadScopeRouter {
	private readonly structured: StructuredGenerationEngine;

	constructor(private readonly llm: LLMProvider) {
		this.structured = new StructuredGenerationEngine(llm);
	}

	async route(
		input: ThreadScopeRoutingInput,
	): Promise<ThreadScopeRoutingDecision> {
		return this.structured.generate({
			spec: THREAD_SCOPE_ROUTING_SPEC,
			system: THREAD_SCOPE_ROUTING_SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: renderRoutingInput(input),
				},
			],
			maxTokens: 512,
			temperature: 0,
		});
	}
}

const THREAD_SCOPE_ROUTING_SYSTEM_PROMPT = `You are routing a new user message inside a persistent assistant thread.

There is an existing controllable intent in this thread (usually active or paused), and the system needs to know whether the new message should:
- current_intent: refine, constrain, or extend the existing intent
- pause_current_intent: pause the current intent and preserve it for later
- resume_current_intent: continue a paused intent
- cancel_current_intent: stop or cancel the existing intent
- new_intent: start a separate new task
- ambiguous: it could plausibly be either, so the system should ask for scope confirmation

Important:
- messages like "actually only...", "before you continue...", "also include...", or "keep it read-only" often modify the current intent
- messages like "先暂停", "pause this", "hold off for now", or "we can come back later" usually mean pause_current_intent
- messages like "继续刚才那个", "resume that", or "pick it back up" usually mean resume_current_intent when the existing intent is paused
- messages like "stop", "never mind", "cancel that", or "don't continue" usually mean cancel_current_intent
- messages that clearly introduce a distinct deliverable or unrelated goal are new_intent
- if the message could reasonably be interpreted either way, choose ambiguous
- prefer ambiguous over guessing when scope would materially change execution`;

const THREAD_SCOPE_ROUTING_SPEC = {
	name: "thread_scope_routing",
	description:
		"Classify whether a new thread message modifies, cancels, or branches away from the current active intent.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: ["disposition", "rationale"],
		properties: {
			disposition: {
				type: "string",
				enum: [
					"current_intent",
					"pause_current_intent",
					"resume_current_intent",
					"cancel_current_intent",
					"new_intent",
					"ambiguous",
				],
			},
			rationale: { type: "string" },
		},
	},
	validate(value: unknown): ThreadScopeRoutingDecision {
		if (!isObject(value)) {
			throw new Error("Thread scope routing payload must be an object");
		}
		const disposition =
			value.disposition === "current_intent" ||
			value.disposition === "pause_current_intent" ||
			value.disposition === "resume_current_intent" ||
			value.disposition === "cancel_current_intent" ||
			value.disposition === "new_intent" ||
			value.disposition === "ambiguous"
				? value.disposition
				: "ambiguous";
		const rationale =
			typeof value.rationale === "string" && value.rationale.trim().length > 0
				? value.rationale.trim()
				: "No rationale provided.";
		return { disposition, rationale };
	},
} as const;

function renderRoutingInput(input: ThreadScopeRoutingInput): string {
	const recentThread =
		input.recentThreadMessages && input.recentThreadMessages.length > 0
			? input.recentThreadMessages
					.slice(-6)
					.map((message) => `- ${message.role}: ${message.content}`)
					.join("\n")
			: "- none";
	const currentUnderstanding = input.intent.workingText ?? input.intent.raw;
	const contractSummary =
		typeof input.intent.contract?.summary === "string"
			? input.intent.contract.summary
			: "unknown";

	return [
		`Existing intent status: ${input.intent.status}`,
		`Existing intent summary: ${input.intent.goal.summary}`,
		`Existing intent raw request: ${input.intent.raw}`,
		`Current executable understanding: ${currentUnderstanding}`,
		`Current task contract: ${contractSummary}`,
		`Recent thread messages:\n${recentThread}`,
		`New user message:\n${input.text}`,
	].join("\n\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
