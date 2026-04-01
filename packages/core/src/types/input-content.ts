import type { ISOTimestamp } from "../utils/timestamp.ts";

export type InputContentSource = "human" | "sensor" | "system";

export interface TextInputPart {
	type: "text";
	text: string;
}

export interface ImageInputPart {
	type: "image";
	path?: string;
	mimeType?: string;
	alt?: string;
}

export interface AudioInputPart {
	type: "audio";
	path?: string;
	mimeType?: string;
	transcriptHint?: string;
}

export interface VideoInputPart {
	type: "video";
	path?: string;
	mimeType?: string;
	transcriptHint?: string;
}

export interface FileInputPart {
	type: "file";
	path: string;
	mimeType?: string;
}

export interface ScreenSnapshotInputPart {
	type: "screen_snapshot";
	path: string;
	capturedAt: ISOTimestamp;
}

export interface ScreenRecordingInputPart {
	type: "screen_recording";
	path: string;
	capturedAt: ISOTimestamp;
	durationMs?: number;
}

export type InputPart =
	| TextInputPart
	| ImageInputPart
	| AudioInputPart
	| VideoInputPart
	| FileInputPart
	| ScreenSnapshotInputPart
	| ScreenRecordingInputPart;

export interface TurnInputEnvelope {
	id: string;
	threadId?: string;
	source: InputContentSource;
	parts: InputPart[];
	createdAt: ISOTimestamp;
	metadata?: Record<string, unknown>;
}
