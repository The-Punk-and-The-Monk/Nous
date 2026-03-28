import type { Intent, LLMProvider } from "@nous/core";
import { createLogger, now, prefixedId } from "@nous/core";

const log = createLogger("intent-parser");

const PARSE_SYSTEM_PROMPT = `You are a JSON-only intent parser. You MUST respond with ONLY a JSON object, no other text.

Extract from the user's request:
- goal: summary + success criteria
- constraints: any limits mentioned
- priority: 0=low, 1=normal, 2=high, 3=urgent

Your entire response must be this exact JSON structure and nothing else:
{"goal":{"summary":"...","successCriteria":["..."]},"constraints":[],"priority":1}`;

export class IntentParser {
	constructor(private llm: LLMProvider) {}

	async parse(rawText: string): Promise<Intent> {
		log.debug("Parsing intent", { raw: rawText.slice(0, 100) });
		const response = await this.llm.chat({
			system: PARSE_SYSTEM_PROMPT,
			messages: [{ role: "user", content: rawText }],
			maxTokens: 1024,
			temperature: 0,
		});

		const text = response.content
			.filter((b) => b.type === "text")
			.map((b) => (b as { text: string }).text)
			.join("");

		let parsed: {
			goal: Intent["goal"];
			constraints: Intent["constraints"];
			priority: number;
		};
		try {
			parsed = JSON.parse(extractJson(text));
		} catch (err) {
			log.error("Failed to parse intent JSON", { raw: text.slice(0, 300) });
			throw new Error(
				`Failed to parse intent from LLM response: ${(err as Error).message}\nRaw response: ${text.slice(0, 500)}`,
			);
		}

		return {
			id: prefixedId("int"),
			raw: rawText,
			goal: parsed.goal,
			constraints: parsed.constraints ?? [],
			priority: parsed.priority ?? 1,
			humanCheckpoints: "always",
			status: "active",
			source: "human",
			createdAt: now(),
		};
	}
}

/** Extract JSON from LLM response that might have markdown code fences */
function extractJson(text: string): string {
	// Try markdown code fence first
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced) return fenced[1].trim();
	// Try to find raw JSON object
	const braceMatch = text.match(/\{[\s\S]*\}/);
	if (braceMatch) return braceMatch[0];
	// Try JSON array
	const bracketMatch = text.match(/\[[\s\S]*\]/);
	if (bracketMatch) return bracketMatch[0];
	return text;
}
