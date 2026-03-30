import type {
	Decision,
	DialogueMessage,
	Intent,
	LLMProvider,
} from "@nous/core";
import { StructuredGenerationEngine } from "@nous/runtime";

export type ThreadInputDisposition =
	| "decision_response"
	| "pause_current_intent"
	| "cancel_current_intent"
	| "new_intent"
	| "mixed"
	| "unclear";

export interface ThreadInputRoutingDecision {
	disposition: ThreadInputDisposition;
	rationale: string;
}

export interface ThreadInputRoutingInput {
	text: string;
	intent: Intent;
	decision: Decision;
	recentThreadMessages?: Pick<DialogueMessage, "role" | "content">[];
}

export class ThreadInputRouter {
	private readonly structured: StructuredGenerationEngine;

	constructor(private readonly llm: LLMProvider) {
		this.structured = new StructuredGenerationEngine(llm);
	}

	async route(
		input: ThreadInputRoutingInput,
	): Promise<ThreadInputRoutingDecision> {
		const routed = await this.structured.generate({
			spec: THREAD_INPUT_ROUTING_SPEC,
			system: THREAD_INPUT_ROUTING_SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: renderRoutingInput(input),
				},
			],
			maxTokens: 512,
			temperature: 0,
		});
		return routed;
	}
}

const THREAD_INPUT_ROUTING_SYSTEM_PROMPT = `You are routing a new user message inside a persistent assistant thread.

There is an existing intent blocked on a pending decision.

Choose:
- decision_response: the message is primarily resolving or constraining the pending decision for the existing intent
- pause_current_intent: the message is primarily pausing the existing intent without cancelling it
- cancel_current_intent: the message is primarily stopping or cancelling the existing intent itself
- new_intent: the message is primarily a separate new task
- mixed: the message clearly does both
- unclear: the message is too ambiguous to route confidently

Important:
- short fragmentary answers like "look at branch X", "yes proceed", or "pick the first option" are usually decision_response
- messages like "先暂停", "pause this for now", or "we can come back later" should usually be pause_current_intent, even if a decision is pending
- messages like "stop", "cancel that", or "never mind" should usually be cancel_current_intent, even if a decision is pending
- do not classify as new_intent merely because the user phrased the answer as an imperative
- prefer decision_response when the message materially resolves the pending decision`;

const THREAD_INPUT_ROUTING_SPEC = {
	name: "thread_input_routing",
	description:
		"Classify whether a new thread message is resolving the pending decision, cancelling the current intent, or starting a new intent.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: ["disposition", "rationale"],
		properties: {
			disposition: {
				type: "string",
				enum: [
					"decision_response",
					"pause_current_intent",
					"cancel_current_intent",
					"new_intent",
					"mixed",
					"unclear",
				],
			},
			rationale: { type: "string" },
		},
	},
	validate(value: unknown): ThreadInputRoutingDecision {
		if (!isObject(value)) {
			throw new Error("Thread input routing payload must be an object");
		}
		const disposition =
			value.disposition === "decision_response" ||
			value.disposition === "pause_current_intent" ||
			value.disposition === "cancel_current_intent" ||
			value.disposition === "new_intent" ||
			value.disposition === "mixed" ||
			value.disposition === "unclear"
				? value.disposition
				: "unclear";
		const rationale =
			typeof value.rationale === "string" && value.rationale.trim().length > 0
				? value.rationale.trim()
				: "No rationale provided.";
		return { disposition, rationale };
	},
} as const;

function renderRoutingInput(input: ThreadInputRoutingInput): string {
	const recentThread =
		input.recentThreadMessages && input.recentThreadMessages.length > 0
			? input.recentThreadMessages
					.slice(-6)
					.map((message) => `- ${message.role}: ${message.content}`)
					.join("\n")
			: "- none";
	const questions =
		input.decision.questions.length > 0
			? input.decision.questions.map((question) => `- ${question}`).join("\n")
			: "- none";
	const options =
		input.decision.options && input.decision.options.length > 0
			? input.decision.options
					.map(
						(option) =>
							`- ${option.id}: ${option.label}${option.description ? ` — ${option.description}` : ""}`,
					)
					.join("\n")
			: "- none";

	return [
		`Existing intent status: ${input.intent.status}`,
		`Existing intent summary: ${input.intent.goal.summary}`,
		`Existing intent raw request: ${input.intent.raw}`,
		`Current executable understanding: ${input.intent.workingText ?? input.intent.raw}`,
		`Pending decision kind: ${input.decision.kind}`,
		`Pending decision response mode: ${input.decision.responseMode}`,
		`Pending decision summary: ${input.decision.summary}`,
		`Pending decision questions:\n${questions}`,
		`Pending decision options:\n${options}`,
		`Recent thread messages:\n${recentThread}`,
		`New user message:\n${input.text}`,
	].join("\n\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
