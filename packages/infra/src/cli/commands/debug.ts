import type { PersistenceBackend } from "@nous/persistence";
import type {
	Flow,
	DecisionStatus,
	DialogueMessage,
	DialogueThread,
	Event,
	Intent,
	MergeCandidate,
	PlanGraph,
	ProcessItem,
	Task,
	TurnResolutionSnapshot,
} from "@nous/core";
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
	const intentIds = resolveIntentIdsForThread(thread, backend);
	const intents = intentIds
		.map((intentId) => backend.intents.getById(intentId))
		.filter((intent): intent is Intent => Boolean(intent));
	const flows = dedupeById(
		intents
			.map((intent) =>
				intent.flowId ? backend.work.getFlowById(intent.flowId) : undefined,
			)
			.filter((flow): flow is Flow => Boolean(flow)),
	);
	const planGraphs = dedupeById(
		intents
			.map((intent) =>
				intent.planGraphId
					? backend.work.getPlanGraphById(intent.planGraphId)
					: undefined,
			)
			.filter((planGraph): planGraph is PlanGraph => Boolean(planGraph)),
	);
	const tasks = intents.flatMap((intent) => backend.tasks.getByIntent(intent.id));
	const decisions = DECISION_STATUSES.flatMap((status) =>
		backend.decisions
			.getByStatus(status)
			.filter((decision) => decision.threadId === threadId),
	);
	const mergeCandidates = dedupeById(
		backend.work
			.listMergeCandidates({ limit: 20 })
			.filter((candidate) =>
				intentIds.includes(candidate.leftId) || intentIds.includes(candidate.rightId),
			),
	);
	const recentEvents = collectRecentEvents(intents, tasks, backend);

	console.log(colors.bold(`\n  νοῦς — Debug Thread ${threadId}\n`));
	printThreadSummary(thread, messages.length, pendingOutbox.length);
	printIntentSummary(intents);
	printFlowSummary(flows);
	printPlanGraphSummary(planGraphs);
	printMergeCandidateSummary(mergeCandidates);
	printTaskSummary(tasks);
	printDecisionSummary(decisions);
	printTurnSurface(messages);
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
	const activeFlows = backend.work.listFlows({
		statuses: ["active", "blocked", "quiet"],
		limit: 10,
	});
	const recentPlanGraphs = backend.work.listPlanGraphs({ limit: 8 });
	const recentMergeCandidates = backend.work.listMergeCandidates({ limit: 8 });
	const recentThreads = backend.messages.listThreads(5);
	const recentEvents = backend.events.query({ limit: 12 });

	console.log(colors.bold("\n  νοῦς — Debug Daemon\n"));
	console.log(
		`  ${colors.dim("Active intents:")} ${activeIntents.length}  ${colors.dim("Queued tasks:")} ${queuedTasks.length}  ${colors.dim("Assigned:")} ${assignedTasks.length}  ${colors.dim("Running:")} ${runningTasks.length}`,
	);
	console.log(
		`  ${colors.dim("Pending decisions:")} ${pendingDecisions.length}  ${colors.dim("Queued decisions:")} ${queuedDecisions.length}  ${colors.dim("Pending outbox:")} ${backend.messages.countOutbox("pending")}`,
	);
	console.log(
		`  ${colors.dim("Active flows:")} ${activeFlows.length}  ${colors.dim("Recent plan graphs:")} ${recentPlanGraphs.length}  ${colors.dim("Recent merge candidates:")} ${recentMergeCandidates.length}`,
	);

	if (recentThreads.length > 0) {
		console.log(`\n  ${colors.cyan("Recent threads")}`);
		for (const thread of recentThreads) {
			console.log(
				`    ${thread.id.slice(0, 14)}  ${renderStatus(thread.status)}  ${thread.title}`,
			);
		}
	}

	if (activeFlows.length > 0) {
		console.log(`\n  ${colors.cyan("Active flows")}`);
		for (const flow of activeFlows) {
			console.log(
				`    ${flow.id.slice(0, 14)}  ${renderStatus(flow.status)}  ${flow.kind}  ${singleLine(flow.title, 70)}`,
			);
		}
	}

	if (recentPlanGraphs.length > 0) {
		console.log(`\n  ${colors.cyan("Recent plan graphs")}`);
		for (const planGraph of recentPlanGraphs) {
			console.log(
				`    ${planGraph.id.slice(0, 14)}  ${renderStatus(planGraph.status)}  ${planGraph.topology}  intent=${planGraph.intentId.slice(0, 14)}`,
			);
		}
	}

	if (recentMergeCandidates.length > 0) {
		console.log(`\n  ${colors.cyan("Recent merge candidates")}`);
		for (const candidate of recentMergeCandidates) {
			console.log(
				`    ${candidate.id.slice(0, 14)}  ${renderStatus(candidate.status)}  ${candidate.proposedAction}  ${candidate.leftId.slice(0, 10)} ↔ ${candidate.rightId.slice(0, 10)}`,
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

function printFlowSummary(flows: Flow[]): void {
	console.log(`\n  ${colors.cyan("Linked flows")} ${colors.dim(`(${flows.length})`)}`);
	if (flows.length === 0) {
		console.log(`    ${colors.dim("No linked flows.")}`);
		return;
	}
	for (const flow of flows) {
		console.log(
			`    ${flow.id.slice(0, 18)}  ${renderStatus(flow.status)}  ${flow.kind}  ${flow.title}`,
		);
	}
}

function printPlanGraphSummary(planGraphs: PlanGraph[]): void {
	console.log(
		`\n  ${colors.cyan("Plan graphs")} ${colors.dim(`(${planGraphs.length})`)}`,
	);
	if (planGraphs.length === 0) {
		console.log(`    ${colors.dim("No linked plan graphs.")}`);
		return;
	}
	for (const planGraph of planGraphs) {
		console.log(
			`    ${planGraph.id.slice(0, 18)}  ${renderStatus(planGraph.status)}  ${planGraph.topology}  depth=${planGraph.planningDepth}`,
		);
	}
}

function printMergeCandidateSummary(candidates: MergeCandidate[]): void {
	console.log(
		`\n  ${colors.cyan("Merge candidates")} ${colors.dim(`(${candidates.length})`)}`,
	);
	if (candidates.length === 0) {
		console.log(`    ${colors.dim("No linked merge candidates.")}`);
		return;
	}
	for (const candidate of candidates) {
		console.log(
			`    ${candidate.id.slice(0, 18)}  ${renderStatus(candidate.status)}  ${candidate.proposedAction}  ${candidate.leftId.slice(0, 10)} ↔ ${candidate.rightId.slice(0, 10)}`,
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
		const ownership = [
			task.flowId ? ` flow=${task.flowId.slice(0, 10)}` : "",
			task.planGraphId ? ` plan=${task.planGraphId.slice(0, 10)}` : "",
		].join("");
		console.log(
			`    ${task.id.slice(0, 18)}  ${renderStatus(task.status)}  ${task.description}${caps}${agent}${ownership}`,
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

function printTurnSurface(messages: DialogueMessage[]): void {
	const turns = collectRecentTurns(messages).slice(-5);
	console.log(`\n  ${colors.cyan("Recent turns")} ${colors.dim(`(${turns.length})`)}`);
	if (turns.length === 0) {
		console.log(`    ${colors.dim("No structured turn surface recorded yet.")}`);
		return;
	}
	for (const turn of turns) {
		console.log(
			`    ${turn.turnId.slice(0, 18)}  ${colors.dim(turn.route ?? "route=unknown")}  ${singleLine(turn.humanPrompt ?? "(no human prompt)", 90)}`,
		);
		if (turn.trustReceipt) {
			console.log(
				`      ${colors.dim("trust")} thread=${turn.trustReceipt.threadResolution} memory=${turn.trustReceipt.memoryHintCount} activeIntents=${turn.trustReceipt.activeIntentCount} approvals=${turn.trustReceipt.approvalBoundaryCount}`,
			);
		}
		if (turn.processTitles.length > 0) {
			console.log(
				`      ${colors.dim("surface")} ${turn.processTitles.join(" → ")}`,
			);
		}
		if (turn.finalSummary) {
			console.log(
				`      ${colors.dim("answer")} ${singleLine(turn.finalSummary, 110)}`,
			);
		}
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
	messages: DialogueMessage[],
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

function resolveIntentIdsForThread(
	thread: DialogueThread,
	backend: PersistenceBackend,
): string[] {
	const intentIds = new Set<string>();

	for (const binding of backend.work.listFlowThreadBindings({
		threadId: thread.id,
	})) {
		const flow = backend.work.getFlowById(binding.flowId);
		if (!flow) {
			continue;
		}
		if (flow.primaryIntentId) {
			intentIds.add(flow.primaryIntentId);
		}
		for (const intentId of flow.relatedIntentIds) {
			intentIds.add(intentId);
		}
	}

	for (const flow of backend.work.listFlows({ ownerThreadId: thread.id })) {
		if (flow.primaryIntentId) {
			intentIds.add(flow.primaryIntentId);
		}
		for (const intentId of flow.relatedIntentIds) {
			intentIds.add(intentId);
		}
	}

	const metadataIntentIds = Array.isArray(thread.metadata?.intentIds)
		? thread.metadata.intentIds.filter(
				(value): value is string => typeof value === "string",
			)
		: [];
	for (const intentId of metadataIntentIds) {
		intentIds.add(intentId);
	}

	return [...intentIds];
}

function collectRecentTurns(messages: DialogueMessage[]): TurnDebugView[] {
	const turns = new Map<string, TurnDebugView>();
	for (const message of messages) {
		const turnId = readTurnId(message);
		if (!turnId) {
			continue;
		}
		const existing =
			turns.get(turnId) ??
			{
				turnId,
				humanPrompt: undefined,
				processTitles: [],
				finalSummary: undefined,
				route: undefined,
				trustReceipt: undefined,
				createdAt: message.createdAt,
			};
		if (!turns.has(turnId)) {
			turns.set(turnId, existing);
		}
		if (message.role === "human" && !existing.humanPrompt) {
			existing.humanPrompt = message.content;
		}
		const trustReceipt = readTrustReceipt(message);
		if (trustReceipt) {
			existing.trustReceipt = trustReceipt;
			existing.route = trustReceipt.route;
		}
		const processItem = readProcessItem(message);
		if (processItem?.title) {
			existing.processTitles.push(processItem.title);
		}
		if (
			String(message.metadata?.presentation ?? "") === "answer" &&
			!existing.finalSummary
		) {
			existing.finalSummary =
				readAnswerSummary(message) ?? message.content.split("\n")[0];
		}
	}
	return [...turns.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function readTurnId(message: DialogueMessage): string | undefined {
	const value = message.metadata?.turnId;
	return typeof value === "string" ? value : undefined;
}

function readProcessItem(message: DialogueMessage): ProcessItem | undefined {
	const value = message.metadata?.processItem;
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as ProcessItem)
		: undefined;
}

function readTrustReceipt(
	message: DialogueMessage,
): TurnResolutionSnapshot | undefined {
	const value = message.metadata?.trustReceipt;
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as TurnResolutionSnapshot)
		: undefined;
}

function readAnswerSummary(message: DialogueMessage): string | undefined {
	const value = message.metadata?.answerArtifact;
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const summary = (value as { summary?: unknown }).summary;
	return typeof summary === "string" ? summary : undefined;
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

function dedupeById<T extends { id: string }>(values: T[]): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const value of values) {
		if (seen.has(value.id)) {
			continue;
		}
		seen.add(value.id);
		result.push(value);
	}
	return result;
}

function printDebugUsage(): void {
	console.log(`
  ${colors.bold("Usage:")}
    nous debug thread <threadId>
    nous debug daemon
`);
}

interface TurnDebugView {
	turnId: string;
	humanPrompt?: string;
	processTitles: string[];
	finalSummary?: string;
	route?: string;
	trustReceipt?: TurnResolutionSnapshot;
	createdAt: string;
}
