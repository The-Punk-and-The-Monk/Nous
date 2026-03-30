import { describe, expect, test } from "bun:test";
import type { ClientEnvelope } from "@nous/core";
import { SQLiteMessageStore, initDatabase } from "@nous/persistence";
import { DaemonController } from "../src/daemon/controller.ts";
import { DialogueService } from "../src/daemon/dialogue-service.ts";

function createController(
	overrides: ConstructorParameters<typeof DialogueService>[0] = {},
) {
	const db = initDatabase();
	const dialogue = new DialogueService({
		messageStore: new SQLiteMessageStore(db),
		...overrides,
	});
	return new DaemonController(dialogue);
}

function makeEnvelope(overrides: Partial<ClientEnvelope> = {}): ClientEnvelope {
	return {
		id: "req_1",
		type: "get_status",
		channel: {
			id: "channel_cli",
			type: "cli",
			scope: { workingDirectory: "/tmp/demo" },
		},
		payload: {},
		timestamp: new Date().toISOString(),
		...overrides,
	};
}

describe("DaemonController", () => {
	test("handles attach and returns ack", async () => {
		const controller = createController();
		const response = await controller.handle(
			makeEnvelope({
				type: "attach",
				payload: {
					channel: {
						id: "channel_cli",
						type: "cli",
						scope: { workingDirectory: "/tmp/demo" },
						status: "connected",
						connectedAt: new Date().toISOString(),
						lastSeenAt: new Date().toISOString(),
						subscriptions: [],
					},
				},
			}),
		);

		expect(response?.type).toBe("ack");
		expect(response?.id).toBe("req_1");
	});

	test("handles submit_intent and returns thread-aware ack", async () => {
		const controller = createController();
		const response = await controller.handle(
			makeEnvelope({
				type: "submit_intent",
				payload: { text: "Refactor auth module" },
			}),
		);

		expect(response?.type).toBe("ack");
		expect(response?.id).toBe("req_1");
		expect(response?.threadId).toBeDefined();
	});

	test("handles get_thread after submit_intent", async () => {
		const controller = createController();
		const ack = await controller.handle(
			makeEnvelope({
				type: "submit_intent",
				payload: { text: "Summarize README" },
			}),
		);
		const response = await controller.handle(
			makeEnvelope({
				type: "get_thread",
				payload: { threadId: ack?.threadId },
			}),
		);

		expect(response?.type).toBe("response");
		expect((response?.payload as { messages: unknown[] }).messages.length).toBe(
			1,
		);
	});
	test("handles approve_decision and returns ack", async () => {
		const approvals: Array<{
			decisionId: string;
			approved?: boolean;
			note?: string;
		}> = [];
		const controller = createController({
			onApproveDecision: async (payload) => {
				approvals.push({
					decisionId: payload.decisionId,
					approved: payload.approved,
					note: payload.note,
				});
			},
		});
		const response = await controller.handle(
			makeEnvelope({
				type: "approve_decision",
				payload: {
					decisionId: "decision_1",
					approved: true,
					note: "Proceed",
				},
			}),
		);

		expect(response?.type).toBe("ack");
		expect(response?.id).toBe("req_1");
		expect(response?.threadId).toBeDefined();
		expect(approvals).toEqual([
			{ decisionId: "decision_1", approved: true, note: "Proceed" },
		]);
	});

	test("handles cancel_intent and returns ack", async () => {
		const cancellations: Array<{
			intentId?: string;
			threadId?: string;
			reason?: string;
		}> = [];
		const controller = createController({
			onCancelIntent: async (payload) => {
				cancellations.push({
					intentId: payload.intentId,
					threadId: payload.threadId,
					reason: payload.reason,
				});
			},
		});
		const response = await controller.handle(
			makeEnvelope({
				type: "cancel_intent",
				payload: {
					intentId: "intent_1",
					threadId: "thread_1",
					reason: "Stop this task",
				},
			}),
		);

		expect(response?.type).toBe("ack");
		expect(response?.id).toBe("req_1");
		expect(cancellations).toEqual([
			{
				intentId: "intent_1",
				threadId: "thread_1",
				reason: "Stop this task",
			},
		]);
	});
});
