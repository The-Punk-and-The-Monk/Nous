export interface ReplControlContext {
	daemonRunning: boolean;
	currentThreadId?: string;
}

export type ReplControlResolution =
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
			operationId: string;
			source: "slash" | "natural_language";
			confidence: "explicit" | "high";
			query?: string;
			threadId?: string;
			interpretedAs: string;
	  }
	| {
			kind: "clarify";
			message: string;
			operationId?: string;
			source: "slash" | "natural_language";
			confidence: "medium";
	  };

const DISCOVERY_HINTS = [
	"what can you do",
	"what can nous do",
	"show commands",
	"available commands",
	"available features",
	"help me discover",
	"what commands",
	"commands are available",
	"你能做什么",
	"你现在能做什么",
	"有什么功能",
	"有哪些功能",
	"有哪些命令",
	"看看命令",
	"显示命令",
	"命令列表",
];

const STATUS_HIGH_HINTS = [
	"daemon status",
	"nous status",
	"show daemon status",
	"show running tasks",
	"show active intents",
	"running tasks",
	"active intents",
	"查看 daemon 状态",
	"查看运行状态",
	"当前有哪些任务",
	"当前有哪些 intent",
];

const STATUS_MEDIUM_HINTS = [
	"show status",
	"status",
	"状态",
	"看一下状态",
	"看看状态",
];

const ATTACH_VERBS = [
	"attach",
	"switch to",
	"switch thread",
	"open thread",
	"connect to",
	"join thread",
	"切到",
	"连接到",
	"附加到",
	"打开 thread",
	"切换到 thread",
];

const DETACH_HINTS = [
	"detach",
	"leave current thread",
	"return to global mode",
	"return to inbox",
	"退出当前线程",
	"回到全局",
];

const EXIT_HINTS = [
	"exit",
	"quit",
	"exit repl",
	"quit repl",
	"close repl",
	"退出 repl",
	"离开 repl",
];

export function resolveReplControlInput(
	input: string,
	context: ReplControlContext,
): ReplControlResolution {
	if (input.startsWith("/")) {
		return resolveSlashControl(input, context);
	}

	const naturalLanguage = resolveNaturalLanguageControl(input, context);
	if (naturalLanguage) {
		return naturalLanguage;
	}

	return {
		kind: "submit",
		text: input,
	};
}

function resolveSlashControl(
	input: string,
	context: ReplControlContext,
): ReplControlResolution {
	const raw = input.slice(1).trim();
	if (!raw) {
		return {
			kind: "clarify",
			message: "Use /commands to inspect the REPL control surface.",
			source: "slash",
			confidence: "medium",
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
				operationId: "control.discover",
				source: "slash",
				confidence: "explicit",
				query: query || undefined,
				interpretedAs: query ? `/commands ${query}` : "/commands",
			};
		case "status":
			return {
				kind: "execute",
				action: "show_status",
				operationId: "status.overview",
				source: "slash",
				confidence: "explicit",
				interpretedAs: "/status",
			};
		case "attach":
			if (!query) {
				return {
					kind: "clarify",
					message:
						"Provide a thread ID like /attach thread_abc123, or use /detach to leave the current thread.",
					operationId: "thread.attach",
					source: "slash",
					confidence: "medium",
				};
			}
			return {
				kind: "execute",
				action: "attach_thread",
				operationId: "thread.attach",
				source: "slash",
				confidence: "explicit",
				threadId: query,
				interpretedAs: `/attach ${query}`,
			};
		case "detach":
			return {
				kind: "execute",
				action: "detach_thread",
				operationId: "thread.detach",
				source: "slash",
				confidence: "explicit",
				interpretedAs: "/detach",
			};
		case "exit":
		case "quit":
			return {
				kind: "execute",
				action: "exit_repl",
				operationId: "session.exit",
				source: "slash",
				confidence: "explicit",
				interpretedAs: "/exit",
			};
		default:
			return {
				kind: "clarify",
				message: `Unknown command: /${command}. Use /commands to inspect the available control operations.`,
				source: "slash",
				confidence: "medium",
			};
	}
}

function resolveNaturalLanguageControl(
	input: string,
	context: ReplControlContext,
): ReplControlResolution | undefined {
	const normalized = normalizeInput(input);
	const threadId = extractThreadId(input);

	if (matchesAny(normalized, DISCOVERY_HINTS)) {
		const query = extractDiscoveryQuery(input);
		return {
			kind: "execute",
			action: "show_commands",
			operationId: "control.discover",
			source: "natural_language",
			confidence: "high",
			query,
			interpretedAs: query ? `/commands ${query}` : "/commands",
		};
	}

	if (matchesAny(normalized, STATUS_HIGH_HINTS)) {
		return {
			kind: "execute",
			action: "show_status",
			operationId: "status.overview",
			source: "natural_language",
			confidence: "high",
			interpretedAs: "/status",
		};
	}

	if (matchesAny(normalized, STATUS_MEDIUM_HINTS)) {
		return {
			kind: "clarify",
			message:
				'I can interpret that as REPL control and show daemon status with /status, or I can send it to the current thread as a normal message. Which did you mean?',
			operationId: "status.overview",
			source: "natural_language",
			confidence: "medium",
		};
	}

	if (threadId && matchesAny(normalized, ATTACH_VERBS)) {
		return {
			kind: "execute",
			action: "attach_thread",
			operationId: "thread.attach",
			source: "natural_language",
			confidence: "high",
			threadId,
			interpretedAs: `/attach ${threadId}`,
		};
	}

	if (!threadId && matchesAny(normalized, ATTACH_VERBS)) {
		return {
			kind: "clarify",
			message:
				"I can attach to another thread if you provide a thread ID like thread_abc123.",
			operationId: "thread.attach",
			source: "natural_language",
			confidence: "medium",
		};
	}

	if (matchesAny(normalized, DETACH_HINTS)) {
		return {
			kind: "execute",
			action: "detach_thread",
			operationId: "thread.detach",
			source: "natural_language",
			confidence: "high",
			interpretedAs: "/detach",
		};
	}

	if (matchesAny(normalized, EXIT_HINTS)) {
		return {
			kind: "execute",
			action: "exit_repl",
			operationId: "session.exit",
			source: "natural_language",
			confidence: "high",
			interpretedAs: "/exit",
		};
	}

	if (context.currentThreadId && normalized === "detach") {
		return {
			kind: "execute",
			action: "detach_thread",
			operationId: "thread.detach",
			source: "natural_language",
			confidence: "high",
			interpretedAs: "/detach",
		};
	}

	return undefined;
}

function normalizeInput(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesAny(value: string, patterns: string[]): boolean {
	return patterns.some((pattern) => value.includes(pattern));
}

function extractThreadId(value: string): string | undefined {
	return value.match(/\bthread_[A-Za-z0-9]+\b/)?.[0];
}

function extractDiscoveryQuery(value: string): string | undefined {
	let query = value.trim();
	const wrappers = [
		/\bwhat can you do here\b/gi,
		/\bwhat can you do\b/gi,
		/\bwhat commands are available\b/gi,
		/\bshow commands\b/gi,
		/\bavailable commands\b/gi,
		/\bavailable features\b/gi,
		/\bhelp\b/gi,
		/\bcommands\b/gi,
		/\bfeatures\b/gi,
		/\bcan you show\b/gi,
		/你现在能做什么/gu,
		/你能做什么/gu,
		/有哪些命令/gu,
		/有什么功能/gu,
		/有哪些功能/gu,
		/命令列表/gu,
		/显示命令/gu,
		/看看命令/gu,
	];
	for (const pattern of wrappers) {
		query = query.replace(pattern, " ");
	}
	query = query
		.replace(/[?？]/g, " ")
		.replace(/\bhere\b/gi, " ")
		.replace(/\bavailable\b/gi, " ")
		.replace(/\bplease\b/gi, " ")
		.replace(/这里/gu, " ")
		.replace(/现在/gu, " ")
		.replace(/一下/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
	return query.length > 0 ? query : undefined;
}
