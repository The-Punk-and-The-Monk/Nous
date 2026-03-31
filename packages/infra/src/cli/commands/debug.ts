import type { PersistenceBackend } from "@nous/persistence";
import type { DecisionStatus, DialogueThread, Event, Intent, Task } from "@nous/core";
import { CAPABILITY_NAMES, isCapabilityName } from "@nous/core";
import { colors } from "../ui/colors.ts";

const DECISION_STATUSES = [
	"queued",
	"pending",
	"answered",
	"resolved",
	"cancelled",
	"superseded",
] as const satisfies readonly DecisionStatus[];

export function debugCommand(
	args: string[],
	backend: PersistenceBackend,
): void {
	const subject = args[0];
	if (subject === "thread") {
		const threadId = args[1];
		if (!threadId) {
			printDebugUsage();
			return;
		}
		debugThread(threadId, backend);
		return;
	}

	if (subject === "daemon") {
		debugDaemon(backend);
		return;
	}

	printDebugUsage();
}

function debugThread(threadId: string, backend: PersistenceBackend): void {
	const thread = backend.messages.getThread(threadId);
	if (!thread) {
		console.log(`\n  ${colors.red(`Thread not found: ${threadId}`)}\n`);
		return;
	}

	const messages = backend.messages.getMessagesByThread(threadId);
	const pendingOutbox = backend.messages
		.getPendingOutbox()
		.filter((entry) => entry.threadId === threadId);
	const intentIds = readIntentIds(thread);
	const intents = intentIds
		.map((intentId) => backend.intents.getById(intentId))
		.filter((intent): intent is Intent => Boolean(intent));
	const tasks = intents.flatMap((intent) => backend.tasks.getByIntent(intent.id));
	const decisions = DECISION_STATUSES.flatMap((status) =>
		backend.decisions
			.getByStatus(status)
			.filter((decision) => decision.threadId === threadId),
	);
	const recentEvents = collectRecentEvents(intents, tasks, backend);

	console.log(colors.bold(`\n  νοῦς — Debug Thread ${threadId}\n`));
	printThreadSummary(thread, messages.length, pendingOutbox.length);
	printIntentSummary(intents);
	printTaskSummary(tasks);
	printDecisionSummary(decisions);
	printDispatchWarnings(tasks);
	printRecentMessages(messages);
	printRecentEvents(recentEvents);
}

function debugDaemon(backend: PersistenceBackend): void {
	const activeIntents = backend.intents.getActive();
	const queuedTasks = backend.tasks.getByStatus("queued");
	const assignedTasks = backend.tasks.getByStatus("assigned");
	const runningTasks = backend.tasks.getByStatus("running");
	const pendingDecisions = backend.decisions.getByStatus("pending");
	const queuedDecisions = backend.decisions.getByStatus("queued");
	const recentThreads = backend.messages.listThreads(5);
	const recentEvents = backend.events.query({ limit: 12 });

	console.log(colors.bold("\n  νοῦς — Debug Daemon\n"));
	console.log(
		`  ${colors.dim("Active intents:")} ${activeIntents.length}  ${colors.dim("Queued tasks:")} ${queuedTasks.length}  ${colors.dim("Assigned:")} ${assignedTasks.length}  ${colors.dim("Running:")} ${runningTasks.length}`,
	);
	console.log(
		`  ${colors.dim("Pending decisions:")} ${pendingDecisions.length}  ${colors.dim("Queued decisions:")} ${queuedDecisions.length}  ${colors.dim("Pending outbox:")} ${backend.messages.countOutbox("pending")}`,
	);

	if (recentThreads.length > 0) {
		console.log(`\n  ${colors.cyan("Recent threads")}`);
		for (const thread of recentThreads) {
			console.log(
				`    ${thread.id.slice(0, 14)}  ${renderStatus(thread.status)}  ${thread.title}`,
			);
		}
	}

	printRecentEvents(recentEvents);
}

function printThreadSummary(
	thread: DialogueThread,
	messageCount: number,
	pendingOutboxCount: number,
): void {
	console.log(`  ${colors.dim("Title:")} ${thread.title}`);
	console.log(`  ${colors.dim("Status:")} ${renderStatus(thread.status)}`);
	console.log(`  ${colors.dim("Created:")} ${thread.createdAt}`);
	console.log(`  ${colors.dim("Updated:")} ${thread.updatedAt}`);
	console.log(
		`  ${colors.dim("Messages:")} ${messageCount}  ${colors.dim("Pending outbox:")} ${pendingOutboxCount}`,
	);
}

function printIntentSummary(intents: Intent[]): void {
	console.log(`\n  ${colors.cyan("Linked intents")} ${colors.dim(`(${intents.length})`)}`);
	if (intents.length === 0) {
		console.log(`    ${colors.dim("No linked intents.")}`);
		return;
	}
	for (const intent of intents) {
		console.log(
			`    ${intent.id.slice(0, 18)}  ${renderStatus(intent.status)}  ${intent.goal.summary}`,
		);
	}
}

function printTaskSummary(tasks: Task[]): void {
	console.log(`\n  ${colors.cyan("Tasks")} ${colors.dim(`(${tasks.length})`)}`);
	if (tasks.length === 0) {
		console.log(`    ${colors.dim("No tasks.")}`);
		return;
	}
	for (const task of tasks) {
		const caps =
			task.capabilitiesRequired.length > 0
				? ` caps=${task.capabilitiesRequired.join(",")}`
				: "";
		const agent = task.assignedAgentId
			? ` agent=${task.assignedAgentId.slice(0, 14)}`
			: "";
		console.log(
			`    ${task.id.slice(0, 18)}  ${renderStatus(task.status)}  ${task.description}${caps}${agent}`,
		);
	}
}

function printDecisionSummary(
	decisions: Array<{
		id: string;
		kind: string;
		status: string;
		summary: string;
	}>,
): void {
	console.log(
		`\n  ${colors.cyan("Decisions")} ${colors.dim(`(${decisions.length})`)}`,
	);
	if (decisions.length === 0) {
		console.log(`    ${colors.dim("No decisions.")}`);
		return;
	}
	for (const decision of decisions) {
		console.log(
			`    ${decision.id.slice(0, 18)}  ${renderStatus(decision.status)}  ${decision.kind}  ${decision.summary}`,
		);
	}
}

function printDispatchWarnings(tasks: Task[]): void {
	const blocked = tasks
		.filter((task) => task.status === "queued")
		.map((task) => {
			const invalidCaps = task.capabilitiesRequired.filter(
				(cap) => !isCapabilityName(cap),
			);
			return {
				task,
				invalidCaps,
			};
		})
		.filter(({ invalidCaps }) => invalidCaps.length > 0);

	if (blocked.length === 0) {
		return;
	}

	console.log(`\n  ${colors.yellow("Dispatch warnings")}`);
	console.log(
		`    ${colors.dim(`Known runtime capabilities: ${CAPABILITY_NAMES.join(", ")}`)}`,
	);
	for (const entry of blocked) {
		console.log(
			`    ${entry.task.id.slice(0, 18)} has non-runtime capability labels: ${entry.invalidCaps.join(", ")}`,
		);
	}
}

function printRecentMessages(
	messages: Array<{
		role: string;
		content: string;
		createdAt: string;
	}>,
): void {
	const recent = messages.slice(-8);
	console.log(`\n  ${colors.cyan("Recent messages")} ${colors.dim(`(${recent.length})`)}`);
	for (const message of recent) {
		const content = singleLine(message.content, 120);
		console.log(
			`    ${colors.dim(message.createdAt)}  ${message.role.padEnd(9)} ${content}`,
		);
	}
}

function printRecentEvents(events: Event[]): void {
	console.log(`\n  ${colors.cyan("Recent events")} ${colors.dim(`(${events.length})`)}`);
	if (events.length === 0) {
		console.log(`    ${colors.dim("No recent events.")}`);
		return;
	}
	for (const event of events.slice(-10)) {
		console.log(
			`    ${colors.dim(event.timestamp)}  ${event.type}  ${event.entityType}:${event.entityId.slice(0, 18)}`,
		);
	}
}

function collectRecentEvents(
	intents: Intent[],
	tasks: Task[],
	backend: PersistenceBackend,
): Event[] {
	const seen = new Map<string, Event>();
	for (const intent of intents) {
		for (const event of backend.events.getByEntity("intent", intent.id)) {
			seen.set(event.id, event);
		}
	}
	for (const task of tasks) {
		for (const event of backend.events.getByEntity("task", task.id)) {
			seen.set(event.id, event);
		}
	}
	return [...seen.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function readIntentIds(thread: DialogueThread): string[] {
	const values = thread.metadata?.intentIds;
	if (!Array.isArray(values)) {
		return [];
	}
	return values.filter((value): value is string => typeof value === "string");
}

function renderStatus(status: string): string {
	const color =
		status === "active" || status === "running" || status === "assigned"
			? colors.cyan
			: status === "queued" || status === "pending" || status === "awaiting_decision"
				? colors.yellow
				: status === "done" || status === "achieved" || status === "resolved"
					? colors.green
					: status === "failed" || status === "cancelled" || status === "abandoned"
						? colors.red
						: colors.dim;
	return color(status);
}

function singleLine(value: string, max = 100): string {
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length <= max) {
		return compact;
	}
	return `${compact.slice(0, max - 1)}…`;
}

function printDebugUsage(): void {
	console.log(`
  ${colors.bold("Usage:")}
    nous debug thread <threadId>
    nous debug daemon
`);
}
