import type {
	Decision,
	DecisionResponseMode,
	LLMProvider,
} from "@nous/core";
import { StructuredGenerationEngine } from "@nous/runtime";

export interface DecisionResponseInterpretation {
	resolution: "approved" | "rejected" | "selected" | "free_text" | "unclear";
	selectedOptionId?: string;
	rationale: string;
}

export class DecisionResponseInterpreter {
	private readonly structured: StructuredGenerationEngine;

	constructor(private readonly llm: LLMProvider) {
		this.structured = new StructuredGenerationEngine(llm);
	}

	async interpret(params: {
		decision: Decision;
		text: string;
	}): Promise<DecisionResponseInterpretation> {
		if (params.decision.responseMode === "free_text") {
			return {
				resolution: "free_text",
				rationale: "Decision expects free-form text.",
			};
		}

		return this.structured.generate({
			spec: DECISION_RESPONSE_SPEC,
			system: renderSystemPrompt(params.decision.responseMode),
			messages: [
				{
					role: "user",
					content: renderDecisionInput(params.decision, params.text),
				},
			],
			maxTokens: 512,
			temperature: 0,
		});
	}
}

const DECISION_RESPONSE_SPEC = {
	name: "decision_response_interpretation",
	description:
		"Interpret a natural-language user reply against a pending decision.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: ["resolution", "selectedOptionId", "rationale"],
		properties: {
			resolution: {
				type: "string",
				enum: ["approved", "rejected", "selected", "free_text", "unclear"],
			},
			selectedOptionId: { type: ["string", "null"] },
			rationale: { type: "string" },
		},
	},
	validate(value: unknown): DecisionResponseInterpretation {
		if (!isObject(value)) {
			throw new Error("Decision response interpretation payload must be an object");
		}
		const resolution =
			value.resolution === "approved" ||
			value.resolution === "rejected" ||
			value.resolution === "selected" ||
			value.resolution === "free_text" ||
			value.resolution === "unclear"
				? value.resolution
				: "unclear";
		const selectedOptionId =
			typeof value.selectedOptionId === "string" &&
			value.selectedOptionId.trim().length > 0
				? value.selectedOptionId.trim()
				: undefined;
		const rationale =
			typeof value.rationale === "string" && value.rationale.trim().length > 0
				? value.rationale.trim()
				: "No rationale provided.";
		return { resolution, selectedOptionId, rationale };
	},
} as const;

function renderSystemPrompt(responseMode: DecisionResponseMode): string {
	if (responseMode === "approval") {
		return `You are interpreting a user's response to a pending approval decision.

Return:
- approved if the user clearly wants to proceed
- rejected if the user clearly wants to stop/cancel/reject
- unclear otherwise`;
	}

	return `You are interpreting a user's response to a pending single-choice decision.

Return:
- selected when the user clearly chose one listed option
- unclear otherwise

Only use a selectedOptionId that appears in the provided options.`;
}

function renderDecisionInput(decision: Decision, text: string): string {
	const questions =
		decision.questions.length > 0
			? decision.questions.map((question) => `- ${question}`).join("\n")
			: "- none";
	const options =
		decision.options && decision.options.length > 0
			? decision.options
					.map(
						(option) =>
							`- ${option.id}: ${option.label}${option.description ? ` — ${option.description}` : ""}` ,
					)
					.join("\n")
			: "- none";

	return [
		`Decision kind: ${decision.kind}`,
		`Decision response mode: ${decision.responseMode}`,
		`Decision summary: ${decision.summary}`,
		`Decision questions:\n${questions}`,
		`Decision options:\n${options}`,
		`User response:\n${text}`,
	].join("\n\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
