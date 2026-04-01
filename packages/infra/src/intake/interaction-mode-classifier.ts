import type {
	Decision,
	DialogueMessage,
	Intent,
	InteractionMode,
	LLMProvider,
} from "@nous/core";

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

export class InteractionModeClassifier {
	async classify(
		input: InteractionModeClassificationInput,
	): Promise<InteractionModeDecision> {
		return classifyInteractionMode(input);
	}
}

function classifyInteractionMode(
	input: InteractionModeClassificationInput,
): InteractionModeDecision {
	const text = input.text.trim();
	const normalized = normalize(text);

	if (matchesAny(normalized, HANDOFF_PATTERNS)) {
		return {
			mode: "handoff",
			rationale:
				"The message explicitly asks to package, attach, transfer, or hand off context to another surface or mode.",
			confidence: "high",
		};
	}

	if (
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

	if (matchesAny(normalized, EXPLICIT_WORK_PATTERNS)) {
		return {
			mode: "work",
			rationale:
				"The message explicitly asks the assistant to begin or govern concrete work rather than continue lightweight conversation.",
			confidence: input.activeIntent ? "high" : "medium",
		};
	}

	if (input.restorationAllowed) {
		return {
			mode: "work",
			rationale:
				"A promoted structured work-continuity memory matched the current scene and passed permission/boundary checks, so work continuity may be restored safely.",
			confidence: "medium",
		};
	}

	if (
		matchesAny(normalized, CHAT_REPAIR_PATTERNS) ||
		isPreferenceNote(normalized) ||
		isShortAmbiguousFollowUp(normalized)
	) {
		return {
			mode: "chat",
			rationale:
				"The message reads like conversational repair, recall, lightweight preference chat, or an ambiguous follow-up that should not silently enter work governance.",
			confidence: matchesAny(normalized, CHAT_REPAIR_PATTERNS)
				? "high"
				: "medium",
		};
	}

	if (
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

	return {
		mode: "chat",
		rationale:
			"Defaulted to chat because the message lacks explicit work-governance or handoff signals, and the mainline contract falls back to chat on ambiguity.",
		confidence: "low",
	};
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
