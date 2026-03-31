import type {
	AnswerArtifact,
	DialogueMessageMetadata,
	ProcessItem,
	TurnResolutionSnapshot,
} from "@nous/core";
import type { ProgressEvent } from "@nous/orchestrator";

export interface ProjectedDelivery {
	kind: "progress" | "result" | "notification" | "decision_needed";
	content: string;
	metadata: DialogueMessageMetadata;
}

export interface ProgressProjectionContext {
	turnId?: string;
	intentId?: string;
	taskDescription?: string;
	workedMs?: number;
}

export function buildTrustReceiptDelivery(
	snapshot: TurnResolutionSnapshot,
): ProjectedDelivery {
	return buildProcessDelivery(
		{
			kind: "trust_receipt",
			title: "Turn Context",
			details: trustReceiptDetails(snapshot),
			status: "info",
		},
		"notification",
		{
			turnId: snapshot.turnId,
			intentId: snapshot.intentId,
			trustReceipt: snapshot,
		},
	);
}

export function projectProgressEvent(
	event: ProgressEvent,
	context: ProgressProjectionContext = {},
): ProjectedDelivery[] {
	const intentId = context.intentId ?? readString(event.data.intentId);
	const turnId = context.turnId;
	switch (event.type) {
		case "intent.intake":
			return [
				buildProcessDelivery(
					{
						kind: "task_contract",
						title: "Task Contract",
						summary: readContractSummary(event),
						details: buildTaskContractDetails(event),
						status: "info",
					},
					"progress",
					{ turnId, intentId },
				),
			];
		case "intent.parsed":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Intent Parsed",
						summary:
							readString((event.data.goal as { summary?: string } | undefined)?.summary) ??
							"Intent understood.",
						status: "completed",
					},
					"progress",
					{ turnId, intentId },
				),
			];
		case "intent.resumed":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Resumed Intent",
						summary: readResumeSummary(event),
						details: compactDetails([
							readContractSummary(event),
							readExecutionDepthSummary(event),
						]),
						status: "completed",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "intent.revision_queued":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Scope Update Queued",
						summary: "The latest scope change will be applied at the next safe execution boundary.",
						details: compactDetails([
							`Apply policy: ${readString(event.data.applyPolicy) ?? "next_execution_boundary"}`,
						]),
						status: "warning",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "intent.replanned":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Replanned Current Intent",
						summary: "Applied the latest scope update and replanned the remaining work.",
						details: compactDetails([
							readContractSummary(event),
							`Completed work preserved: ${String(event.data.completedTaskCount ?? 0)} step(s)`,
						]),
						status: "completed",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "intent.pause_requested":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Pause Requested",
						summary: readString(event.data.reason) ?? "Pause requested.",
						details: ["I will stop at the next safe task boundary."],
						status: "warning",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "intent.paused":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Intent Paused",
						summary: readString(event.data.reason) ?? "Paused.",
						status: "warning",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "intent.cancel_requested":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Cancellation Requested",
						summary: readString(event.data.reason) ?? "Cancellation requested.",
						status: "warning",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "intent.cancelled":
			return [
				buildProcessDelivery(
					{
						kind: "status",
						title: "Intent Cancelled",
						summary: readString(event.data.reason) ?? "Cancelled.",
						status: "warning",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "tasks.planned":
			return [
				buildProcessDelivery(
					{
						kind: "plan_update",
						title: "Updated Plan",
						details: readTaskDescriptions(event),
						status: "info",
					},
					"progress",
					{ turnId, intentId },
				),
			];
		case "task.started":
			return [
				buildProcessDelivery(
					{
						kind: "task_start",
						title: "Working On",
						summary: context.taskDescription ?? "Starting the next step.",
						taskId: readString(event.data.taskId),
						status: "running",
					},
					"progress",
					{ turnId, intentId },
				),
			];
		case "task.completed":
			return [
				buildProcessDelivery(
					{
						kind: "task_result",
						title: "Step Completed",
						summary: context.taskDescription ?? "Completed a planned step.",
						taskId: readString(event.data.taskId),
						status: "completed",
					},
					"progress",
					{ turnId, intentId },
				),
			];
		case "task.cancelled":
			return [
				buildProcessDelivery(
					{
						kind: "task_result",
						title: "Step Cancelled",
						summary: context.taskDescription ?? "The current step was cancelled.",
						details: compactDetails([readString(event.data.reason)]),
						taskId: readString(event.data.taskId),
						status: "warning",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "task.failed":
			return [
				buildProcessDelivery(
					{
						kind: "task_result",
						title: "Step Failed",
						summary: context.taskDescription ?? "The current step failed.",
						details: compactDetails([readString(event.data.error)]),
						taskId: readString(event.data.taskId),
						status: "error",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		case "intent.clarification_needed":
		case "intent.approval_requested":
			return [];
		case "intent.achieved":
			return buildCompletionDeliveries(event, context);
		case "escalation":
			return buildEscalationDeliveries(event, context);
		case "tool.called":
			return [buildToolCalledDelivery(event, context)];
		case "tool.executed":
			return buildToolExecutedDeliveries(event, context);
		case "tool.cancelled":
			return [
				buildProcessDelivery(
					{
						kind: "tool_result",
						title: "Tool Cancelled",
						summary: readToolCallSummary(event) ?? "A tool invocation was cancelled.",
						details: compactDetails([readString(event.data.outputPreview)]),
						toolName: readString(event.data.toolName),
						status: "warning",
					},
					"notification",
					{ turnId, intentId },
				),
			];
		default:
			return [];
	}
}

function buildCompletionDeliveries(
	event: ProgressEvent,
	context: ProgressProjectionContext,
): ProjectedDelivery[] {
	const deliveries: ProjectedDelivery[] = [];
	if (typeof context.workedMs === "number" && context.workedMs >= 0) {
		deliveries.push(
			buildProcessDelivery(
				{
					kind: "worked",
					title: `Worked for ${formatWorkedDuration(context.workedMs)}`,
					status: "completed",
				},
				"progress",
				{
					turnId: context.turnId,
					intentId: context.intentId ?? readString(event.data.intentId),
				},
			),
		);
	}

	const artifact = buildAnswerArtifact(event);
	deliveries.push({
		kind: "result",
		content: answerArtifactToText(artifact),
		metadata: {
			presentation: "answer",
			phase: "final",
			turnId: context.turnId,
			intentId: context.intentId ?? readString(event.data.intentId),
			answerArtifact: artifact,
		},
	});
	return deliveries;
}

function buildEscalationDeliveries(
	event: ProgressEvent,
	context: ProgressProjectionContext,
): ProjectedDelivery[] {
	const deliveries: ProjectedDelivery[] = [];
	if (typeof context.workedMs === "number" && context.workedMs >= 0) {
		deliveries.push(
			buildProcessDelivery(
				{
					kind: "worked",
					title: `Worked for ${formatWorkedDuration(context.workedMs)}`,
					status: "warning",
				},
				"progress",
				{
					turnId: context.turnId,
					intentId: context.intentId ?? readString(event.data.intentId),
				},
			),
		);
	}
	deliveries.push(
		buildProcessDelivery(
			{
				kind: "status",
				title: "Escalated",
				summary: readString(event.data.reason) ?? "The task requires escalation.",
				status: "warning",
			},
			"notification",
			{
				turnId: context.turnId,
				intentId: context.intentId ?? readString(event.data.intentId),
			},
		),
	);
	return deliveries;
}

function buildToolCalledDelivery(
	event: ProgressEvent,
	context: ProgressProjectionContext,
): ProjectedDelivery {
	return buildProcessDelivery(
		{
			kind: "tool_call",
			title: toolCallTitle(event),
			summary: readToolCallSummary(event),
			toolName: readString(event.data.toolName),
			status: "running",
		},
		"progress",
		{
			turnId: context.turnId,
			intentId: context.intentId ?? readString(event.data.intentId),
		},
	);
}

function buildToolExecutedDeliveries(
	event: ProgressEvent,
	context: ProgressProjectionContext,
): ProjectedDelivery[] {
	const success = event.data.success !== false;
	const sideEffectClass = readString(event.data.sideEffectClass);
	if (success && sideEffectClass === "read_only") {
		return [];
	}
	return [
		buildProcessDelivery(
			{
				kind: "tool_result",
				title: success ? "Tool Completed" : "Tool Failed",
				summary: readToolCallSummary(event) ?? readString(event.data.toolName) ?? "Tool execution finished.",
				details: compactDetails([readString(event.data.outputPreview)]),
				toolName: readString(event.data.toolName),
				status: success ? "completed" : "error",
			},
			success ? "progress" : "notification",
			{
				turnId: context.turnId,
				intentId: context.intentId ?? readString(event.data.intentId),
			},
		),
	];
}

function buildProcessDelivery(
	processItem: ProcessItem,
	kind: ProjectedDelivery["kind"],
	extraMetadata: Partial<DialogueMessageMetadata> = {},
	fallbackDetails?: string[],
): ProjectedDelivery {
	return {
		kind,
		content: processItemToText(processItem, fallbackDetails),
		metadata: {
			presentation:
				kind === "decision_needed"
					? "decision"
					: kind === "result"
						? "answer"
						: "process",
			phase: kind === "result" ? "final" : "commentary",
			processItem,
			...extraMetadata,
		},
	};
}

function processItemToText(
	item: ProcessItem,
	fallbackDetails?: string[],
): string {
	const lines = [item.title];
	if (item.summary) {
		lines.push(item.summary);
	}
	for (const detail of fallbackDetails ?? item.details ?? []) {
		lines.push(`- ${detail}`);
	}
	return lines.join("\n");
}

function buildAnswerArtifact(event: ProgressEvent): AnswerArtifact {
	const delivery = event.data.delivery as
		| {
				mode?: string;
				summary?: string;
				evidence?: unknown[];
				risks?: unknown[];
				nextSteps?: unknown[];
		  }
		| undefined;
	if (!delivery) {
		return { summary: "Completed successfully." };
	}
	return {
		mode: readString(delivery.mode),
		summary: readString(delivery.summary) ?? "Completed successfully.",
		evidence: normalizeStringArray(delivery.evidence),
		risks: normalizeStringArray(delivery.risks),
		nextSteps: normalizeStringArray(delivery.nextSteps),
	};
}

function answerArtifactToText(artifact: AnswerArtifact): string {
	const lines = [artifact.summary ?? "Completed successfully."];
	appendLabeledLines(lines, "Evidence", artifact.evidence);
	appendLabeledLines(lines, "Risks", artifact.risks);
	appendLabeledLines(lines, "Next", artifact.nextSteps);
	return lines.join("\n");
}

function appendLabeledLines(
	lines: string[],
	label: string,
	items?: string[],
): void {
	const normalized = (items ?? []).map((item) => item.trim()).filter(Boolean);
	if (normalized.length === 0) {
		return;
	}
	lines.push(`${label}:`);
	lines.push(...normalized.map((item) => `- ${item}`));
}

function buildTaskContractDetails(event: ProgressEvent): string[] {
	return compactDetails([
		readExecutionDepthSummary(event),
		readGroundingSummary(event),
		readClarificationPreview(event),
	]);
}

function readTaskDescriptions(event: ProgressEvent): string[] {
	const tasks = Array.isArray(event.data.tasks)
		? event.data.tasks
		: [];
	return tasks
		.map((task, index) => {
			const description =
				task && typeof task === "object" && "description" in task
					? readString((task as { description?: unknown }).description)
					: undefined;
			return description ? `${index + 1}. ${description}` : undefined;
		})
		.filter((value): value is string => Boolean(value));
}

function readResumeSummary(event: ProgressEvent): string {
	const resumeType = readString(event.data.resumeType);
	switch (resumeType) {
		case "pause_resume":
			return "Resumed the paused intent.";
		case "approval_boundary":
			return "Approval received. Continuing past the risky boundary.";
		default:
			return "Clarification resolved. Restored the original intent.";
	}
}

function readContractSummary(event: ProgressEvent): string | undefined {
	const contract = event.data.contract as { summary?: unknown } | undefined;
	const summary = readString(contract?.summary);
	return summary ? `Contract: ${summary}` : undefined;
}

function readExecutionDepthSummary(event: ProgressEvent): string | undefined {
	const executionDepth = event.data.executionDepth as
		| {
				planningDepth?: unknown;
				timeDepth?: unknown;
				organizationDepth?: unknown;
		  }
		| undefined;
	if (!executionDepth) {
		return undefined;
	}
	return [
		`Depth`,
		`planning=${readString(executionDepth.planningDepth) ?? "unknown"}`,
		`time=${readString(executionDepth.timeDepth) ?? "unknown"}`,
		`org=${readString(executionDepth.organizationDepth) ?? "unknown"}`,
	].join(": ").replace(": planning", " planning");
}

function readGroundingSummary(event: ProgressEvent): string | undefined {
	const grounding = readString(event.data.groundingSummary);
	return grounding ? `Grounding: ${grounding}` : undefined;
}

function readClarificationPreview(event: ProgressEvent): string | undefined {
	const questions = normalizeStringArray(event.data.clarificationQuestions);
	return questions[0] ? `Potential clarification: ${questions[0]}` : undefined;
}

function toolCallTitle(event: ProgressEvent): string {
	const toolName = readString(event.data.toolName) ?? "tool";
	switch (toolName) {
		case "file_read":
			return "Read File";
		case "file_write":
			return "Updated File";
		case "grep":
		case "glob":
			return "Explored Workspace";
		case "shell":
			return "Ran Command";
		default:
			return "Used Tool";
	}
}

function readToolCallSummary(event: ProgressEvent): string | undefined {
	const toolName = readString(event.data.toolName);
	const input =
		event.data.input && typeof event.data.input === "object" && !Array.isArray(event.data.input)
			? (event.data.input as Record<string, unknown>)
			: {};
	switch (toolName) {
		case "file_read":
		case "file_write":
			return readString(input.path) ?? readString(event.data.path);
		case "glob":
			return [readString(input.pattern), readString(input.cwd)]
				.filter(Boolean)
				.join(" in ");
		case "grep":
			return [readString(input.pattern), readString(input.path)]
				.filter(Boolean)
				.join(" in ");
		case "shell":
			return readString(input.command) ?? readString(event.data.command);
		default:
			return readString(event.data.toolName);
	}
}

function normalizeStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.map((item) => readString(item)).filter((item): item is string => Boolean(item))
		: [];
}

function trustReceiptDetails(snapshot: TurnResolutionSnapshot): string[] {
	return [
		snapshot.threadResolution === "created"
			? `Thread: started a new thread (${snapshot.threadId})`
			: snapshot.threadResolution === "ambient"
				? `Thread: using ambient thread (${snapshot.threadId})`
				: `Thread: continued existing thread (${snapshot.threadId})`,
		snapshot.intentSummary
			? `Intent: ${snapshot.intentSummary}`
			: `Route: ${snapshot.route}`,
		[
			snapshot.projectRoot,
			snapshot.projectType,
			snapshot.gitStatus ? `git=${snapshot.gitStatus}` : undefined,
		]
			.filter(Boolean)
			.join(" · "),
		snapshot.focusedFile ? `Focused file: ${snapshot.focusedFile}` : undefined,
		`Memory hints: ${snapshot.memoryHintCount} · Active intents: ${snapshot.activeIntentCount} · Approval boundaries: ${snapshot.approvalBoundaryCount}`,
		...(snapshot.notes ?? []),
	].filter((value): value is string => Boolean(value));
}

function compactDetails(values: Array<string | undefined>): string[] {
	return values.filter((value): value is string => Boolean(value));
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
}

function formatWorkedDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	if (totalSeconds < 60) {
		return `${totalSeconds}s`;
	}
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes < 60) {
		return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
