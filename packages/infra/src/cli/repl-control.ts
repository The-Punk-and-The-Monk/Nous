import type { ControlIntentResolution, ResolveControlInputResult } from "@nous/core";

export interface ReplSlashResolution {
	kind: "execute" | "clarify";
	action?:
		| "show_commands"
		| "show_status"
		| "attach_thread"
		| "detach_thread"
		| "exit_repl";
	query?: string;
	threadId?: string;
	message?: string;
	interpretedAs?: string;
}

export type ReplResolvedAction =
	| {
			kind: "submit";
			text: string;
	  }
	| {
			kind: "execute";
			action:
				| "show_commands"
				| "show_status"
				| "attach_thread"
				| "detach_thread"
				| "exit_repl";
			query?: string;
			threadId?: string;
			interpretedAs: string;
			source: "slash" | "model";
	  }
	| {
			kind: "clarify";
			message: string;
			source: "slash" | "model";
	  };

export function resolveSlashCommand(input: string): ReplSlashResolution | undefined {
	if (!input.startsWith("/")) {
		return undefined;
	}

	const raw = input.slice(1).trim();
	if (!raw) {
		return {
			kind: "clarify",
			message: "Use /commands to inspect the REPL control surface.",
		};
	}

	const [command, ...rest] = raw.split(/\s+/);
	const query = rest.join(" ").trim();
	switch (command.toLowerCase()) {
		case "help":
		case "commands":
			return {
				kind: "execute",
				action: "show_commands",
				query: query || undefined,
				interpretedAs: query ? `/commands ${query}` : "/commands",
			};
		case "status":
			return {
				kind: "execute",
				action: "show_status",
				interpretedAs: "/status",
			};
		case "attach":
			if (!query) {
				return {
					kind: "clarify",
					message:
						"Provide a thread ID like /attach thread_abc123, or use /detach to leave the current thread.",
				};
			}
			return {
				kind: "execute",
				action: "attach_thread",
				threadId: query,
				interpretedAs: `/attach ${query}`,
			};
		case "detach":
			return {
				kind: "execute",
				action: "detach_thread",
				interpretedAs: "/detach",
			};
		case "exit":
		case "quit":
			return {
				kind: "execute",
				action: "exit_repl",
				interpretedAs: "/exit",
			};
		default:
			return {
				kind: "clarify",
				message: `Unknown command: /${command}. Use /commands to inspect the available control operations.`,
			};
	}
}

export function translateControlResolution(
	text: string,
	result: ResolveControlInputResult,
): ReplResolvedAction {
	return toResolvedAction(text, result.resolution);
}

function toResolvedAction(
	text: string,
	resolution: ControlIntentResolution,
): ReplResolvedAction {
	switch (resolution.kind) {
		case "task_plane":
			return { kind: "submit", text };
		case "clarify":
			return {
				kind: "clarify",
				source: "model",
				message:
					resolution.rationale.trim() ||
					"I’m not confident enough to treat that as a control operation. Say /commands if you want the control surface, otherwise restate the task.",
			};
		case "invoke_operation":
			switch (resolution.operationId) {
				case "control.discover":
					return {
						kind: "execute",
						action: "show_commands",
						query: resolution.query,
						interpretedAs: resolution.query
							? `/commands ${resolution.query}`
							: "/commands",
						source: "model",
					};
				case "status.overview":
					return {
						kind: "execute",
						action: "show_status",
						interpretedAs: "/status",
						source: "model",
					};
				case "thread.attach":
					if (!resolution.threadId) {
						return {
							kind: "clarify",
							source: "model",
							message:
								resolution.rationale ||
								"I can attach to another thread if you provide a concrete thread id like thread_abc123.",
						};
					}
					return {
						kind: "execute",
						action: "attach_thread",
						threadId: resolution.threadId,
						interpretedAs: `/attach ${resolution.threadId}`,
						source: "model",
					};
				case "thread.detach":
					return {
						kind: "execute",
						action: "detach_thread",
						interpretedAs: "/detach",
						source: "model",
					};
				case "session.exit":
					return {
						kind: "execute",
						action: "exit_repl",
						interpretedAs: "/exit",
						source: "model",
					};
				default:
					return {
						kind: "clarify",
						source: "model",
						message:
							resolution.rationale ||
							`The control interpretation resolved to ${resolution.operationId ?? "an unknown operation"}, but this client does not execute it directly in the REPL yet.`,
					};
			}
	}
}
