import type {
	Decision,
	DialogueMessage,
	Intent,
	InteractionMode,
	InteractionModeMatcherPolicy,
	LLMProvider,
} from "@nous/core";
import { DEFAULT_NOUS_MATCHING_CONFIG } from "@nous/core";
import { StructuredGenerationEngine } from "@nous/runtime";

/**
 * Daemon-side classifier for the chat / work / handoff boundary.
 *
 * Current caller:
 * - `packages/infra/src/daemon/server.ts` before a `send_message` turn is
 *   allowed to become governed work
 *
 * Policy intent:
 * - heuristic_only: cheap, bounded lexical routing
 * - semantic_only: let a semantic evaluator / structured signals own the route
 * - hybrid: keep obvious fast paths cheap while still allowing richer support
 */
export interface InteractionModeDecision {
	mode: InteractionMode;
	rationale: string;
	confidence: "high" | "medium" | "low";
}

export interface InteractionModeClassificationInput {
	text: string;
	activeIntent?: Intent;
	pendingDecision?: Decision;
	recentThreadMessages?: Pick<DialogueMessage, "role" | "content">[];
	threadMetadata?: Record<string, unknown>;
	restorationAllowed?: boolean;
}

export interface SemanticInteractionModeEvaluator {
	evaluate(
		input: InteractionModeClassificationInput,
	): Promise<InteractionModeDecision | undefined>;
}

export interface InteractionModeClassifierOptions {
	policy?: InteractionModeMatcherPolicy;
	semanticEvaluator?: SemanticInteractionModeEvaluator;
}

export class LlmInteractionModeSemanticEvaluator
	implements SemanticInteractionModeEvaluator
{
	private readonly structured: StructuredGenerationEngine;

	constructor(llm: LLMProvider) {
		this.structured = new StructuredGenerationEngine(llm);
	}

	async evaluate(
		input: InteractionModeClassificationInput,
	): Promise<InteractionModeDecision | undefined> {
		return this.structured.generate({
			spec: INTERACTION_MODE_SEMANTIC_SPEC,
			system: INTERACTION_MODE_SEMANTIC_SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: renderSemanticInput(input),
				},
			],
			maxTokens: 300,
			temperature: 0,
		});
	}
}

export class InteractionModeClassifier {
	private readonly policy: InteractionModeMatcherPolicy;
	private readonly semanticEvaluator?: SemanticInteractionModeEvaluator;

	constructor(options: InteractionModeClassifierOptions = {}) {
		this.policy =
			options.policy ?? DEFAULT_NOUS_MATCHING_CONFIG.interactionMode;
		this.semanticEvaluator = options.semanticEvaluator;
	}

	async classify(
		input: InteractionModeClassificationInput,
	): Promise<InteractionModeDecision> {
		const heuristic = classifyInteractionModeHeuristically(input, this.policy);
		if (this.policy.mode === "heuristic_only") {
			return heuristic;
		}
		if (this.policy.mode === "semantic_only") {
			// Semantic-only mode is allowed to bypass lexical routing entirely when a
			// caller wants stronger semantic interpretation to own the boundary.
			const semantic =
				(await this.semanticEvaluator?.evaluate(input)) ??
				classifyInteractionModeSemantically(input, this.policy);
			return semantic ?? buildSemanticFallbackDecision();
		}
		if (heuristic.mode !== "chat") {
			// In hybrid mode, a decisive heuristic result wins immediately. This keeps
			// obvious work/handoff routing cheap and avoids unnecessary model calls.
			return heuristic;
		}

		const semantic =
			(await this.semanticEvaluator?.evaluate(input)) ??
			classifyInteractionModeSemantically(input, this.policy);

		return reconcileInteractionModeDecision({
			input,
			heuristic,
			semantic,
		});
	}
}

function classifyInteractionModeHeuristically(
	input: InteractionModeClassificationInput,
	policy: InteractionModeMatcherPolicy,
): InteractionModeDecision {
	const text = input.text.trim();
	const normalized = normalize(text);
	const rules = policy.hybrid;

	if (
		rules.useLexicalHandoffPatterns &&
		matchesAny(normalized, HANDOFF_PATTERNS)
	) {
		return {
			mode: "handoff",
			rationale:
				"The message explicitly asks to package, attach, transfer, or hand off context to another surface or mode.",
			confidence: "high",
		};
	}

	if (
		rules.useLexicalActiveWorkPatterns &&
		input.activeIntent &&
		matchesAny(normalized, ACTIVE_WORK_GOVERNANCE_PATTERNS)
	) {
		return {
			mode: "work",
			rationale:
				"There is an active work item and the message explicitly resumes, revises, pauses, cancels, or constrains that work.",
			confidence: "high",
		};
	}

	if (
		rules.useLexicalExplicitWorkPatterns &&
		matchesAny(normalized, EXPLICIT_WORK_PATTERNS)
	) {
		return {
			mode: "work",
			rationale:
				"The message explicitly asks the assistant to begin or govern concrete work rather than continue lightweight conversation.",
			confidence: input.activeIntent ? "high" : "medium",
		};
	}

	if (
		rules.useLexicalChatRepairPatterns &&
		(matchesAny(normalized, CHAT_REPAIR_PATTERNS) ||
			isPreferenceNote(normalized))
	) {
		return {
			mode: "chat",
			rationale:
				"The message reads like conversational repair, recall, or lightweight preference chat rather than governed work.",
			confidence: matchesAny(normalized, CHAT_REPAIR_PATTERNS)
				? "high"
				: "medium",
		};
	}

	if (
		rules.useLexicalDecisionPatterns &&
		input.pendingDecision &&
		matchesAny(normalized, DECISIONISH_PATTERNS) &&
		normalized.length < 120
	) {
		return {
			mode: "work",
			rationale:
				"There is already blocked work and the message looks like governance language for that work rather than freeform chat.",
			confidence: "medium",
		};
	}

	if (rules.useAmbiguousChatFallback && isShortAmbiguousFollowUp(normalized)) {
		return {
			mode: "chat",
			rationale:
				"No explicit work-governance or handoff language was found, so ambiguity falls back to chat instead of silent work escalation.",
			confidence: "medium",
		};
	}

	return {
		mode: "chat",
		rationale:
			"Defaulted to chat because the message lacks explicit work-governance or handoff signals, and the mainline contract falls back to chat on ambiguity.",
		confidence: "low",
	};
}

function classifyInteractionModeSemantically(
	input: InteractionModeClassificationInput,
	policy: InteractionModeMatcherPolicy,
): InteractionModeDecision | undefined {
	// The built-in semantic path is intentionally bounded: it reads structured
	// runtime signals already present in state. Richer semantic interpretation can
	// be injected through `semanticEvaluator`.
	const text = input.text.trim();
	const hasStructuredHandoffSignal =
		Boolean(input.threadMetadata?.handoffCapsule) ||
		input.threadMetadata?.suggestedNextAction === "continue_chat";
	const hasStructuredWorkSignal =
		Boolean(input.activeIntent) || Boolean(input.pendingDecision);

	if (policy.hybrid.useStructuredHandoffSignal && hasStructuredHandoffSignal) {
		return {
			mode: "handoff",
			rationale:
				"The current thread metadata already carries a structured handoff signal, so this message belongs to the handoff surface.",
			confidence: "medium",
		};
	}

	if (
		policy.hybrid.useStructuredRestorationSignal &&
		input.restorationAllowed
	) {
		return {
			mode: "work",
			rationale:
				"A promoted structured context-continuity memory matched the current scene and passed permission/boundary checks, so governed work continuity may be restored safely.",
			confidence: "medium",
		};
	}

	if (
		policy.hybrid.useStructuredWorkSignal &&
		input.pendingDecision &&
		text.length <= 120
	) {
		return {
			mode: "work",
			rationale:
				"There is already blocked work and the current turn semantically belongs to that governance path.",
			confidence: "medium",
		};
	}

	if (
		policy.hybrid.useStructuredWorkSignal &&
		!hasStructuredWorkSignal &&
		!input.restorationAllowed &&
		!hasStructuredHandoffSignal &&
		text.length <= 80
	) {
		return {
			mode: "chat",
			rationale:
				"No structured work or handoff signal is active, so ambiguity stays in chat instead of silently escalating into work.",
			confidence: "medium",
		};
	}

	return undefined;
}

function reconcileInteractionModeDecision(params: {
	input: InteractionModeClassificationInput;
	heuristic: InteractionModeDecision;
	semantic?: InteractionModeDecision;
}): InteractionModeDecision {
	const { input, heuristic, semantic } = params;
	if (!semantic) {
		return heuristic;
	}
	if (semantic.mode === heuristic.mode) {
		return {
			mode: semantic.mode,
			confidence:
				confidenceScore(semantic.confidence) >=
				confidenceScore(heuristic.confidence)
					? semantic.confidence
					: heuristic.confidence,
			rationale: `${heuristic.rationale} | ${semantic.rationale}`,
		};
	}
	if (
		heuristic.mode === "chat" &&
		semantic.mode === "work" &&
		!input.activeIntent &&
		!input.pendingDecision &&
		!input.restorationAllowed
	) {
		return heuristic;
	}
	return confidenceScore(semantic.confidence) >=
		confidenceScore(heuristic.confidence)
		? semantic
		: heuristic;
}

function buildSemanticFallbackDecision(): InteractionModeDecision {
	return {
		mode: "chat",
		confidence: "low",
		rationale:
			"Semantic-only interaction matching was requested, but no semantic evaluator or structured semantic signal was available, so the classifier fell back to safe chat mode.",
	};
}

function confidenceScore(
	confidence: InteractionModeDecision["confidence"],
): number {
	switch (confidence) {
		case "high":
			return 0.9;
		case "medium":
			return 0.7;
		case "low":
			return 0.45;
	}
}

const HANDOFF_PATTERNS = [
	"handoff",
	"hand off",
	"hand this off",
	"attach this to",
	"attach to ide",
	"transfer this",
	"transfer context",
	"package this context",
	"make a capsule",
	"create a capsule",
	"capsule",
	"carry this over",
	"continue this in ide",
	"转交",
	"交接",
	"转到ide",
	"附到ide",
	"打包成 capsule",
	"打包成capsule",
];

const ACTIVE_WORK_GOVERNANCE_PATTERNS = [
	"continue this work",
	"resume that",
	"resume it",
	"keep working",
	"also focus",
	"only focus",
	"keep it read-only",
	"make it read only",
	"pause this",
	"cancel that",
	"stop this",
	"stop this task",
	"don't continue",
	"scope update",
	"resume",
	"continue the task",
	"继续刚才",
	"继续这个任务",
	"先暂停",
	"取消这个任务",
	"只看",
	"保持只读",
];

const EXPLICIT_WORK_PATTERNS = [
	"start a new task",
	"new task",
	"new request",
	"implement",
	"refactor",
	"inspect",
	"summarize",
	"investigate",
	"debug",
	"review this",
	"analyze this",
	"write a",
	"build a",
	"create a plan",
	"开一个新任务",
	"开始新任务",
	"实现",
	"重构",
	"检查",
	"分析",
	"调试",
	"总结",
];

const CHAT_REPAIR_PATTERNS = [
	"say that shorter",
	"shorter",
	"rephrase",
	"rewrite that",
	"change the tone",
	"say it differently",
	"what did i just mean",
	"do you remember",
	"thanks",
	"thank you",
	"换个说法",
	"说短一点",
	"简短一点",
	"你还记得",
	"刚才那个",
];

const DECISIONISH_PATTERNS = [
	"yes",
	"no",
	"pick the first",
	"choose the first",
	"option",
	"queue it",
	"cancel it",
	"proceed",
	"可以",
	"不要",
	"选第一个",
	"继续",
];

const INTERACTION_MODE_SEMANTIC_SYSTEM_PROMPT = `Classify the message as one of:
- chat
- work
- handoff

Rules:
- default to chat on ambiguity
- choose work only when the user is clearly asking to begin, resume, govern, or meaningfully alter governed work
- choose handoff only when the user is clearly packaging or transferring context across surfaces/modes
- short conversational repairs, preference notes, or vague follow-ups should stay chat
- if structured restoration is already allowed, work is valid when the request is clearly trying to resume that work`;

const INTERACTION_MODE_SEMANTIC_SPEC = {
	name: "interaction_mode_semantic_decision",
	description: "Semantically classify a message into chat, work, or handoff.",
	schema: {
		type: "object",
		additionalProperties: false,
		required: ["mode", "rationale", "confidence"],
		properties: {
			mode: { type: "string", enum: ["chat", "work", "handoff"] },
			rationale: { type: "string" },
			confidence: { type: "string", enum: ["high", "medium", "low"] },
		},
	},
	validate(value: unknown): InteractionModeDecision {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new Error("Semantic interaction mode decision must be an object.");
		}
		const candidate = value as Record<string, unknown>;
		const mode =
			candidate.mode === "chat" ||
			candidate.mode === "work" ||
			candidate.mode === "handoff"
				? candidate.mode
				: "chat";
		const rationale =
			typeof candidate.rationale === "string" && candidate.rationale.trim()
				? candidate.rationale.trim()
				: "No semantic rationale provided.";
		const confidence =
			candidate.confidence === "high" ||
			candidate.confidence === "medium" ||
			candidate.confidence === "low"
				? candidate.confidence
				: "low";
		return { mode, rationale, confidence };
	},
} as const;

function renderSemanticInput(
	input: InteractionModeClassificationInput,
): string {
	const recentMessages =
		input.recentThreadMessages && input.recentThreadMessages.length > 0
			? input.recentThreadMessages
					.slice(-6)
					.map((message) => `- ${message.role}: ${message.content}`)
					.join("\n")
			: "- none";
	return [
		`Message:\n${input.text.trim()}`,
		`Active work present: ${input.activeIntent ? "yes" : "no"}`,
		`Pending decision present: ${input.pendingDecision ? "yes" : "no"}`,
		`Structured restoration already allowed: ${input.restorationAllowed ? "yes" : "no"}`,
		`Recent thread messages:\n${recentMessages}`,
		input.threadMetadata
			? `Thread metadata:\n${JSON.stringify(input.threadMetadata, null, 2)}`
			: undefined,
	]
		.filter(Boolean)
		.join("\n\n");
}

function normalize(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesAny(text: string, patterns: string[]): boolean {
	return patterns.some((pattern) => text.includes(pattern));
}

function isPreferenceNote(text: string): boolean {
	return (
		text.includes("i don't like") ||
		text.includes("i do not like") ||
		text.includes("prefer ") ||
		text.includes("我不喜欢") ||
		text.includes("我更喜欢")
	);
}

function isShortAmbiguousFollowUp(text: string): boolean {
	return text.length <= 80 && !matchesAny(text, EXPLICIT_WORK_PATTERNS);
}
