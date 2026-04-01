import type { ControlIntentResolution, ResolveControlInputResult } from "@nous/core";

export interface ReplSlashResolution {
	kind: "execute" | "clarify";
	action?:
		| "show_commands"
		| "show_status"
		| "show_daemon_status"
		| "debug_daemon"
		| "debug_thread"
		| "show_events"
		| "show_memory"
		| "show_permissions"
		| "show_network_status"
		| "show_network_policy"
		| "show_network_log"
		| "attach_thread"
		| "detach_thread"
		| "exit_repl";
	query?: string;
	threadId?: string;
	limit?: number;
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
				| "show_daemon_status"
				| "debug_daemon"
				| "debug_thread"
				| "show_events"
				| "show_memory"
				| "show_permissions"
				| "show_network_status"
				| "show_network_policy"
				| "show_network_log"
				| "attach_thread"
				| "detach_thread"
				| "exit_repl";
			query?: string;
			threadId?: string;
			limit?: number;
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
		case "daemon":
			if (!query || query === "status") {
				return {
					kind: "execute",
					action: "show_daemon_status",
					interpretedAs: "/daemon status",
				};
			}
			return {
				kind: "clarify",
				message: "Supported daemon REPL commands: /daemon status",
			};
		case "debug": {
			const [subject, ...restParts] = rest;
			const restQuery = restParts.join(" ").trim();
			if (subject === "daemon") {
				return {
					kind: "execute",
					action: "debug_daemon",
					interpretedAs: "/debug daemon",
				};
			}
			if (subject === "thread") {
				return {
					kind: "execute",
					action: "debug_thread",
					threadId: restQuery || undefined,
					interpretedAs: restQuery
						? `/debug thread ${restQuery}`
						: "/debug thread",
				};
			}
			return {
				kind: "clarify",
				message:
					"Supported debug REPL commands: /debug daemon, /debug thread [threadId]",
			};
		}
		case "events": {
			const limit = query ? Number(query) : undefined;
			return {
				kind: "execute",
				action: "show_events",
				limit:
					typeof limit === "number" && Number.isFinite(limit)
						? Math.max(1, Math.floor(limit))
						: undefined,
				interpretedAs: query ? `/events ${query}` : "/events",
			};
		}
		case "memory":
			return {
				kind: "execute",
				action: "show_memory",
				query: query || undefined,
				interpretedAs: query ? `/memory ${query}` : "/memory",
			};
		case "permissions":
			return {
				kind: "execute",
				action: "show_permissions",
				interpretedAs: "/permissions",
			};
		case "network": {
			const [subcommand, ...networkRest] = rest;
			const networkQuery = networkRest.join(" ").trim();
			if (!subcommand || subcommand === "status") {
				return {
					kind: "execute",
					action: "show_network_status",
					interpretedAs: "/network status",
				};
			}
			if (subcommand === "policy") {
				return {
					kind: "execute",
					action: "show_network_policy",
					interpretedAs: "/network policy",
				};
			}
			if (subcommand === "log") {
				const limit = networkQuery ? Number(networkQuery) : undefined;
				return {
					kind: "execute",
					action: "show_network_log",
					limit:
						typeof limit === "number" && Number.isFinite(limit)
							? Math.max(1, Math.floor(limit))
							: undefined,
					interpretedAs: networkQuery
						? `/network log ${networkQuery}`
						: "/network log",
				};
			}
			return {
				kind: "clarify",
				message:
					"Supported network REPL commands: /network status, /network policy, /network log [N]",
			};
		}
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
				case "daemon.status":
					return {
						kind: "execute",
						action: "show_daemon_status",
						interpretedAs: "/daemon status",
						source: "model",
					};
				case "debug.daemon":
					return {
						kind: "execute",
						action: "debug_daemon",
						interpretedAs: "/debug daemon",
						source: "model",
					};
				case "debug.thread":
					return {
						kind: "execute",
						action: "debug_thread",
						threadId: resolution.threadId,
						interpretedAs: resolution.threadId
							? `/debug thread ${resolution.threadId}`
							: "/debug thread",
						source: "model",
					};
				case "events.list":
					return {
						kind: "execute",
						action: "show_events",
						query: resolution.query,
						interpretedAs: resolution.query
							? `/events ${resolution.query}`
							: "/events",
						source: "model",
					};
				case "memory.browse":
					return {
						kind: "execute",
						action: "show_memory",
						query: resolution.query,
						interpretedAs: resolution.query
							? `/memory ${resolution.query}`
							: "/memory",
						source: "model",
					};
				case "permissions.show":
					return {
						kind: "execute",
						action: "show_permissions",
						interpretedAs: "/permissions",
						source: "model",
					};
				case "network.status":
					return {
						kind: "execute",
						action: "show_network_status",
						interpretedAs: "/network status",
						source: "model",
					};
				case "network.policy":
					return {
						kind: "execute",
						action: "show_network_policy",
						interpretedAs: "/network policy",
						source: "model",
					};
				case "network.log":
					return {
						kind: "execute",
						action: "show_network_log",
						query: resolution.query,
						interpretedAs: resolution.query
							? `/network log ${resolution.query}`
							: "/network log",
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
