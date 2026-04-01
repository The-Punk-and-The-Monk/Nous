import type {
	ApproveDecisionAckPayload,
	ApproveDecisionPayload,
	AttachAckPayload,
	AttachPayload,
	CancelIntentAckPayload,
	CancelIntentPayload,
	Channel,
	DaemonEnvelope,
	DaemonMessageType,
	DialogueMessage,
	DialogueMessageMetadata,
	DialogueThread,
	GetThreadPayload,
	OutboxEntry,
	SendMessageAckPayload,
	SendMessagePayload,
	StatusSnapshot,
	SubmitIntentAckPayload,
	SubmitIntentPayload,
	ThreadSnapshot,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { IntentStore, MessageStore, TaskStore } from "@nous/persistence";

export interface DialogueServiceConfig {
	messageStore: MessageStore;
	intentStore?: IntentStore;
	taskStore?: TaskStore;
	idFactory?: (prefix: string) => string;
	now?: () => string;
	onSubmitIntent?: (payload: {
		threadId: string;
		messageId: string;
		text: string;
		channel: Channel;
	}) => void | Promise<void>;
	onSendMessage?: (payload: {
		threadId: string;
		messageId: string;
		text: string;
		channel: Channel;
	}) => void | Promise<void>;
	onApproveDecision?: (payload: {
		decisionId: string;
		threadId?: string;
		messageId?: string;
		approved?: boolean;
		optionId?: string;
		note?: string;
		channel: Channel;
	}) => void | Promise<void>;
	onCancelIntent?: (payload: {
		intentId?: string;
		threadId?: string;
		reason?: string;
		channel: Channel;
	}) => void | Promise<void>;
}

export class DialogueService {
	private readonly channels = new Map<string, Channel>();
	private readonly idFactory: (prefix: string) => string;
	private readonly clock: () => string;

	constructor(private readonly config: DialogueServiceConfig) {
		this.idFactory = config.idFactory ?? prefixedId;
		this.clock = config.now ?? now;
	}

	attach(payload: AttachPayload): DaemonEnvelope<AttachAckPayload> {
		const attachedAt = this.clock();
		const channel: Channel = {
			...payload.channel,
			status: "connected",
			lastSeenAt: attachedAt,
		};
		this.channels.set(channel.id, channel);

		let thread: DialogueThread | undefined;
		if (payload.threadId) {
			thread = this.config.messageStore.getThread(payload.threadId);
		}

		const pendingMessages =
			payload.replayPending === false
				? []
				: this.config.messageStore
						.getPendingOutbox(channel.id)
						.filter((entry) => !thread || entry.threadId === thread.id);

		return {
			type: "ack",
			timestamp: attachedAt,
			threadId: thread?.id,
			payload: {
				channel,
				thread,
				pendingMessages,
			},
		};
	}

	detach(channelId: string): void {
		const existing = this.channels.get(channelId);
		if (!existing) return;
		this.channels.set(channelId, {
			...existing,
			status: "disconnected",
			lastSeenAt: this.clock(),
		});
	}

	async submitIntent(
		channel: Channel,
		payload: SubmitIntentPayload,
	): Promise<DaemonEnvelope<SubmitIntentAckPayload>> {
		const acceptedAt = this.clock();
		const thread = this.getOrCreateThread(payload.threadId, {
			channelId: channel.id,
			title: inferThreadTitle(payload.text),
		});
		const message = this.storeInboundMessage(thread.id, channel, payload.text);

		if (this.config.onSubmitIntent) {
			await this.config.onSubmitIntent({
				threadId: thread.id,
				messageId: message.id,
				text: payload.text,
				channel,
			});
		}

		return {
			type: "ack",
			threadId: thread.id,
			timestamp: acceptedAt,
			payload: {
				threadId: thread.id,
				messageId: message.id,
				status: "accepted",
			},
		};
	}

	sendMessage(
		channel: Channel,
		payload: SendMessagePayload,
	): Promise<DaemonEnvelope<SendMessageAckPayload>> {
		const acceptedAt = this.clock();
		const thread = this.getOrCreateThread(payload.threadId, {
			channelId: channel.id,
			title: inferThreadTitle(payload.text),
		});
		const message = this.storeInboundMessage(thread.id, channel, payload.text);

		if (this.config.onSendMessage) {
			return Promise.resolve(
				this.config.onSendMessage({
					threadId: thread.id,
					messageId: message.id,
					text: payload.text,
					channel,
				}),
			).then(() => ({
				type: "ack",
				threadId: thread.id,
				timestamp: acceptedAt,
				payload: {
					threadId: thread.id,
					messageId: message.id,
					status: "accepted",
				},
			}));
		}

		return Promise.resolve({
			type: "ack",
			threadId: thread.id,
			timestamp: acceptedAt,
			payload: {
				threadId: thread.id,
				messageId: message.id,
				status: "accepted",
			},
		});
	}

	async approveDecision(
		channel: Channel,
		payload: ApproveDecisionPayload,
	): Promise<DaemonEnvelope<ApproveDecisionAckPayload>> {
		const acceptedAt = this.clock();
		let messageId: string | undefined;
		let threadId = payload.threadId;

		if (payload.note && payload.note.trim().length > 0) {
			const thread = this.getOrCreateThread(payload.threadId, {
				channelId: channel.id,
				title: inferThreadTitle(payload.note),
			});
			const message = this.storeInboundMessage(
				thread.id,
				channel,
				payload.note,
			);
			messageId = message.id;
			threadId = thread.id;
		}

		if (this.config.onApproveDecision) {
			await this.config.onApproveDecision({
				decisionId: payload.decisionId,
				threadId,
				messageId,
				approved: payload.approved,
				optionId: payload.optionId,
				note: payload.note,
				channel,
			});
		}

		return {
			type: "ack",
			threadId,
			timestamp: acceptedAt,
			payload: {
				decisionId: payload.decisionId,
				threadId,
				messageId,
				status: "accepted",
			},
		};
	}

	async cancelIntent(
		channel: Channel,
		payload: CancelIntentPayload,
	): Promise<DaemonEnvelope<CancelIntentAckPayload>> {
		const acceptedAt = this.clock();
		if (this.config.onCancelIntent) {
			await this.config.onCancelIntent({
				intentId: payload.intentId,
				threadId: payload.threadId,
				reason: payload.reason,
				channel,
			});
		}

		return {
			type: "ack",
			threadId: payload.threadId,
			timestamp: acceptedAt,
			payload: {
				intentId: payload.intentId,
				threadId: payload.threadId,
				status: "accepted",
			},
		};
	}

	ensureThread(params: {
		threadId: string;
		title: string;
		channelId?: string;
	}): DialogueThread {
		return this.getOrCreateThread(params.threadId, {
			channelId: params.channelId ?? "daemon",
			title: params.title,
		});
	}

	enqueueAssistantMessage(params: {
		threadId: string;
		content: string;
		targetChannel?: string;
		kind?: Extract<
			DaemonMessageType,
			"progress" | "result" | "notification" | "decision_needed"
		>;
		metadata?: Record<string, unknown>;
	}): OutboundMessageRecord {
		const thread = this.requireThread(params.threadId);
		const createdAt = this.clock();
		const kind = params.kind ?? "notification";
		const presentation: DialogueMessageMetadata["presentation"] =
			typeof params.metadata?.presentation === "string"
				? (params.metadata
						.presentation as DialogueMessageMetadata["presentation"])
				: kind === "result"
					? "answer"
					: kind === "decision_needed"
						? "decision"
						: "process";
		const phase: DialogueMessageMetadata["phase"] =
			typeof params.metadata?.phase === "string"
				? (params.metadata.phase as DialogueMessageMetadata["phase"])
				: kind === "result"
					? "final"
					: "commentary";
		const message: DialogueMessage = {
			id: this.idFactory("msg"),
			threadId: thread.id,
			role: "assistant",
			channel: params.targetChannel ?? "daemon",
			direction: "outbound",
			content: params.content,
			createdAt,
			metadata: {
				kind,
				presentation,
				phase,
				...(params.metadata ?? {}),
			},
		};
		this.config.messageStore.appendMessage(message);

		const outbox = {
			id: this.idFactory("outbox"),
			threadId: thread.id,
			messageId: message.id,
			targetChannel: params.targetChannel,
			status: "pending" as const,
			createdAt,
		};
		this.config.messageStore.enqueueOutbox(outbox);
		this.touchThread(thread.id, createdAt);

		return { message, outbox };
	}

	drainPendingDeliveries(params: {
		channelId: string;
		threadId?: string;
	}): OutboundDelivery[] {
		const deliveries = this.peekPendingDeliveries({
			channelId: params.channelId,
			threadId: params.threadId,
		});
		this.markDeliveriesDelivered(deliveries);
		return deliveries;
	}

	peekPendingDeliveries(params: {
		channelId?: string;
		threadId?: string;
	}): OutboundDelivery[] {
		const entries = this.config.messageStore
			.getPendingOutbox()
			.filter(
				(entry) =>
					!params.channelId || isDeliverableToChannel(entry, params.channelId),
			)
			.filter(
				(entry) => !params.threadId || entry.threadId === params.threadId,
			);

		const deliveries: OutboundDelivery[] = [];
		for (const entry of entries) {
			const message = this.config.messageStore.getMessage(entry.messageId);
			if (!message) {
				this.config.messageStore.updateOutbox(entry.id, {
					status: "failed",
					failureReason: "message_not_found",
				});
				continue;
			}
			deliveries.push({ entry, message });
		}

		return deliveries;
	}

	markDeliveriesDelivered(deliveries: OutboundDelivery[]): void {
		if (deliveries.length === 0) return;
		const deliveredAt = this.clock();
		for (const delivery of deliveries) {
			this.config.messageStore.updateOutbox(delivery.entry.id, {
				status: "delivered",
				deliveredAt,
				failureReason: undefined,
			});
		}
	}

	getThreadSnapshot(payload: GetThreadPayload): ThreadSnapshot | undefined {
		const thread = this.config.messageStore.getThread(payload.threadId);
		if (!thread) return undefined;

		return {
			thread,
			messages: this.config.messageStore.getMessagesByThread(thread.id),
			pendingOutbox: this.config.messageStore
				.getPendingOutbox()
				.filter((entry) => entry.threadId === thread.id),
		};
	}

	getStatusSnapshot(): StatusSnapshot {
		return {
			activeIntents: this.config.intentStore?.getActive() ?? [],
			activeTasks: [
				...(this.config.taskStore?.getByStatus("queued") ?? []),
				...(this.config.taskStore?.getByStatus("assigned") ?? []),
				...(this.config.taskStore?.getByStatus("running") ?? []),
			],
			pendingOutboxCount: this.config.messageStore.countOutbox("pending"),
			connectedChannels: [...this.channels.values()].filter(
				(channel) => channel.status === "connected",
			),
		};
	}

	linkIntentToThread(threadId: string, intentId: string): void {
		const thread = this.requireThread(threadId);
		const metadata = { ...(thread.metadata ?? {}) };
		const intentIds = new Set(
			Array.isArray(metadata.intentIds) ? (metadata.intentIds as string[]) : [],
		);
		intentIds.add(intentId);
		metadata.intentIds = [...intentIds];
		metadata.activeIntentId = intentId;
		metadata.activeWorkItemId = intentId;
		this.config.messageStore.updateThread(threadId, {
			updatedAt: this.clock(),
			metadata,
		});
	}

	setHandoffCapsuleForThread(threadId: string, capsuleId: string): void {
		const thread = this.requireThread(threadId);
		const metadata = {
			...(thread.metadata ?? {}),
			handoffCapsuleId: capsuleId,
		};
		this.config.messageStore.updateThread(threadId, {
			updatedAt: this.clock(),
			metadata,
		});
	}

	private getOrCreateThread(
		threadId: string | undefined,
		input: { channelId: string; title: string },
	): DialogueThread {
		if (threadId) {
			const existing = this.config.messageStore.getThread(threadId);
			if (existing) {
				this.touchThread(existing.id);
				return existing;
			}
		}

		const timestamp = this.clock();
		const thread: DialogueThread = {
			id: threadId ?? this.idFactory("thread"),
			title: input.title,
			status: "active",
			createdAt: timestamp,
			updatedAt: timestamp,
			metadata: {
				channelIds: [input.channelId],
				originChannel: input.channelId,
				surfaceKind: inferSurfaceKind(input.channelId),
			},
		};
		this.config.messageStore.createThread(thread);
		return thread;
	}

	private storeInboundMessage(
		threadId: string,
		channel: Channel,
		text: string,
	): DialogueMessage {
		const message: DialogueMessage = {
			id: this.idFactory("msg"),
			threadId,
			role: "human",
			channel: channel.id,
			direction: "inbound",
			content: text,
			createdAt: this.clock(),
			metadata: {
				turnId: undefined,
				channelType: channel.type,
				scope: channel.scope,
			},
		};
		message.metadata = {
			...message.metadata,
			turnId: message.id,
		};
		this.config.messageStore.appendMessage(message);
		this.touchThread(threadId, message.createdAt, channel.id);
		return message;
	}

	private touchThread(
		threadId: string,
		updatedAt = this.clock(),
		channelId?: string,
	): void {
		const thread = this.config.messageStore.getThread(threadId);
		if (!thread) return;

		const metadata = { ...(thread.metadata ?? {}) };
		const currentChannelIds = new Set(
			Array.isArray(metadata.channelIds)
				? (metadata.channelIds as string[])
				: [],
		);
		if (channelId) {
			currentChannelIds.add(channelId);
			metadata.surfaceKind = inferSurfaceKind(channelId);
		}
		metadata.channelIds = [...currentChannelIds];

		this.config.messageStore.updateThread(threadId, {
			updatedAt,
			metadata,
		});
	}

	private requireThread(threadId: string): DialogueThread {
		const thread = this.config.messageStore.getThread(threadId);
		if (!thread) {
			throw new Error(`Unknown thread: ${threadId}`);
		}
		return thread;
	}
}

export interface OutboundMessageRecord {
	message: DialogueMessage;
	outbox: {
		id: string;
		threadId: string;
		messageId: string;
		targetChannel?: string;
		status: "pending";
		createdAt: string;
	};
}

export interface OutboundDelivery {
	entry: OutboxEntry;
	message: DialogueMessage;
}

function inferThreadTitle(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length <= 60) return trimmed;
	return `${trimmed.slice(0, 57)}...`;
}

function isDeliverableToChannel(
	entry: OutboxEntry,
	channelId: string,
): boolean {
	return !entry.targetChannel || entry.targetChannel === channelId;
}

function inferSurfaceKind(channelId: string) {
	if (channelId.startsWith("channel_cli")) {
		return "cli" as const;
	}
	if (channelId.startsWith("channel_ide")) {
		return "ide" as const;
	}
	if (channelId.startsWith("channel_web")) {
		return "web" as const;
	}
	if (channelId.startsWith("channel_notification")) {
		return "notification" as const;
	}
	if (channelId === "daemon") {
		return "daemon" as const;
	}
	return "unknown" as const;
}
