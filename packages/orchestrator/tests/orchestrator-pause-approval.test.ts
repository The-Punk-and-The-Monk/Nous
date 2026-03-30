import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	Agent,
	CapabilitySet,
	ContentBlock,
	Intent,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
	Task,
} from "@nous/core";
import { createPersistenceBackend } from "@nous/persistence";
import { Orchestrator } from "../src/orchestrator.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("Orchestrator pause / approval governance", () => {
	test("pauses immediately when no task is active, and resume reactivates queued work", async () => {
		const backend = createPersistenceBackend();
		const orchestrator = new Orchestrator({
			llm: new NoopProvider(),
			eventStore: backend.events,
			taskStore: backend.tasks,
			intentStore: backend.intents,
		});

		const intent = makeIntent("intent_pause_now");
		backend.intents.create(intent);
		backend.tasks.create(
			makeTask({
				id: "task_pause_now",
				intentId: intent.id,
				status: "queued",
				queuedAt: new Date().toISOString(),
			}),
		);

		const paused = orchestrator.pauseIntent(intent.id, "Pause for later");
		expect(paused.mode).toBe("paused_immediately");
		expect(backend.intents.getById(intent.id)?.status).toBe("paused");
		expect(
			backend.intents.getById(intent.id)?.executionDirectives?.at(-1),
		).toMatchObject({
			kind: "pause",
			status: "applied",
			resumeStatus: "active",
		});

		const resumed = await orchestrator.resumeIntent(intent.id, "Resume now");
		expect(resumed.status).toBe("active");
		expect(backend.tasks.getById("task_pause_now")?.status).toBe("queued");

		backend.close();
	});

	test("records deferred pause and finalizes it at the next safe boundary", () => {
		const backend = createPersistenceBackend();
		const orchestrator = new Orchestrator({
			llm: new NoopProvider(),
			eventStore: backend.events,
			taskStore: backend.tasks,
			intentStore: backend.intents,
		});

		const intent = makeIntent("intent_pause_boundary");
		backend.intents.create(intent);
		backend.tasks.create(
			makeTask({
				id: "task_pause_boundary",
				intentId: intent.id,
				status: "running",
				startedAt: new Date().toISOString(),
			}),
		);

		const paused = orchestrator.pauseIntent(intent.id, "Pause after this step");
		expect(paused.mode).toBe("awaiting_boundary");
		expect(backend.intents.getById(intent.id)?.pendingPause).toMatchObject({
			mode: "after_current_task",
			resumeStatus: "active",
		});

		backend.tasks.update("task_pause_boundary", {
			status: "done",
			completedAt: new Date().toISOString(),
		});
		const finalized = (
			orchestrator as unknown as {
				maybeFinalizeIntentPause(intentId: string): boolean;
			}
		).maybeFinalizeIntentPause(intent.id);

		expect(finalized).toBe(true);
		expect(backend.intents.getById(intent.id)?.status).toBe("paused");
		expect(backend.intents.getById(intent.id)?.pendingPause).toBeUndefined();
		expect(
			backend.intents.getById(intent.id)?.executionDirectives?.at(-1),
		).toMatchObject({
			kind: "pause",
			status: "applied",
		});

		backend.close();
	});

	test("enters approval wait after a risky boundary and can continue after approval", async () => {
		const backend = createPersistenceBackend();
		const root = mkdtempSync(join(tmpdir(), "nous-orchestrator-approval-"));
		tempDirs.push(root);
		const orchestrator = new Orchestrator({
			llm: new FileWriteProvider(join(root, "artifact.txt")),
			eventStore: backend.events,
			taskStore: backend.tasks,
			intentStore: backend.intents,
		});
		orchestrator.registerAgent(makeAgent(root));

		const intent = makeIntent("intent_risky_boundary");
		backend.intents.create(intent);
		backend.tasks.create(
			makeTask({
				id: "task_risky_boundary_1",
				intentId: intent.id,
				status: "queued",
				description: "Write an artifact to disk",
				queuedAt: new Date().toISOString(),
			}),
		);
		backend.tasks.create(
			makeTask({
				id: "task_risky_boundary_2",
				intentId: intent.id,
				status: "created",
				description: "Follow-up review step",
			}),
		);
		const task = backend.tasks.getById("task_risky_boundary_1");
		if (!task) {
			throw new Error("Expected first risky-boundary task to exist");
		}

		await (
			orchestrator as unknown as {
				handleTaskReady(task: Task): Promise<void>;
			}
		).handleTaskReady(task);

		const blocked = backend.intents.getById(intent.id);
		expect(blocked?.status).toBe("awaiting_decision");
		expect(blocked?.executionDirectives?.at(-1)).toMatchObject({
			kind: "approval_wait",
			status: "requested",
			toolNames: ["file_write"],
			rollbackAvailable: true,
		});

		const resumed = await orchestrator.approveRiskBoundaryContinuation(
			intent.id,
			"Looks good, continue",
		);
		expect(resumed.status).toBe("active");
		expect(
			backend.intents.getById(intent.id)?.executionDirectives?.at(-1),
		).toMatchObject({
			kind: "approval_wait",
			status: "applied",
		});

		backend.close();
	});
});

function makeIntent(id: string): Intent {
	return {
		id,
		raw: "Implement the requested change safely",
		workingText: "Implement the requested change safely",
		goal: {
			summary: "Implement the requested change safely",
			successCriteria: ["Produce the requested artifact"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always",
		contract: {
			summary: "Implement the requested change safely",
			successCriteria: ["Produce the requested artifact"],
			boundaries: ["Stay within the workspace"],
			interruptionPolicy: "interactive",
			deliveryMode: "structured_with_evidence",
		},
		executionDepth: {
			planningDepth: "light",
			timeDepth: "foreground",
			organizationDepth: "single_agent",
			initiativeMode: "reactive",
			rationale: "Small bounded task.",
		},
		status: "active",
		source: "human",
		createdAt: new Date().toISOString(),
	};
}

function makeTask(
	overrides: Partial<Task> & Pick<Task, "id" | "intentId">,
): Task {
	return {
		id: overrides.id,
		intentId: overrides.intentId,
		parentTaskId: overrides.parentTaskId,
		dependsOn: overrides.dependsOn ?? [],
		description: overrides.description ?? "Task",
		assignedAgentId: overrides.assignedAgentId,
		capabilitiesRequired: overrides.capabilitiesRequired ?? [],
		status: overrides.status ?? "created",
		retries: overrides.retries ?? 0,
		maxRetries: overrides.maxRetries ?? 1,
		backoffSeconds: overrides.backoffSeconds ?? 1,
		createdAt: overrides.createdAt ?? new Date().toISOString(),
		queuedAt: overrides.queuedAt,
		startedAt: overrides.startedAt,
		lastHeartbeat: overrides.lastHeartbeat,
		completedAt: overrides.completedAt,
		result: overrides.result,
		error: overrides.error,
		escalationReason: overrides.escalationReason,
	};
}

function makeAgent(root: string): Agent {
	const capabilities: CapabilitySet = {
		"shell.exec": false,
		"fs.read": { paths: [root] },
		"fs.write": { paths: [root] },
		"browser.control": false,
		"network.http": false,
		spawn_subagent: false,
		"memory.write": false,
		escalate_to_human: true,
	};
	return {
		id: "agent_test",
		name: "Test Agent",
		role: "executor",
		capabilities,
		memoryId: "mem_test",
		status: "idle",
		personality: {
			style: "methodical",
			toolPreferences: ["file_write"],
			systemPrompt: "Use tools carefully and stop when done.",
		},
	};
}

class FileWriteProvider implements LLMProvider {
	readonly name = "file-write";
	private deliveredToolUse = false;

	constructor(private readonly path: string) {}

	getCapabilities(): LLMProviderCapabilities {
		return {};
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		if (!this.deliveredToolUse) {
			this.deliveredToolUse = true;
			return {
				id: "llm_tool",
				content: [
					{
						type: "tool_use",
						id: "tool_1",
						name: "file_write",
						input: {
							path: this.path,
							content: "updated by orchestrator test",
						},
					},
				],
				stopReason: "tool_use",
				usage: { inputTokens: 1, outputTokens: 1 },
			};
		}
		return {
			id: "llm_end",
			content: [{ type: "text", text: "write completed" }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}

class NoopProvider implements LLMProvider {
	readonly name = "noop";

	getCapabilities(): LLMProviderCapabilities {
		return {};
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		return {
			id: "noop",
			content: [{ type: "text", text: "noop" }] as ContentBlock[],
			stopReason: "end_turn",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
