import { describe, expect, test } from "bun:test";
import type { Channel } from "@nous/core";
import {
	SQLiteIntentStore,
	SQLiteTaskStore,
	initDatabase,
} from "@nous/persistence";
import { SQLiteMessageStore } from "@nous/persistence";
import { DialogueService } from "../src/daemon/dialogue-service.ts";

function createFixture() {
	const db = initDatabase();
	return {
		messageStore: new SQLiteMessageStore(db),
		intentStore: new SQLiteIntentStore(db),
		taskStore: new SQLiteTaskStore(db),
	};
}

function makeChannel(overrides: Partial<Channel> = {}): Channel {
	return {
		id: "channel_cli",
		type: "cli",
		scope: { workingDirectory: "/tmp/demo", projectRoot: "/tmp/demo" },
		status: "connected",
		connectedAt: new Date().toISOString(),
		lastSeenAt: new Date().toISOString(),
		subscriptions: ["progress", "result"],
		...overrides,
	};
}

describe("DialogueService", () => {
	test("attach returns ack with channel and no pending messages initially", () => {
		const stores = createFixture();
		const service = new DialogueService({ messageStore: stores.messageStore });
		const ack = service.attach({
			channel: makeChannel(),
			replayPending: true,
		});

		expect(ack.type).toBe("ack");
		expect(ack.payload.channel.id).toBe("channel_cli");
		expect(ack.payload.pendingMessages).toHaveLength(0);
	});

	test("submitIntent creates thread and inbound message", async () => {
		const stores = createFixture();
		const service = new DialogueService({ messageStore: stores.messageStore });
		const channel = makeChannel();

		const ack = await service.submitIntent(channel, {
			text: "Refactor auth module",
		});

		expect(ack.payload.status).toBe("accepted");

		const snapshot = service.getThreadSnapshot({
			threadId: ack.payload.threadId,
		});
		expect(snapshot).toBeDefined();
		expect(snapshot?.messages).toHaveLength(1);
		expect(snapshot?.messages[0].content).toBe("Refactor auth module");
		expect(snapshot?.messages[0].metadata?.turnId).toBe(
			snapshot?.messages[0].id,
		);
		expect(snapshot?.thread.metadata?.originChannel).toBe(channel.id);
		expect(snapshot?.thread.metadata?.surfaceKind).toBe("cli");
	});

	test("enqueueAssistantMessage persists outbox entry", async () => {
		const stores = createFixture();
		const service = new DialogueService({ messageStore: stores.messageStore });
		const channel = makeChannel();
		const ack = await service.submitIntent(channel, {
			text: "Summarize README",
		});

		service.enqueueAssistantMessage({
			threadId: ack.payload.threadId,
			content: "On it. I will summarize the README.",
			targetChannel: channel.id,
		});

		const snapshot = service.getThreadSnapshot({
			threadId: ack.payload.threadId,
		});
		expect(snapshot?.messages).toHaveLength(2);
		expect(snapshot?.pendingOutbox).toHaveLength(1);
		expect(snapshot?.pendingOutbox[0].targetChannel).toBe(channel.id);
	});

	test("drainPendingDeliveries marks deliverable outbox entries as delivered", async () => {
		const stores = createFixture();
		const service = new DialogueService({ messageStore: stores.messageStore });
		const channel = makeChannel();
		const ack = await service.submitIntent(channel, {
			text: "Summarize README",
		});

		service.enqueueAssistantMessage({
			threadId: ack.payload.threadId,
			content: "Completed.",
		});

		const deliveries = service.drainPendingDeliveries({
			channelId: channel.id,
			threadId: ack.payload.threadId,
		});
		expect(deliveries).toHaveLength(1);
		expect(deliveries[0]?.message.content).toBe("Completed.");

		const snapshot = service.getThreadSnapshot({
			threadId: ack.payload.threadId,
		});
		expect(snapshot?.pendingOutbox).toHaveLength(0);
	});

	test("peekPendingDeliveries does not mutate outbox until marked delivered", async () => {
		const stores = createFixture();
		const service = new DialogueService({ messageStore: stores.messageStore });
		const channel = makeChannel();
		const ack = await service.submitIntent(channel, {
			text: "Inspect repository state",
		});

		service.enqueueAssistantMessage({
			threadId: ack.payload.threadId,
			content: "First live push candidate.",
		});

		const deliveries = service.peekPendingDeliveries({
			threadId: ack.payload.threadId,
		});
		expect(deliveries).toHaveLength(1);

		let snapshot = service.getThreadSnapshot({
			threadId: ack.payload.threadId,
		});
		expect(snapshot?.pendingOutbox).toHaveLength(1);

		service.markDeliveriesDelivered(deliveries);

		snapshot = service.getThreadSnapshot({
			threadId: ack.payload.threadId,
		});
		expect(snapshot?.pendingOutbox).toHaveLength(0);
	});

	test("getStatusSnapshot reports connected channels and pending outbox count", async () => {
		const stores = createFixture();
		const service = new DialogueService({
			messageStore: stores.messageStore,
			intentStore: stores.intentStore,
			taskStore: stores.taskStore,
		});
		const channel = makeChannel();
		service.attach({ channel });
		const ack = await service.submitIntent(channel, {
			text: "Analyze repository",
		});
		service.enqueueAssistantMessage({
			threadId: ack.payload.threadId,
			content: "Accepted.",
		});

		const status = service.getStatusSnapshot();
		expect(status.connectedChannels).toHaveLength(1);
		expect(status.pendingOutboxCount).toBe(1);
	});

	test("linkIntentToThread persists intentIds in thread metadata", async () => {
		const stores = createFixture();
		const service = new DialogueService({ messageStore: stores.messageStore });
		const channel = makeChannel();
		const ack = await service.submitIntent(channel, {
			text: "Analyze repository",
		});

		service.linkIntentToThread(ack.payload.threadId, "intent_demo");

		const snapshot = service.getThreadSnapshot({
			threadId: ack.payload.threadId,
		});
		expect(snapshot?.thread.metadata?.intentIds).toEqual(["intent_demo"]);
		expect(snapshot?.thread.metadata?.activeIntentId).toBe("intent_demo");
		expect(snapshot?.thread.metadata?.activeWorkItemId).toBe("intent_demo");
	});

	test("stores handoff capsule metadata on the thread container", async () => {
		const stores = createFixture();
		const service = new DialogueService({ messageStore: stores.messageStore });
		const channel = makeChannel({ id: "channel_ide", type: "ide" });
		const ack = await service.submitIntent(channel, {
			text: "Inspect repository state",
		});

		service.setHandoffCapsuleForThread(ack.payload.threadId, "handoff_demo");

		const snapshot = service.getThreadSnapshot({
			threadId: ack.payload.threadId,
		});
		expect(snapshot?.thread.metadata?.handoffCapsuleId).toBe("handoff_demo");
		expect(snapshot?.thread.metadata?.surfaceKind).toBe("ide");
		expect(snapshot?.thread.metadata?.originChannel).toBe("channel_ide");
	});
});
