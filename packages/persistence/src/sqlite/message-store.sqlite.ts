import type { Database } from "bun:sqlite";
import type {
	DialogueMessage,
	DialogueThread,
	DialogueThreadStatus,
	OutboxEntry,
	OutboxStatus,
} from "@nous/core";
import type { MessageStore } from "../interfaces/message-store.ts";

export class SQLiteMessageStore implements MessageStore {
	constructor(private db: Database) {}

	createThread(thread: DialogueThread): void {
		this.db
			.prepare(
				`INSERT INTO dialogue_threads (id, title, status, created_at, updated_at, metadata)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run(
				thread.id,
				thread.title ?? null,
				thread.status,
				thread.createdAt,
				thread.updatedAt,
				JSON.stringify(thread.metadata ?? {}),
			);
	}

	getThread(id: string): DialogueThread | undefined {
		const row = this.db
			.prepare("SELECT * FROM dialogue_threads WHERE id = ?")
			.get(id) as RawThreadRow | null;
		return row ? toThread(row) : undefined;
	}

	updateThread(id: string, fields: Partial<DialogueThread>): void {
		const sets: string[] = [];
		const params: (string | null)[] = [];

		const fieldMap: Record<string, string> = {
			createdAt: "created_at",
			updatedAt: "updated_at",
		};

		for (const [key, value] of Object.entries(fields)) {
			const col = fieldMap[key] ?? key;
			if (key === "metadata") {
				sets.push(`${col} = ?`);
				params.push(JSON.stringify(value ?? {}));
			} else {
				sets.push(`${col} = ?`);
				params.push((value as string | null | undefined) ?? null);
			}
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE dialogue_threads SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	listThreads(limit = 50): DialogueThread[] {
		const rows = this.db
			.prepare(
				"SELECT * FROM dialogue_threads ORDER BY updated_at DESC LIMIT ?",
			)
			.all(limit) as RawThreadRow[];
		return rows.map(toThread);
	}

	appendMessage(message: DialogueMessage): void {
		this.db
			.prepare(
				`INSERT INTO dialogue_messages (id, thread_id, role, channel, direction, content, metadata, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				message.id,
				message.threadId,
				message.role,
				message.channel,
				message.direction,
				message.content,
				JSON.stringify(message.metadata ?? {}),
				message.createdAt,
			);
	}

	getMessage(id: string): DialogueMessage | undefined {
		const row = this.db
			.prepare("SELECT * FROM dialogue_messages WHERE id = ?")
			.get(id) as RawMessageRow | null;
		return row ? toMessage(row) : undefined;
	}

	getMessagesByThread(threadId: string, limit = 100): DialogueMessage[] {
		const rows = this.db
			.prepare(
				`SELECT * FROM dialogue_messages
				 WHERE thread_id = ?
				 ORDER BY created_at ASC
				 LIMIT ?`,
			)
			.all(threadId, limit) as RawMessageRow[];
		return rows.map(toMessage);
	}

	enqueueOutbox(entry: OutboxEntry): void {
		this.db
			.prepare(
				`INSERT INTO message_outbox (id, thread_id, message_id, target_channel, status, created_at, delivered_at, failure_reason)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				entry.id,
				entry.threadId,
				entry.messageId,
				entry.targetChannel ?? null,
				entry.status,
				entry.createdAt,
				entry.deliveredAt ?? null,
				entry.failureReason ?? null,
			);
	}

	getPendingOutbox(targetChannel?: string, limit = 100): OutboxEntry[] {
		if (targetChannel) {
			const rows = this.db
				.prepare(
					`SELECT * FROM message_outbox
					 WHERE status = 'pending' AND target_channel = ?
					 ORDER BY created_at ASC
					 LIMIT ?`,
				)
				.all(targetChannel, limit) as RawOutboxRow[];
			return rows.map(toOutboxEntry);
		}

		const rows = this.db
			.prepare(
				`SELECT * FROM message_outbox
				 WHERE status = 'pending'
				 ORDER BY created_at ASC
				 LIMIT ?`,
			)
			.all(limit) as RawOutboxRow[];
		return rows.map(toOutboxEntry);
	}

	updateOutbox(id: string, fields: Partial<OutboxEntry>): void {
		const sets: string[] = [];
		const params: (string | null)[] = [];

		const fieldMap: Record<string, string> = {
			threadId: "thread_id",
			messageId: "message_id",
			targetChannel: "target_channel",
			createdAt: "created_at",
			deliveredAt: "delivered_at",
			failureReason: "failure_reason",
		};

		for (const [key, value] of Object.entries(fields)) {
			const col = fieldMap[key] ?? key;
			sets.push(`${col} = ?`);
			params.push((value as string | null | undefined) ?? null);
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE message_outbox SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	countOutbox(status?: OutboxStatus): number {
		if (status) {
			return (
				this.db
					.prepare("SELECT COUNT(*) as c FROM message_outbox WHERE status = ?")
					.get(status) as { c: number }
			).c;
		}

		return (
			this.db.prepare("SELECT COUNT(*) as c FROM message_outbox").get() as {
				c: number;
			}
		).c;
	}
}

interface RawThreadRow {
	id: string;
	title: string | null;
	status: string;
	created_at: string;
	updated_at: string;
	metadata: string;
}

interface RawMessageRow {
	id: string;
	thread_id: string;
	role: string;
	channel: string;
	direction: string;
	content: string;
	metadata: string;
	created_at: string;
}

interface RawOutboxRow {
	id: string;
	thread_id: string;
	message_id: string;
	target_channel: string | null;
	status: string;
	created_at: string;
	delivered_at: string | null;
	failure_reason: string | null;
}

function toThread(row: RawThreadRow): DialogueThread {
	return {
		id: row.id,
		title: row.title ?? undefined,
		status: row.status as DialogueThreadStatus,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		metadata: JSON.parse(row.metadata),
	};
}

function toMessage(row: RawMessageRow): DialogueMessage {
	return {
		id: row.id,
		threadId: row.thread_id,
		role: row.role as DialogueMessage["role"],
		channel: row.channel,
		direction: row.direction as DialogueMessage["direction"],
		content: row.content,
		createdAt: row.created_at,
		metadata: JSON.parse(row.metadata),
	};
}

function toOutboxEntry(row: RawOutboxRow): OutboxEntry {
	return {
		id: row.id,
		threadId: row.thread_id,
		messageId: row.message_id,
		targetChannel: row.target_channel ?? undefined,
		status: row.status as OutboxStatus,
		createdAt: row.created_at,
		deliveredAt: row.delivered_at ?? undefined,
		failureReason: row.failure_reason ?? undefined,
	};
}
