import { beforeEach, describe, expect, test } from "bun:test";
import type { DialogueMessage, DialogueThread, OutboxEntry } from "@nous/core";
import { initDatabase } from "../src/sqlite/connection.ts";
import { SQLiteMessageStore } from "../src/sqlite/message-store.sqlite.ts";

let messageStore: SQLiteMessageStore;

function makeThread(overrides: Partial<DialogueThread> = {}): DialogueThread {
	return {
		id: `thread_${Math.random().toString(36).slice(2)}`,
		title: "Test Thread",
		status: "active",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		metadata: { source: "test" },
		...overrides,
	};
}

function makeMessage(
	overrides: Partial<DialogueMessage> = {},
): DialogueMessage {
	return {
		id: `msg_${Math.random().toString(36).slice(2)}`,
		threadId: "thread_1",
		role: "human",
		channel: "cli",
		direction: "inbound",
		content: "hello",
		createdAt: new Date().toISOString(),
		metadata: { source: "test" },
		...overrides,
	};
}

function makeOutbox(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
	return {
		id: `out_${Math.random().toString(36).slice(2)}`,
		threadId: "thread_1",
		messageId: "msg_1",
		targetChannel: "cli",
		status: "pending",
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

beforeEach(() => {
	const db = initDatabase();
	messageStore = new SQLiteMessageStore(db);
});

describe("SQLiteMessageStore", () => {
	test("createThread and getThread", () => {
		const thread = makeThread({ id: "thread_1", title: "Architecture Review" });
		messageStore.createThread(thread);

		const stored = messageStore.getThread("thread_1");
		expect(stored).toBeDefined();
		expect(stored?.title).toBe("Architecture Review");
		expect(stored?.metadata).toEqual({ source: "test" });
	});

	test("updateThread changes status and metadata", () => {
		messageStore.createThread(makeThread({ id: "thread_1" }));
		messageStore.updateThread("thread_1", {
			status: "archived",
			metadata: { archivedBecause: "completed" },
		});

		const stored = messageStore.getThread("thread_1");
		expect(stored?.status).toBe("archived");
		expect(stored?.metadata).toEqual({ archivedBecause: "completed" });
	});

	test("appendMessage and getMessagesByThread", () => {
		messageStore.createThread(makeThread({ id: "thread_1" }));
		messageStore.appendMessage(
			makeMessage({ id: "msg_1", threadId: "thread_1", content: "hello" }),
		);
		messageStore.appendMessage(
			makeMessage({
				id: "msg_2",
				threadId: "thread_1",
				role: "assistant",
				direction: "outbound",
				content: "hi there",
			}),
		);

		const messages = messageStore.getMessagesByThread("thread_1");
		expect(messages).toHaveLength(2);
		expect(messages[0].content).toBe("hello");
		expect(messages[1].content).toBe("hi there");
		expect(messageStore.getMessage("msg_2")?.content).toBe("hi there");
	});

	test("enqueueOutbox, getPendingOutbox and updateOutbox", () => {
		messageStore.createThread(makeThread({ id: "thread_1" }));
		messageStore.appendMessage(
			makeMessage({ id: "msg_1", threadId: "thread_1", direction: "outbound" }),
		);
		messageStore.enqueueOutbox(
			makeOutbox({ id: "out_1", threadId: "thread_1", messageId: "msg_1" }),
		);

		expect(messageStore.countOutbox()).toBe(1);
		expect(messageStore.getPendingOutbox("cli")).toHaveLength(1);

		messageStore.updateOutbox("out_1", {
			status: "delivered",
			deliveredAt: new Date().toISOString(),
		});

		expect(messageStore.getPendingOutbox("cli")).toHaveLength(0);
		expect(messageStore.countOutbox("delivered")).toBe(1);
	});
});
