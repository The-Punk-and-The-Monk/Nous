import type { ISOTimestamp } from "../utils/timestamp.ts";

export interface Sensor {
	id: string;
	type: string;
	config: Record<string, unknown>;
	status: "active" | "paused" | "error";
	emitRateLimit: number;
}

export interface PerceptionSignal {
	id: string;
	sensorId: string;
	timestamp: ISOTimestamp;
	signalType: string;
	payload: unknown;
	attentionResult?: AttentionResult;
}

export interface AttentionResult {
	relevance: number;
	disposition: "discard" | "log" | "promote";
	ambientIntentId?: string;
}
