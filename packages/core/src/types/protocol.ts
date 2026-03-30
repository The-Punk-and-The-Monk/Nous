import type { ISOTimestamp } from "../utils/timestamp.ts";
import type { Channel, ChannelScope } from "./channel.ts";
import type {
	DialogueMessage,
	DialogueThread,
	OutboxEntry,
} from "./dialogue.ts";
import type { Intent } from "./intent.ts";
import type { Task } from "./task.ts";

export type ClientMessageType =
	| "attach"
	| "detach"
	| "submit_intent"
	| "send_message"
	| "get_status"
	| "get_thread"
	| "approve_decision"
	| "cancel_intent"
	| "subscribe"
	| "unsubscribe";

export type DaemonMessageType =
	| "ack"
	| "response"
	| "progress"
	| "result"
	| "decision_needed"
	| "notification"
	| "error";

export interface ClientEnvelope<TPayload = unknown> {
	id: string;
	type: ClientMessageType;
	channel: {
		id: string;
		type: Channel["type"];
		scope: ChannelScope;
	};
	payload: TPayload;
	timestamp: ISOTimestamp;
}

export interface DaemonEnvelope<TPayload = unknown> {
	id?: string;
	type: DaemonMessageType;
	threadId?: string;
	intentId?: string;
	payload: TPayload;
	timestamp: ISOTimestamp;
}

export interface AttachPayload {
	threadId?: string;
	channel: Channel;
	replayPending?: boolean;
}

export interface AttachAckPayload {
	channel: Channel;
	thread?: DialogueThread;
	pendingMessages: OutboxEntry[];
}

export interface SubmitIntentPayload {
	text: string;
	threadId?: string;
	scope?: ChannelScope;
}

export interface SubmitIntentAckPayload {
	threadId: string;
	messageId: string;
	status: "accepted";
}

export interface SendMessagePayload {
	threadId?: string;
	text: string;
	scope?: ChannelScope;
}

export interface SendMessageAckPayload {
	threadId: string;
	messageId: string;
	status: "accepted";
}

export interface ApproveDecisionPayload {
	decisionId: string;
	threadId?: string;
	approved?: boolean;
	optionId?: string;
	note?: string;
}

export interface ApproveDecisionAckPayload {
	decisionId: string;
	threadId?: string;
	messageId?: string;
	status: "accepted";
}

export interface CancelIntentPayload {
	intentId?: string;
	threadId?: string;
	reason?: string;
}

export interface CancelIntentAckPayload {
	intentId?: string;
	threadId?: string;
	status: "accepted";
}

export interface ThreadSnapshot {
	thread: DialogueThread;
	messages: DialogueMessage[];
	pendingOutbox: OutboxEntry[];
}

export interface GetThreadPayload {
	threadId: string;
}

export interface StatusSnapshot {
	activeIntents: Intent[];
	activeTasks: Task[];
	pendingOutboxCount: number;
	connectedChannels: Channel[];
}
