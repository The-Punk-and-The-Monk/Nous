import type {
	AnswerArtifact,
	DialogueMessage,
	ProcessItem,
	TurnResolutionSnapshot,
} from "@nous/core";
import { colors } from "../ui/colors.ts";

export function renderDialogueMessage(
	message: DialogueMessage,
	options?: { prefix?: string },
): void {
	for (const line of formatDialogueMessageLines(message, options)) {
		console.log(line);
	}
}

export function formatDialogueMessageLines(
	message: DialogueMessage,
	options?: { prefix?: string },
): string[] {
	const prefix = options?.prefix ? `${options.prefix} ` : "  ";
	const presentation = String(message.metadata?.presentation ?? "");
	const processItem = isProcessItem(message.metadata?.processItem)
		? message.metadata.processItem
		: undefined;
	const trustReceipt = isTurnResolutionSnapshot(message.metadata?.trustReceipt)
		? message.metadata.trustReceipt
		: undefined;
	const answerArtifact = isAnswerArtifact(message.metadata?.answerArtifact)
		? message.metadata.answerArtifact
		: undefined;

	if (message.role === "assistant" && processItem) {
		return renderProcessLines(
			prefix,
			message.createdAt,
			processItem,
			trustReceipt,
			answerArtifact,
		);
	}

	if (message.role === "assistant" && presentation === "process") {
		return renderGenericProcessLines(prefix, message.createdAt, message.content);
	}

	if (
		message.role === "assistant" &&
		(presentation === "answer" || answerArtifact)
	) {
		return renderAnswerLines(prefix, message.createdAt, message.content, answerArtifact);
	}

	if (message.role === "assistant" && presentation === "decision") {
		return renderDecisionLines(prefix, message.createdAt, message.content);
	}

	const role =
		message.role === "human"
			? colors.cyan("human")
			: message.role === "assistant"
				? colors.green("nous")
				: colors.dim(message.role);
	return [
		`${prefix}${role} ${colors.dim(message.createdAt)} ${message.content}`,
	];
}

function renderProcessLines(
	prefix: string,
	createdAt: string,
	item: ProcessItem,
	trustReceipt?: TurnResolutionSnapshot,
	answerArtifact?: AnswerArtifact,
): string[] {
	const marker = colorizeProcessTitle(item.status, item.title);
	const lines = [`${prefix}• ${marker} ${colors.dim(createdAt)}`];
	const detailLines =
		item.kind === "trust_receipt" && trustReceipt
			? trustReceiptDetails(trustReceipt)
			: item.kind === "worked" && answerArtifact
				? []
				: item.details ?? [];
	for (const line of detailLines) {
		lines.push(`${prefix}  ${colors.dim("↳")} ${line}`);
	}
	if (item.summary) {
		lines.push(`${prefix}  ${item.summary}`);
	}
	return lines;
}

function renderAnswerLines(
	prefix: string,
	createdAt: string,
	content: string,
	artifact?: AnswerArtifact,
): string[] {
	const lines = [
		`${prefix}${colors.green(colors.bold("Nous"))} ${colors.dim(createdAt)}`,
	];

	if (artifact) {
		const summary = artifact.summary?.trim();
		if (summary) {
			lines.push(`${prefix}  ${summary}`);
		}
		pushLabeledList(lines, prefix, "Evidence", artifact.evidence);
		pushLabeledList(lines, prefix, "Risks", artifact.risks);
		pushLabeledList(lines, prefix, "Next", artifact.nextSteps);
		if (lines.length > 1) {
			return lines;
		}
	}

	for (const paragraph of splitParagraphs(content)) {
		lines.push(`${prefix}  ${paragraph}`);
	}
	return lines;
}

function renderDecisionLines(
	prefix: string,
	createdAt: string,
	content: string,
): string[] {
	const lines = [`${prefix}• ${colors.yellow("Need your input")} ${colors.dim(createdAt)}`];
	for (const paragraph of splitParagraphs(content)) {
		lines.push(`${prefix}  ${paragraph}`);
	}
	return lines;
}

function renderGenericProcessLines(
	prefix: string,
	createdAt: string,
	content: string,
): string[] {
	const lines = [`${prefix}• ${colors.bold("Update")} ${colors.dim(createdAt)}`];
	for (const paragraph of splitParagraphs(content)) {
		lines.push(`${prefix}  ${paragraph}`);
	}
	return lines;
}

function pushLabeledList(
	lines: string[],
	prefix: string,
	label: string,
	items: string[] | undefined,
): void {
	const normalized = (items ?? []).map((item) => item.trim()).filter(Boolean);
	if (normalized.length === 0) {
		return;
	}
	lines.push(`${prefix}  ${colors.dim(`${label}:`)}`);
	for (const item of normalized) {
		lines.push(`${prefix}    ${colors.dim("•")} ${item}`);
	}
}

function splitParagraphs(content: string): string[] {
	return content
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => line.length > 0);
}

function colorizeProcessTitle(status: ProcessItem["status"], title: string): string {
	switch (status) {
		case "running":
			return colors.cyan(title);
		case "completed":
			return colors.green(title);
		case "warning":
			return colors.yellow(title);
		case "error":
			return colors.red(title);
		default:
			return colors.bold(title);
	}
}

function trustReceiptDetails(snapshot: TurnResolutionSnapshot): string[] {
	const threadLine =
		snapshot.threadResolution === "created"
			? `Thread: started a new thread (${snapshot.threadId})`
			: snapshot.threadResolution === "ambient"
				? `Thread: routed through ambient thread (${snapshot.threadId})`
				: `Thread: continued existing thread (${snapshot.threadId})`;
	const intentLine = snapshot.intentSummary
		? `Intent: ${routeLabel(snapshot.route)} → ${snapshot.intentSummary}`
		: `Route: ${routeLabel(snapshot.route)}`;
	const projectBits = [
		snapshot.projectRoot,
		snapshot.projectType,
		snapshot.gitStatus ? `git=${snapshot.gitStatus}` : undefined,
	]
		.filter(Boolean)
		.join(" · ");
	const groundingLine = [
		`Memory hints: ${snapshot.memoryHintCount}`,
		`Active intents: ${snapshot.activeIntentCount}`,
		`Approval boundaries: ${snapshot.approvalBoundaryCount}`,
	]
		.join(" · ");
	return [
		threadLine,
		intentLine,
		projectBits ? `Project: ${projectBits}` : undefined,
		snapshot.focusedFile ? `Focused file: ${snapshot.focusedFile}` : undefined,
		groundingLine,
		...(snapshot.notes ?? []),
	].filter((value): value is string => Boolean(value));
}

function routeLabel(route: TurnResolutionSnapshot["route"]): string {
	switch (route) {
		case "clarification_resume":
			return "resumed original intent";
		case "scope_update":
			return "applied as current-intent scope update";
		case "decision_response":
			return "handled as decision response";
		case "thread_reply":
			return "continued from thread reply";
		case "proactive":
			return "started from proactive signal";
		default:
			return "parsed as new request";
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProcessItem(value: unknown): value is ProcessItem {
	return isObject(value) && typeof value.kind === "string" && typeof value.title === "string";
}

function isAnswerArtifact(value: unknown): value is AnswerArtifact {
	return isObject(value);
}

function isTurnResolutionSnapshot(value: unknown): value is TurnResolutionSnapshot {
	return (
		isObject(value) &&
		typeof value.turnId === "string" &&
		typeof value.threadId === "string" &&
		typeof value.route === "string"
	);
}
