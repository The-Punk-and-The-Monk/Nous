import type {
	Intent,
	LLMProvider,
	TaskIntake,
	UserStateGrounding,
} from "@nous/core";
import { createLogger, now, prefixedId } from "@nous/core";
import { StructuredGenerationEngine } from "@nous/runtime";

const log = createLogger("intent-parser");

const PARSE_SYSTEM_PROMPT = `Extract from the user's request:
- goal: summary + success criteria
- constraints: any limits mentioned
- priority: 0=low, 1=normal, 2=high, 3=urgent`;

export class IntentParser {
	private readonly structured: StructuredGenerationEngine;

	constructor(private llm: LLMProvider) {
		this.structured = new StructuredGenerationEngine(llm);
	}

	async parse(rawText: string): Promise<Intent> {
		log.debug("Parsing intent", { raw: rawText.slice(0, 100) });
		try {
			const parsed = await this.structured.generate({
				spec: INTENT_PARSE_SPEC,
				system: PARSE_SYSTEM_PROMPT,
				messages: [{ role: "user", content: rawText }],
				maxTokens: 1024,
				temperature: 0,
			});
			return {
				id: prefixedId("int"),
				raw: rawText,
				goal: parsed.goal,
				constraints: parsed.constraints,
				priority: parsed.priority,
				humanCheckpoints: "always",
				status: "active",
				source: "human",
				createdAt: now(),
			};
		} catch (err) {
			log.error("Failed to parse intent JSON", {
				raw: String((err as Error).message).slice(0, 300),
			});
			throw new Error(
				`Failed to parse intent from LLM response: ${(err as Error).message}`,
			);
		}
	}

	async analyze(
		rawText: string,
		options: IntentAnalysisOptions = {},
	): Promise<TaskIntake> {
		log.debug("Analyzing task intake", { raw: rawText.slice(0, 120) });
		try {
			const parsed = await this.structured.generate({
				spec: TASK_INTAKE_SPEC,
				system: TASK_INTAKE_SYSTEM_PROMPT,
				messages: [
					{
						role: "user",
						content: renderIntakeInput(rawText, options.grounding),
					},
				],
				maxTokens: 1536,
				temperature: 0,
			});

			const intent: Intent = {
				id: prefixedId("int"),
				raw: rawText,
				goal: parsed.goal,
				constraints: parsed.constraints,
				priority: parsed.priority,
				humanCheckpoints: parsed.humanCheckpoints,
				contract: parsed.contract,
				executionDepth: parsed.executionDepth,
				clarificationQuestions: parsed.clarificationQuestions,
				status: "active",
				source: options.source ?? "human",
				createdAt: now(),
			};

			return {
				intent,
				contract: parsed.contract,
				executionDepth: parsed.executionDepth,
				clarificationQuestions: parsed.clarificationQuestions,
				groundingSummary: options.grounding?.summary,
			};
		} catch (err) {
			log.error("Failed to analyze task intake JSON", {
				raw: String((err as Error).message).slice(0, 300),
			});
			throw new Error(
				`Failed to analyze task intake from LLM response: ${(err as Error).message}`,
			);
		}
	}
}

export interface IntentAnalysisOptions {
	grounding?: UserStateGrounding;
	source?: Intent["source"];
}

const INTENT_PARSE_SPEC = {
	name: "intent_parse",
	description:
		"Return a structured intent object with goal, success criteria, constraints, and priority.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: ["goal", "constraints", "priority"],
		properties: {
			goal: {
				type: "object",
				additionalProperties: false,
				required: ["summary", "successCriteria"],
				properties: {
					summary: { type: "string" },
					successCriteria: {
						type: "array",
						items: { type: "string" },
					},
				},
			},
			constraints: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					required: ["type", "description"],
					properties: {
						type: {
							type: "string",
							enum: [
								"forbidden_action",
								"resource_limit",
								"time_limit",
								"scope_limit",
							],
						},
						description: { type: "string" },
						value: {},
					},
				},
			},
			priority: {
				type: "integer",
				enum: [0, 1, 2, 3],
			},
		},
	},
	validate(value: unknown): {
		goal: Intent["goal"];
		constraints: Intent["constraints"];
		priority: number;
	} {
		if (!isObject(value)) {
			throw new Error("Intent payload must be an object");
		}
		const goal = value.goal;
		if (!isObject(goal) || typeof goal.summary !== "string") {
			throw new Error("Intent goal.summary must be a string");
		}
		const successCriteria = Array.isArray(goal.successCriteria)
			? goal.successCriteria
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim())
					.filter(Boolean)
			: [];
		const constraints = Array.isArray(value.constraints)
			? value.constraints
					.map(normalizeConstraint)
					.filter((item): item is Intent["constraints"][number] =>
						Boolean(item),
					)
			: [];
		const priority =
			typeof value.priority === "number" &&
			Number.isInteger(value.priority) &&
			value.priority >= 0 &&
			value.priority <= 3
				? value.priority
				: 1;
		return {
			goal: {
				summary: goal.summary.trim(),
				successCriteria:
					successCriteria.length > 0 ? successCriteria : [goal.summary.trim()],
			},
			constraints,
			priority,
		};
	},
} as const;

const TASK_INTAKE_SYSTEM_PROMPT = `You are analyzing an incoming request for a persistent personal assistant.

Return:
- the structured intent
- a task contract the system should honor
- an execution depth decision
- clarification questions only if ambiguity would materially affect safe or useful execution

Important:
- do not treat command-like requests as a separate ontology
- "planningDepth: none" means safe obvious execution can remain bounded without a multi-step explicit task DAG
- prefer minimal interruption unless the request is ambiguous or high-risk`;

const TASK_INTAKE_SPEC = {
	name: "task_intake",
	description:
		"Return the structured intent, task contract, execution depth, and clarification questions for an incoming request.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: [
			"goal",
			"constraints",
			"priority",
			"humanCheckpoints",
			"contract",
			"executionDepth",
			"clarificationQuestions",
		],
		properties: {
			goal: INTENT_PARSE_SPEC.schema.properties.goal,
			constraints: INTENT_PARSE_SPEC.schema.properties.constraints,
			priority: INTENT_PARSE_SPEC.schema.properties.priority,
			humanCheckpoints: {
				type: "string",
				enum: ["always", "irreversible_only", "never"],
			},
			contract: {
				type: "object",
				additionalProperties: false,
				required: [
					"summary",
					"successCriteria",
					"boundaries",
					"interruptionPolicy",
					"deliveryMode",
				],
				properties: {
					summary: { type: "string" },
					successCriteria: {
						type: "array",
						items: { type: "string" },
					},
					boundaries: {
						type: "array",
						items: { type: "string" },
					},
					interruptionPolicy: {
						type: "string",
						enum: ["minimal", "risk_only", "interactive"],
					},
					deliveryMode: {
						type: "string",
						enum: ["concise", "structured_with_evidence"],
					},
				},
			},
			executionDepth: {
				type: "object",
				additionalProperties: false,
				required: [
					"planningDepth",
					"timeDepth",
					"organizationDepth",
					"initiativeMode",
					"rationale",
				],
				properties: {
					planningDepth: {
						type: "string",
						enum: ["none", "light", "full"],
					},
					timeDepth: {
						type: "string",
						enum: ["foreground", "background"],
					},
					organizationDepth: {
						type: "string",
						enum: [
							"single_agent",
							"serial_specialists",
							"parallel_specialists",
						],
					},
					initiativeMode: {
						type: "string",
						enum: ["reactive", "proactive"],
					},
					rationale: { type: "string" },
				},
			},
			clarificationQuestions: {
				type: "array",
				items: { type: "string" },
			},
		},
	},
	validate(value: unknown): {
		goal: Intent["goal"];
		constraints: Intent["constraints"];
		priority: number;
		humanCheckpoints: Intent["humanCheckpoints"];
		contract: TaskIntake["contract"];
		executionDepth: TaskIntake["executionDepth"];
		clarificationQuestions: string[];
	} {
		if (!isObject(value)) {
			throw new Error("Task intake payload must be an object");
		}
		const parsedIntent = INTENT_PARSE_SPEC.validate({
			goal: value.goal,
			constraints: value.constraints,
			priority: value.priority,
		});
		const humanCheckpoints =
			value.humanCheckpoints === "always" ||
			value.humanCheckpoints === "irreversible_only" ||
			value.humanCheckpoints === "never"
				? value.humanCheckpoints
				: "always";
		const contract = normalizeTaskContract(value.contract, parsedIntent.goal);
		const executionDepth = normalizeExecutionDepth(value.executionDepth);
		const clarificationQuestions = Array.isArray(value.clarificationQuestions)
			? value.clarificationQuestions
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim())
					.filter(Boolean)
			: [];
		return {
			...parsedIntent,
			humanCheckpoints,
			contract,
			executionDepth,
			clarificationQuestions,
		};
	},
} as const;

function normalizeConstraint(
	value: unknown,
): Intent["constraints"][number] | undefined {
	if (!isObject(value)) return undefined;
	if (
		value.type !== "forbidden_action" &&
		value.type !== "resource_limit" &&
		value.type !== "time_limit" &&
		value.type !== "scope_limit"
	) {
		return undefined;
	}
	if (
		typeof value.description !== "string" ||
		value.description.trim().length === 0
	) {
		return undefined;
	}
	return {
		type: value.type,
		description: value.description.trim(),
		value: value.value,
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTaskContract(
	value: unknown,
	goal: Intent["goal"],
): TaskIntake["contract"] {
	if (!isObject(value)) {
		return {
			summary: goal.summary,
			successCriteria: goal.successCriteria,
			boundaries: [],
			interruptionPolicy: "risk_only",
			deliveryMode: "structured_with_evidence",
		};
	}
	const summary =
		typeof value.summary === "string" && value.summary.trim().length > 0
			? value.summary.trim()
			: goal.summary;
	const successCriteria = Array.isArray(value.successCriteria)
		? value.successCriteria
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: goal.successCriteria;
	const boundaries = Array.isArray(value.boundaries)
		? value.boundaries
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
	const interruptionPolicy =
		value.interruptionPolicy === "minimal" ||
		value.interruptionPolicy === "risk_only" ||
		value.interruptionPolicy === "interactive"
			? value.interruptionPolicy
			: "risk_only";
	const deliveryMode =
		value.deliveryMode === "concise" ||
		value.deliveryMode === "structured_with_evidence"
			? value.deliveryMode
			: "structured_with_evidence";
	return {
		summary,
		successCriteria:
			successCriteria.length > 0 ? successCriteria : goal.successCriteria,
		boundaries,
		interruptionPolicy,
		deliveryMode,
	};
}

function normalizeExecutionDepth(value: unknown): TaskIntake["executionDepth"] {
	if (!isObject(value)) {
		return {
			planningDepth: "full",
			timeDepth: "foreground",
			organizationDepth: "single_agent",
			initiativeMode: "reactive",
			rationale: "Defaulted because execution depth payload was missing.",
		};
	}
	const planningDepth =
		value.planningDepth === "none" ||
		value.planningDepth === "light" ||
		value.planningDepth === "full"
			? value.planningDepth
			: "full";
	const timeDepth =
		value.timeDepth === "foreground" || value.timeDepth === "background"
			? value.timeDepth
			: "foreground";
	const organizationDepth =
		value.organizationDepth === "single_agent" ||
		value.organizationDepth === "serial_specialists" ||
		value.organizationDepth === "parallel_specialists"
			? value.organizationDepth
			: "single_agent";
	const initiativeMode =
		value.initiativeMode === "reactive" || value.initiativeMode === "proactive"
			? value.initiativeMode
			: "reactive";
	const rationale =
		typeof value.rationale === "string" && value.rationale.trim().length > 0
			? value.rationale.trim()
			: "No rationale provided.";
	return {
		planningDepth,
		timeDepth,
		organizationDepth,
		initiativeMode,
		rationale,
	};
}

function renderIntakeInput(
	rawText: string,
	grounding?: UserStateGrounding,
): string {
	if (!grounding) {
		return `Incoming request:\n${rawText}`;
	}

	const activeIntentLines =
		grounding.activeIntentSummaries.length > 0
			? grounding.activeIntentSummaries.map((item) => `- ${item}`).join("\n")
			: "- none";
	const memoryHintLines =
		grounding.recentMemoryHints.length > 0
			? grounding.recentMemoryHints.map((item) => `- ${item}`).join("\n")
			: "- none";
	const recentThreadLines =
		grounding.recentThreadMessages && grounding.recentThreadMessages.length > 0
			? grounding.recentThreadMessages.map((item) => `- ${item}`).join("\n")
			: "- none";

	return [
		"Grounding (use to disambiguate the user's situation, but do not override the explicit request):",
		`Summary: ${grounding.summary}`,
		`Channel context: cwd=${grounding.channelContext?.workingDirectory ?? "unknown"}; projectRoot=${grounding.channelContext?.projectRoot ?? "unknown"}; focusedFile=${grounding.channelContext?.focusedFile ?? "none"}`,
		`Active intents:\n${activeIntentLines}`,
		`Recent memory hints:\n${memoryHintLines}`,
		`Recent thread messages:\n${recentThreadLines}`,
		`Incoming request:\n${rawText}`,
	].join("\n\n");
}
