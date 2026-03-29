import type { ISOTimestamp } from "../utils/timestamp.ts";

export type ChannelType = "cli" | "ide" | "web" | "mobile" | "api" | "sensor";
export type ChannelStatus = "connected" | "disconnected";

export interface ChannelScope {
	workingDirectory?: string;
	projectRoot?: string;
	focusedFile?: string;
	labels?: string[];
}

export interface Channel {
	id: string;
	type: ChannelType;
	scope: ChannelScope;
	status: ChannelStatus;
	connectedAt: ISOTimestamp;
	lastSeenAt: ISOTimestamp;
	subscriptions: string[];
	metadata?: Record<string, unknown>;
}
