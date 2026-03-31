import type {
	ApproveDecisionPayload,
	AttachPayload,
	CancelIntentPayload,
	ClientEnvelope,
	DaemonEnvelope,
	GetThreadPayload,
	ResolveControlInputPayload,
	ResolveControlInputResult,
	SendMessagePayload,
	StatusSnapshot,
	SubmitIntentPayload,
	ThreadSnapshot,
} from "@nous/core";
import { now } from "@nous/core";
import type { DialogueService } from "./dialogue-service.ts";

interface DaemonControllerConfig {
	dialogue: DialogueService;
	onResolveControlInput?: (
		channel: ClientEnvelope["channel"],
		payload: ResolveControlInputPayload,
	) => Promise<ResolveControlInputResult> | ResolveControlInputResult;
}

export class DaemonController {
	private readonly dialogue: DialogueService;
	private readonly onResolveControlInput?: DaemonControllerConfig["onResolveControlInput"];

	constructor(config: DialogueService | DaemonControllerConfig) {
		if ("attach" in config) {
			this.dialogue = config;
			return;
		}
		this.dialogue = config.dialogue;
		this.onResolveControlInput = config.onResolveControlInput;
	}

	async handle(message: ClientEnvelope): Promise<DaemonEnvelope | undefined> {
		switch (message.type) {
			case "attach":
				return withRequestId(
					this.dialogue.attach(message.payload as AttachPayload),
					message.id,
				);
			case "detach":
				this.dialogue.detach(message.channel.id);
				return withRequestId(
					{
						type: "ack",
						timestamp: now(),
						payload: { channelId: message.channel.id, status: "detached" },
					},
					message.id,
				);
			case "submit_intent":
				return withRequestId(
					await this.dialogue.submitIntent(
						toChannel(message),
						message.payload as SubmitIntentPayload,
					),
					message.id,
				);
			case "send_message":
				return withRequestId(
					await this.dialogue.sendMessage(
						toChannel(message),
						message.payload as SendMessagePayload,
					),
					message.id,
				);
			case "get_thread": {
				const snapshot = this.dialogue.getThreadSnapshot(
					message.payload as GetThreadPayload,
				);
				return withRequestId(
					{
						type: snapshot ? "response" : "error",
						timestamp: now(),
						threadId: snapshot?.thread.id,
						payload: snapshot ?? { message: "thread_not_found" },
					} as DaemonEnvelope<ThreadSnapshot | { message: string }>,
					message.id,
				);
			}
			case "get_status":
				return withRequestId(
					{
						type: "response",
						timestamp: now(),
						payload: this.dialogue.getStatusSnapshot(),
					} as DaemonEnvelope<StatusSnapshot>,
					message.id,
				);
			case "resolve_control_input":
				return withRequestId(
					{
						type: "response",
						timestamp: now(),
						payload: this.onResolveControlInput
							? await this.onResolveControlInput(
									message.channel,
									message.payload as ResolveControlInputPayload,
								)
							: {
									resolution: {
										kind: "task_plane",
										confidence: "low",
										rationale:
											"Control-input resolution is not configured.",
									},
								},
					} as DaemonEnvelope<ResolveControlInputResult>,
					message.id,
				);
			case "approve_decision":
				return withRequestId(
					await this.dialogue.approveDecision(
						toChannel(message),
						message.payload as ApproveDecisionPayload,
					),
					message.id,
				);
			case "cancel_intent":
				return withRequestId(
					await this.dialogue.cancelIntent(
						toChannel(message),
						message.payload as CancelIntentPayload,
					),
					message.id,
				);
			case "subscribe":
			case "unsubscribe":
				return withRequestId(
					{
						type: "error",
						timestamp: now(),
						payload: {
							message: `not_implemented:${message.type}`,
						},
					},
					message.id,
				);
			default:
				return undefined;
		}
	}
}

function toChannel(message: ClientEnvelope) {
	return {
		id: message.channel.id,
		type: message.channel.type,
		scope: message.channel.scope,
		status: "connected" as const,
		connectedAt: message.timestamp,
		lastSeenAt: message.timestamp,
		subscriptions: [],
	};
}

function withRequestId<TPayload>(
	response: DaemonEnvelope<TPayload>,
	id: string,
): DaemonEnvelope<TPayload> {
	return { ...response, id };
}
