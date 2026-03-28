import type { Intent, LLMProvider, Task } from "@nous/core";
import { createLogger, now, prefixedId } from "@nous/core";

const log = createLogger("task-planner");
import { detectCycle } from "./dag.ts";

const PLAN_SYSTEM_PROMPT = `You are a JSON-only task planner. You MUST respond with ONLY a JSON object, no other text.

Decompose the given intent into atomic tasks. Each task should be completable by a single agent.

Your entire response must be this exact JSON structure and nothing else:
{"tasks":[{"id":1,"description":"...","dependsOn":[],"capabilitiesRequired":["fs.read"]}]}`;

interface PlannedTask {
	id: number;
	description: string;
	dependsOn: number[];
	capabilitiesRequired: string[];
}

export class TaskPlanner {
	constructor(private llm: LLMProvider) {}

	async plan(intent: Intent): Promise<Task[]> {
		log.debug("Planning tasks for intent", {
			intentId: intent.id,
			goal: intent.goal.summary,
		});
		const response = await this.llm.chat({
			system: PLAN_SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: `Intent: ${intent.raw}\n\nGoal: ${intent.goal.summary}\nSuccess criteria: ${intent.goal.successCriteria.join(", ")}\nConstraints: ${intent.constraints.map((c) => c.description).join(", ") || "none"}`,
				},
			],
			maxTokens: 2048,
			temperature: 0,
		});

		const text = response.content
			.filter((b) => b.type === "text")
			.map((b) => (b as { text: string }).text)
			.join("");

		let parsed: { tasks: PlannedTask[] };
		try {
			parsed = JSON.parse(extractJson(text));
		} catch (err) {
			log.error("Failed to parse task plan JSON", { raw: text.slice(0, 300) });
			throw new Error(
				`Failed to parse task plan from LLM response: ${(err as Error).message}\nRaw response: ${text.slice(0, 500)}`,
			);
		}
		const plannedTasks: PlannedTask[] = parsed.tasks;

		// Map numeric IDs to real ULID-based IDs
		const idMap = new Map<number, string>();
		for (const pt of plannedTasks) {
			idMap.set(pt.id, prefixedId("task"));
		}

		const tasks: Task[] = plannedTasks.map((pt) => ({
			id: idMap.get(pt.id) as string,
			intentId: intent.id,
			dependsOn: pt.dependsOn
				.map((d) => idMap.get(d) as string)
				.filter(Boolean),
			description: pt.description,
			capabilitiesRequired: pt.capabilitiesRequired,
			status: "created" as const,
			retries: 0,
			maxRetries: 3,
			backoffSeconds: 2,
			createdAt: now(),
		}));

		// Validate — no cycles
		const cycle = detectCycle(tasks);
		if (cycle) {
			throw new Error(
				`Planner produced a cyclic task graph: ${cycle.join(" → ")}`,
			);
		}

		return tasks;
	}
}

function extractJson(text: string): string {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced) return fenced[1].trim();
	const braceMatch = text.match(/\{[\s\S]*\}/);
	if (braceMatch) return braceMatch[0];
	const bracketMatch = text.match(/\[[\s\S]*\]/);
	if (bracketMatch) return bracketMatch[0];
	return text;
}
