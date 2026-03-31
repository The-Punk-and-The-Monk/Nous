import type { ChannelType } from "./channel.ts";

export type ControlSurfaceChannel = Extract<ChannelType, "cli" | "ide" | "web">;

export type ControlSurfaceKind = "cli" | "repl" | "ide" | "web";

export type ControlSurfaceCategory =
	| "core"
	| "daemon"
	| "thread"
	| "inspect"
	| "permissions"
	| "network"
	| "discovery"
	| "session";

export interface ControlSurfaceSyntax {
	surface: ControlSurfaceKind;
	usage: string;
}

export interface ControlSurfaceEntry {
	id: string;
	title: string;
	summary: string;
	category: ControlSurfaceCategory;
	syntaxes: ControlSurfaceSyntax[];
	examples?: string[];
	tags?: string[];
	channels?: ControlSurfaceChannel[];
	requiresDaemon?: boolean;
	requiresThread?: boolean;
	foregroundOnly?: boolean;
	sideEffectClass?: "read_only" | "state_change";
}

export interface ControlSurfaceContext {
	surface: ControlSurfaceKind;
	channelType: ControlSurfaceChannel;
	daemonRunning: boolean;
	currentThreadId?: string;
	scopeLabels?: string[];
}

export type ControlIntentResolutionKind =
	| "invoke_operation"
	| "task_plane"
	| "clarify";

export interface ControlIntentResolution {
	kind: ControlIntentResolutionKind;
	operationId?: string;
	confidence: "high" | "medium" | "low";
	rationale: string;
	query?: string;
	threadId?: string;
}

export interface ResolveControlInputPayload {
	text: string;
	surface: ControlSurfaceKind;
	currentThreadId?: string;
}

export interface ResolveControlInputResult {
	resolution: ControlIntentResolution;
}
