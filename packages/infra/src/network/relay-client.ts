import type { CommunicationPolicy, Event, NousMessage } from "@nous/core";
import { DEFAULT_COMMUNICATION_POLICY, now, prefixedId } from "@nous/core";
import type { EventStore } from "@nous/persistence";
import type { NousIdentity } from "./identity.ts";
import { PolicyEnforcer } from "./policy.ts";

export interface RelayClientConfig {
	relayUrl: string;
	identity: NousIdentity;
	eventStore: EventStore;
	policy?: CommunicationPolicy;
}

/** WebSocket client for the Nous relay network */
export class RelayClient {
	private ws: WebSocket | null = null;
	private identity: NousIdentity;
	private relayUrl: string;
	private eventStore: EventStore;
	private policy: PolicyEnforcer;
	private messageHandlers: ((msg: NousMessage) => void)[] = [];
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;

	constructor(config: RelayClientConfig) {
		this.relayUrl = config.relayUrl;
		this.identity = config.identity;
		this.eventStore = config.eventStore;
		this.policy = new PolicyEnforcer(
			config.policy ?? DEFAULT_COMMUNICATION_POLICY,
		);
	}

	/** Connect to the relay server */
	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const wsUrl = `${this.relayUrl.replace(/^http/, "ws")}/ws`;
			this.ws = new WebSocket(wsUrl);

			this.ws.onopen = () => {
				this.reconnectAttempts = 0;
				// Register with relay
				this.ws?.send(
					JSON.stringify({
						type: "register",
						instanceId: this.identity.instanceId,
						publicKey: this.identity.publicKey,
					}),
				);
				resolve();
			};

			this.ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data as string) as NousMessage;
					this.handleIncoming(message);
				} catch {
					// Ignore malformed messages
				}
			};

			this.ws.onclose = () => {
				if (this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++;
					const delay = 1000 * 2 ** this.reconnectAttempts;
					setTimeout(() => this.connect(), delay);
				}
			};

			this.ws.onerror = (err) => {
				if (this.reconnectAttempts === 0) {
					reject(new Error("WebSocket connection failed"));
				}
			};
		});
	}

	/** Send a message to another Nous instance */
	send(message: NousMessage): boolean {
		const check = this.policy.canSend(message);
		if (!check.allowed) {
			this.emitEvent("comm.blocked", "communication", message.id, {
				reason: check.reason,
				direction: "outgoing",
			});
			return false;
		}

		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
			return true;
		}
		return false;
	}

	/** Register a handler for incoming messages */
	onMessage(handler: (msg: NousMessage) => void): void {
		this.messageHandlers.push(handler);
	}

	private handleIncoming(message: NousMessage): void {
		const check = this.policy.canReceive(message);
		if (!check.allowed) {
			this.emitEvent("comm.blocked", "communication", message.id, {
				reason: check.reason,
				direction: "incoming",
			});
			return;
		}

		for (const handler of this.messageHandlers) {
			handler(message);
		}
	}

	disconnect(): void {
		this.ws?.close();
		this.ws = null;
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	private emitEvent(
		type: string,
		entityType: string,
		entityId: string,
		payload: Record<string, unknown>,
	): void {
		const event: Event = {
			id: prefixedId("evt"),
			timestamp: now(),
			type: type as Event["type"],
			entityType: entityType as Event["entityType"],
			entityId,
			payload,
		};
		this.eventStore.append(event);
	}
}
