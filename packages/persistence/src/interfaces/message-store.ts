import type {
	DialogueMessage,
	DialogueThread,
	OutboxEntry,
	OutboxStatus,
} from "@nous/core";

export interface MessageStore {
	createThread(thread: DialogueThread): void;
	getThread(id: string): DialogueThread | undefined;
	updateThread(id: string, fields: Partial<DialogueThread>): void;
	listThreads(limit?: number): DialogueThread[];

	appendMessage(message: DialogueMessage): void;
	getMessage(id: string): DialogueMessage | undefined;
	getMessagesByThread(threadId: string, limit?: number): DialogueMessage[];

	enqueueOutbox(entry: OutboxEntry): void;
	getPendingOutbox(targetChannel?: string, limit?: number): OutboxEntry[];
	updateOutbox(id: string, fields: Partial<OutboxEntry>): void;
	countOutbox(status?: OutboxStatus): number;
}
