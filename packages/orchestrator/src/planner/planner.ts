import type {
	ExecutionDepthDecision,
	Intent,
	LLMProvider,
	Task,
	TaskContract,
} from "@nous/core";
import {
	CAPABILITY_NAMES,
	createLogger,
	isCapabilityName,
	now,
	prefixedId,
} from "@nous/core";
import { StructuredGenerationEngine } from "@nous/runtime";
import { detectCycle } from "./dag.ts";

const log = createLogger("task-planner");

const PLAN_SYSTEM_PROMPT =
	[
		"Decompose the given intent into atomic tasks. Each task should be completable by a single agent.",
		"capabilitiesRequired must use only concrete runtime capability tokens from this allowlist:",
		CAPABILITY_NAMES.join(", "),
		"If a task does not need a special permission boundary, return an empty array.",
		"Do not invent abstract skills such as conversation design, planning, research, or explanation.",
	].join(" ");

interface PlannedTask {
	id: number;
	description: string;
	dependsOn: number[];
	capabilitiesRequired: string[];
}

export interface TaskPlanningOptions {
	contract?: TaskContract;
	executionDepth?: ExecutionDepthDecision;
}

export class TaskPlanner {
	private readonly structured: StructuredGenerationEngine;

	constructor(private llm: LLMProvider) {
		this.structured = new StructuredGenerationEngine(llm);
	}

	async plan(
		intent: Intent,
		options: TaskPlanningOptions = {},
	): Promise<Task[]> {
		log.debug("Planning tasks for intent", {
			intentId: intent.id,
			goal: intent.goal.summary,
			planningDepth: options.executionDepth?.planningDepth,
		});

		if (options.executionDepth?.planningDepth === "none") {
			return [createSingleTask(intent, options.contract)];
		}

		let plannedTasks: PlannedTask[];
		try {
			const parsed = await this.structured.generate({
				spec: TASK_PLAN_SPEC,
				system: PLAN_SYSTEM_PROMPT,
				messages: [
					{
						role: "user",
						content: [
							`Intent: ${intent.workingText ?? intent.raw}`,
							`Goal: ${intent.goal.summary}`,
							`Success criteria: ${intent.goal.successCriteria.join(", ")}`,
							`Constraints: ${intent.constraints.map((c) => c.description).join(", ") || "none"}`,
							`Task contract summary: ${options.contract?.summary ?? intent.goal.summary}`,
							`Contract boundaries: ${options.contract?.boundaries.join(", ") || "none"}`,
							`Planning depth: ${options.executionDepth?.planningDepth ?? "full"}`,
							`Organization depth: ${options.executionDepth?.organizationDepth ?? "single_agent"}`,
							`Time depth: ${options.executionDepth?.timeDepth ?? "foreground"}`,
							options.executionDepth?.planningDepth === "light"
								? "Keep the plan compact. Prefer 1-3 high-value tasks."
								: "Use as many tasks as needed, but keep each task atomic.",
							options.executionDepth?.organizationDepth ===
							"parallel_specialists"
								? "Prefer independent branches when safe."
								: "Do not introduce parallel branches unless clearly useful.",
						].join("\n\n"),
					},
				],
				maxTokens: 2048,
				temperature: 0,
			});
			plannedTasks = parsed.tasks;
		} catch (err) {
			log.error("Failed to parse task plan JSON", {
				raw: String((err as Error).message).slice(0, 300),
			});
			throw new Error(
				`Failed to parse task plan from LLM response: ${(err as Error).message}`,
			);
		}

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

const TASK_PLAN_SPEC = {
	name: "task_plan",
	description:
		"Return a task decomposition where each task has a numeric id, description, dependencies, and required capabilities.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: ["tasks"],
		properties: {
			tasks: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					required: ["id", "description", "dependsOn", "capabilitiesRequired"],
					properties: {
						id: { type: "integer" },
						description: { type: "string" },
						dependsOn: {
							type: "array",
							items: { type: "integer" },
						},
						capabilitiesRequired: {
							type: "array",
							items: {
								type: "string",
								enum: [...CAPABILITY_NAMES],
							},
						},
					},
				},
			},
		},
	},
	validate(value: unknown): { tasks: PlannedTask[] } {
		if (!isObject(value) || !Array.isArray(value.tasks)) {
			throw new Error("Task plan must include a tasks array");
		}
		const tasks = value.tasks
			.map(normalizePlannedTask)
			.filter((task): task is PlannedTask => Boolean(task));
		if (tasks.length === 0) {
			throw new Error("Task plan produced no valid tasks");
		}
		return { tasks };
	},
} as const;

function normalizePlannedTask(value: unknown): PlannedTask | undefined {
	if (!isObject(value)) return undefined;
	const id =
		typeof value.id === "number" && Number.isInteger(value.id)
			? value.id
			: undefined;
	const description =
		typeof value.description === "string"
			? value.description.trim()
			: undefined;
	if (!id || !description) return undefined;
	const dependsOn = Array.isArray(value.dependsOn)
		? value.dependsOn.filter(
				(item): item is number =>
					typeof item === "number" && Number.isInteger(item),
			)
		: [];
	const capabilitiesRequired = Array.isArray(value.capabilitiesRequired)
		? value.capabilitiesRequired.filter(
				(item): item is string =>
					typeof item === "string" && item.trim().length > 0,
			)
		: [];
	const normalizedCapabilities = capabilitiesRequired.filter(isCapabilityName);
	if (
		normalizedCapabilities.length !== capabilitiesRequired.length &&
		capabilitiesRequired.length > 0
	) {
		log.warn("Planner returned non-runtime capability labels; dropping them", {
			description,
			capabilitiesRequired,
			normalizedCapabilities,
		});
	}
	return {
		id,
		description,
		dependsOn,
		capabilitiesRequired: normalizedCapabilities,
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createSingleTask(intent: Intent, contract?: TaskContract): Task {
	return {
		id: prefixedId("task"),
		intentId: intent.id,
		dependsOn: [],
		description:
			contract?.summary ||
			intent.goal.summary ||
			intent.workingText ||
			intent.raw,
		capabilitiesRequired: [],
		status: "created",
		retries: 0,
		maxRetries: 3,
		backoffSeconds: 2,
		createdAt: now(),
	};
}
