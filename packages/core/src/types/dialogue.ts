import type { ISOTimestamp } from "../utils/timestamp.ts";
import type { DialogueMessageMetadata } from "./interaction.ts";

export type DialogueThreadStatus = "active" | "archived";
export type DialogueRole = "human" | "assistant" | "system";
export type DialogueDirection = "inbound" | "outbound";
export type OutboxStatus = "pending" | "delivered" | "failed";
export type DialogueThreadSurfaceKind =
	| "cli"
	| "ide"
	| "web"
	| "notification"
	| "daemon"
	| "unknown";

export interface DialogueThreadMetadata extends Record<string, unknown> {
	channelIds?: string[];
	intentIds?: string[];
	activeIntentId?: string;
	handoffCapsuleId?: string;
	surfaceKind?: DialogueThreadSurfaceKind;
	originChannel?: string;
}

export interface DialogueThread {
	id: string;
	title?: string;
	status: DialogueThreadStatus;
	createdAt: ISOTimestamp;
	updatedAt: ISOTimestamp;
	metadata?: DialogueThreadMetadata;
}

export interface DialogueMessage {
	id: string;
	threadId: string;
	role: DialogueRole;
	channel: string;
	direction: DialogueDirection;
	content: string;
	createdAt: ISOTimestamp;
	metadata?: DialogueMessageMetadata;
}

export interface OutboxEntry {
	id: string;
	threadId: string;
	messageId: string;
	targetChannel?: string;
	status: OutboxStatus;
	createdAt: ISOTimestamp;
	deliveredAt?: ISOTimestamp;
	failureReason?: string;
}
