import { describe, expect, test } from "bun:test";
import type {
	CapabilitySet,
	ContentBlock,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	StreamChunk,
	Task,
	ToolDef,
} from "@nous/core";
import { createPersistenceBackend } from "@nous/persistence";
import { AgentRuntime, ToolExecutor, ToolRegistry } from "../src/index.ts";

describe("AgentRuntime interruption", () => {
	test("interrupts a read-only cooperative tool immediately", async () => {
		const backend = createPersistenceBackend();
		const registry = new ToolRegistry();
		const executor = new ToolExecutor();
		let started!: () => void;
		const startedPromise = new Promise<void>((resolve) => {
			started = resolve;
		});

		const slowReadDef: ToolDef = {
			name: "slow_read",
			description: "Slow read-only tool",
			inputSchema: { type: "object", properties: {} },
			requiredCapabilities: ["fs.read"],
			timeoutMs: 10_000,
			sideEffectClass: "read_only",
			idempotency: "idempotent",
			interruptibility: "cooperative",
			rollbackPolicy: "none",
		};
		registry.register(slowReadDef);
		executor.registerHandler(slowReadDef.name, async (_input, context) => {
			started();
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, 5_000);
				context.signal.addEventListener(
					"abort",
					() => {
						clearTimeout(timer);
						reject(new Error("slow_read aborted"));
					},
					{ once: true },
				);
			});
			return "done";
		});

		const runtime = new AgentRuntime({
			llm: new ToolUseProvider("slow_read"),
			eventStore: backend.events,
			taskStore: backend.tasks,
			toolRegistry: registry,
			toolExecutor: executor,
			agentId: "agent_test",
			capabilities: ALLOW_READ_ONLY,
		});

		backend.intents.create(makeIntent("intent_test"));
		const task = makeTask("task_interrupt_immediate");
		backend.tasks.create(task);
		const execution = runtime.executeTask(task);
		await startedPromise;

		const request = runtime.requestInterrupt("User cancelled the read task");
		expect(request.mode).toBe("immediate");

		const result = await execution;
		expect(result.cancelled).toBe(true);
		expect(backend.tasks.getById(task.id)?.status).toBe("cancelled");
		backend.close();
	});

	test("waits for the current write tool boundary before cancelling", async () => {
		const backend = createPersistenceBackend();
		const registry = new ToolRegistry();
		const executor = new ToolExecutor();
		let started!: () => void;
		const startedPromise = new Promise<void>((resolve) => {
			started = resolve;
		});
		let aborted = false;

		const writeToolDef: ToolDef = {
			name: "write_step",
			description:
				"Non-read-only tool that should cancel only after tool boundary",
			inputSchema: { type: "object", properties: {} },
			requiredCapabilities: ["fs.write"],
			timeoutMs: 10_000,
			sideEffectClass: "write",
			idempotency: "best_effort",
			interruptibility: "cooperative",
			rollbackPolicy: "manual",
		};
		registry.register(writeToolDef);
		executor.registerHandler(writeToolDef.name, async (_input, context) => {
			started();
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, 50);
				context.signal.addEventListener(
					"abort",
					() => {
						aborted = true;
						clearTimeout(timer);
						reject(new Error("write_step aborted"));
					},
					{ once: true },
				);
			});
			return "write finished";
		});

		const runtime = new AgentRuntime({
			llm: new ToolUseProvider("write_step"),
			eventStore: backend.events,
			taskStore: backend.tasks,
			toolRegistry: registry,
			toolExecutor: executor,
			agentId: "agent_test",
			capabilities: ALLOW_WRITE,
		});

		backend.intents.create(makeIntent("intent_test"));
		const task = makeTask("task_interrupt_boundary");
		backend.tasks.create(task);
		const execution = runtime.executeTask(task);
		await startedPromise;

		const request = runtime.requestInterrupt(
			"User cancelled after current step",
		);
		expect(request.mode).toBe("after_tool");

		const result = await execution;
		expect(result.cancelled).toBe(true);
		expect(aborted).toBe(false);
		expect(backend.tasks.getById(task.id)?.status).toBe("cancelled");
		backend.close();
	});
});

const ALLOW_READ_ONLY: CapabilitySet = {
	"shell.exec": false,
	"fs.read": { paths: ["."] },
	"fs.write": false,
	"browser.control": false,
	"network.http": false,
	spawn_subagent: false,
	"memory.write": false,
	escalate_to_human: true,
};

const ALLOW_WRITE: CapabilitySet = {
	...ALLOW_READ_ONLY,
	"fs.write": { paths: ["."] },
};

function makeTask(id: string): Task {
	return {
		id,
		intentId: "intent_test",
		dependsOn: [],
		description: "Run a slow tool",
		capabilitiesRequired: [],
		status: "created",
		retries: 0,
		maxRetries: 1,
		backoffSeconds: 1,
		createdAt: new Date().toISOString(),
	};
}

function makeIntent(id: string) {
	return {
		id,
		raw: "Run a slow tool",
		goal: {
			summary: "Run a slow tool",
			successCriteria: ["Stop safely when cancelled"],
		},
		constraints: [],
		priority: 1,
		humanCheckpoints: "always" as const,
		status: "active" as const,
		source: "human" as const,
		createdAt: new Date().toISOString(),
	};
}

class ToolUseProvider implements LLMProvider {
	readonly name = "tool-use";
	private delivered = false;

	constructor(private readonly toolName: string) {}

	getCapabilities(): LLMProviderCapabilities {
		return {};
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		if (this.delivered) {
			return {
				id: "llm_end",
				content: [{ type: "text", text: "done" }] as ContentBlock[],
				stopReason: "end_turn",
				usage: { inputTokens: 1, outputTokens: 1 },
			};
		}
		this.delivered = true;
		return {
			id: "llm_tool",
			content: [
				{
					type: "tool_use",
					id: "tool_1",
					name: this.toolName,
					input: {},
				},
			],
			stopReason: "tool_use",
			usage: { inputTokens: 1, outputTokens: 1 },
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield { type: "message_end" };
	}
}
