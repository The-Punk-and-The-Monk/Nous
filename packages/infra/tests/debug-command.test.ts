import { afterEach, describe, expect, test } from "bun:test";
import type {
	DialogueThread,
	Flow,
	Intent,
	MergeCandidate,
	PlanGraph,
	Task,
} from "@nous/core";
import { createPersistenceBackend } from "@nous/persistence";
import { debugCommand } from "../src/cli/commands/debug.ts";

const originalLog = console.log;

afterEach(() => {
	console.log = originalLog;
});

describe("debugCommand", () => {
	test("renders linked flows and plan graphs for a thread", () => {
		const backend = createPersistenceBackend();
		seedThreadFixture(backend);
		const output = captureConsole(() =>
			debugCommand(["thread", "thread_auth"], backend),
		);

		expect(output).toContain("Linked flows");
		expect(output).toContain("Auth migration");
		expect(output).toContain("Plan graphs");
		expect(output).toContain("Merge candidates");
		expect(output).toContain("parallel");
		expect(output).toContain("flow_auth");
		expect(output).toContain("plan_auth");
		expect(output).toContain("link_only");

		backend.close();
	});

	test("renders active flows and recent plan graphs in daemon debug view", () => {
		const backend = createPersistenceBackend();
		seedThreadFixture(backend);
		const output = captureConsole(() => debugCommand(["daemon"], backend));

		expect(output).toContain("Active flows:");
		expect(output).toContain("Recent plan graphs:");
		expect(output).toContain("Recent merge candidates:");
		expect(output).toContain("explicit_request");
		expect(output).toContain("parallel");

		backend.close();
	});
});

function seedThreadFixture(
	backend: ReturnType<typeof createPersistenceBackend>,
): void {
	const thread: DialogueThread = {
		id: "thread_auth",
		title: "Auth migration",
		status: "active",
		createdAt: "2026-04-01T10:00:00.000Z",
		updatedAt: "2026-04-01T10:00:00.000Z",
		metadata: {
			intentIds: ["intent_auth"],
		},
	};
	const intent: Intent = {
		id: "intent_auth",
		flowId: "flow_auth",
		planGraphId: "plan_auth",
		raw: "Inspect auth migration",
		workingText: "Inspect auth migration",
		goal: {
			summary: "Inspect auth migration",
			successCriteria: ["Report findings"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always",
		status: "active",
		source: "human",
		createdAt: "2026-04-01T10:00:00.000Z",
	};
	const flow: Flow = {
		id: "flow_auth",
		kind: "explicit_request",
		title: "Auth migration",
		summary: "Track auth migration work.",
		ownerThreadId: "thread_auth",
		status: "active",
		source: "human",
		priority: 1,
		createdAt: "2026-04-01T10:00:00.000Z",
		updatedAt: "2026-04-01T10:01:00.000Z",
		primaryIntentId: "intent_auth",
		relatedIntentIds: ["intent_auth"],
		relatedTaskIds: ["task_auth_1", "task_auth_2"],
	};
	const planGraph: PlanGraph = {
		id: "plan_auth",
		intentId: "intent_auth",
		flowId: "flow_auth",
		status: "active",
		topology: "parallel",
		planningDepth: "light",
		createdAt: "2026-04-01T10:00:00.000Z",
		updatedAt: "2026-04-01T10:01:00.000Z",
	};
	const mergeCandidate: MergeCandidate = {
		id: "merge_auth",
		leftKind: "intent",
		leftId: "intent_auth",
		rightKind: "intent",
		rightId: "intent_auth_followup",
		proposedAction: "link_only",
		rationale: "Likely the same auth migration work stream.",
		confidence: 0.68,
		producedBy: "conflict_analyzer",
		status: "proposed",
		createdAt: "2026-04-01T10:02:00.000Z",
	};
	const tasks: Task[] = [
		{
			id: "task_auth_1",
			intentId: "intent_auth",
			flowId: "flow_auth",
			planGraphId: "plan_auth",
			dependsOn: [],
			description: "Inspect auth code",
			capabilitiesRequired: [],
			cognitiveOperation: "execution_main",
			status: "queued",
			retries: 0,
			maxRetries: 3,
			backoffSeconds: 2,
			createdAt: "2026-04-01T10:00:00.000Z",
		},
		{
			id: "task_auth_2",
			intentId: "intent_auth",
			flowId: "flow_auth",
			planGraphId: "plan_auth",
			dependsOn: [],
			description: "Inspect git history",
			capabilitiesRequired: ["shell.exec"],
			cognitiveOperation: "execution_main",
			status: "queued",
			retries: 0,
			maxRetries: 3,
			backoffSeconds: 2,
			createdAt: "2026-04-01T10:00:00.000Z",
		},
	];

	backend.messages.createThread(thread);
	backend.intents.create(intent);
	backend.work.createFlow(flow);
	backend.work.createPlanGraph(planGraph);
	backend.work.createMergeCandidate(mergeCandidate);
	for (const task of tasks) {
		backend.tasks.create(task);
	}
}

function captureConsole(fn: () => void): string {
	const lines: string[] = [];
	console.log = (...args: unknown[]) => {
		lines.push(args.map((arg) => String(arg)).join(" "));
	};
	fn();
	return lines.join("\n");
}
