import type {
	LLMMessage,
	LLMProvider,
	LLMResponseFormat,
	LLMStructuredOutputMode,
} from "@nous/core";

export type StructuredOutputStrictness = "strict" | "repairable" | "prefer";

export interface StructuredOutputSpec<T> {
	name: string;
	schema: Record<string, unknown>;
	description: string;
	strictness?: StructuredOutputStrictness;
	validate(value: unknown): T;
}

export interface StructuredGenerationInput<T> {
	spec: StructuredOutputSpec<T>;
	messages: LLMMessage[];
	system?: string;
	maxTokens: number;
	temperature?: number;
	stopSequences?: string[];
	maxAttempts?: number;
}

export class StructuredGenerationError extends Error {
	constructor(
		message: string,
		readonly details?: {
			specName: string;
			mode: LLMStructuredOutputMode;
			attempt: number;
			rawText: string;
		},
	) {
		super(message);
		this.name = "StructuredGenerationError";
	}
}

export class StructuredGenerationEngine {
	constructor(private readonly llm: LLMProvider) {}

	async generate<T>(input: StructuredGenerationInput<T>): Promise<T> {
		const mode = selectStructuredOutputMode(this.llm);
		const maxAttempts = input.maxAttempts ?? 2;
		let lastError: StructuredGenerationError | undefined;

		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			const system = renderStructuredSystemPrompt({
				baseSystem: input.system,
				spec: input.spec,
				mode,
				previousError: lastError?.message,
			});
			const response = await this.llm.chat({
				system,
				messages: input.messages,
				maxTokens: input.maxTokens,
				temperature: input.temperature,
				stopSequences: input.stopSequences,
				responseFormat: toResponseFormat(mode, input.spec),
			});
			const rawText = response.content
				.filter((block) => block.type === "text")
				.map((block) => block.text)
				.join("");

			try {
				const parsed = JSON.parse(extractJson(rawText));
				return input.spec.validate(parsed);
			} catch (error) {
				lastError = new StructuredGenerationError(
					`Structured output failed for '${input.spec.name}': ${(error as Error).message}`,
					{
						specName: input.spec.name,
						mode,
						attempt,
						rawText: rawText.slice(0, 1000),
					},
				);
			}
		}

		throw lastError;
	}
}

export function extractJson(text: string): string {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced) return fenced[1].trim();
	const braceMatch = text.match(/\{[\s\S]*\}/);
	if (braceMatch) return braceMatch[0];
	const bracketMatch = text.match(/\[[\s\S]*\]/);
	if (bracketMatch) return bracketMatch[0];
	return text.trim();
}

function selectStructuredOutputMode(llm: LLMProvider): LLMStructuredOutputMode {
	const supported = llm.getCapabilities().structuredOutputModes;
	if (supported.includes("json_schema")) return "json_schema";
	if (supported.includes("json_object")) return "json_object";
	return "prompt_only";
}

function toResponseFormat<T>(
	mode: LLMStructuredOutputMode,
	spec: StructuredOutputSpec<T>,
): LLMResponseFormat | undefined {
	if (mode === "json_schema") {
		return {
			type: "json_schema",
			name: spec.name,
			schema: spec.schema,
			strict: spec.strictness !== "prefer",
		};
	}
	if (mode === "json_object") {
		return { type: "json_object" };
	}
	return undefined;
}

function renderStructuredSystemPrompt<T>(input: {
	baseSystem?: string;
	spec: StructuredOutputSpec<T>;
	mode: LLMStructuredOutputMode;
	previousError?: string;
}): string {
	const sections = [input.baseSystem?.trim(), input.spec.description.trim()];

	if (input.mode === "prompt_only" || input.mode === "tool_calling") {
		sections.push(
			"You MUST respond with ONLY a JSON object and no surrounding prose.",
		);
	}
	sections.push(
		`Required JSON schema:\n${JSON.stringify(input.spec.schema, null, 2)}`,
	);
	if (input.previousError) {
		sections.push(
			`Previous response failed validation: ${input.previousError}. Return corrected JSON only.`,
		);
	}

	return sections.filter(Boolean).join("\n\n");
}
