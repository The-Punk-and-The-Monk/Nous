export type OperationSurface = "cli" | "repl";

export type OperationCategory =
	| "core"
	| "daemon"
	| "thread"
	| "inspect"
	| "permissions"
	| "network"
	| "discovery"
	| "session";

export interface OperationSyntax {
	surface: OperationSurface;
	usage: string;
}

export interface OperationCatalogEntry {
	id: string;
	title: string;
	summary: string;
	category: OperationCategory;
	syntaxes: OperationSyntax[];
	examples?: string[];
	tags?: string[];
	requiresDaemon?: boolean;
	requiresThread?: boolean;
	foregroundOnly?: boolean;
	sideEffectClass?: "read_only" | "state_change";
}

export interface OperationAvailabilityContext {
	surface: OperationSurface;
	daemonRunning: boolean;
	currentThreadId?: string;
	includeUnavailable?: boolean;
}

const CATEGORY_ORDER: OperationCategory[] = [
	"core",
	"discovery",
	"session",
	"thread",
	"daemon",
	"inspect",
	"permissions",
	"network",
];

const OPERATION_CATALOG: OperationCatalogEntry[] = [
	{
		id: "control.discover",
		title: "Discover commands and capabilities",
		summary:
			"List available control operations and search them by topic.",
		category: "discovery",
		syntaxes: [
			{ surface: "cli", usage: "nous help [query]" },
			{ surface: "cli", usage: "nous commands [query]" },
			{ surface: "repl", usage: "/commands [query]" },
			{ surface: "repl", usage: "/help [query]" },
		],
		examples: [
			"nous help network",
			"/commands thread",
			"what can you do here?",
		],
		tags: [
			"help",
			"commands",
			"discover",
			"discovery",
			"capabilities",
			"feature",
			"menu",
			"search",
			"what can you do",
			"你能做什么",
			"有什么功能",
			"有哪些命令",
		],
		sideEffectClass: "read_only",
	},
	{
		id: "status.overview",
		title: "Show status",
		summary:
			"Inspect active intents, tasks, and daemon activity from the current environment.",
		category: "core",
		syntaxes: [
			{ surface: "cli", usage: "nous status" },
			{ surface: "repl", usage: "/status" },
		],
		tags: [
			"status",
			"activity",
			"running",
			"tasks",
			"intents",
			"daemon status",
			"运行状态",
		],
		sideEffectClass: "read_only",
	},
	{
		id: "thread.attach",
		title: "Attach to a thread",
		summary:
			"Open a persisted dialogue thread and follow its live process/answer lanes.",
		category: "thread",
		syntaxes: [
			{ surface: "cli", usage: "nous attach <threadId> [--once]" },
			{ surface: "repl", usage: "/attach <threadId>" },
		],
		tags: [
			"attach",
			"thread",
			"switch thread",
			"open thread",
			"connect thread",
			"切到线程",
		],
		requiresDaemon: true,
		sideEffectClass: "read_only",
	},
	{
		id: "thread.detach",
		title: "Leave the current thread",
		summary:
			"Return the REPL to global mode so the next message starts or discovers a different thread.",
		category: "thread",
		syntaxes: [{ surface: "repl", usage: "/detach" }],
		tags: [
			"detach",
			"leave thread",
			"global mode",
			"return to inbox",
			"退出当前线程",
		],
		requiresThread: true,
		sideEffectClass: "read_only",
	},
	{
		id: "daemon.start",
		title: "Start the daemon",
		summary: "Launch the background Nous daemon process.",
		category: "daemon",
		syntaxes: [{ surface: "cli", usage: "nous daemon start" }],
		tags: ["daemon", "start", "boot", "launch", "后台启动"],
		sideEffectClass: "state_change",
	},
	{
		id: "daemon.stop",
		title: "Stop the daemon",
		summary: "Gracefully stop the background Nous daemon process.",
		category: "daemon",
		syntaxes: [{ surface: "cli", usage: "nous daemon stop" }],
		tags: ["daemon", "stop", "shutdown", "kill", "关闭后台"],
		sideEffectClass: "state_change",
	},
	{
		id: "daemon.status",
		title: "Show daemon transport status",
		summary: "Inspect whether the daemon is running and how clients connect to it.",
		category: "daemon",
		syntaxes: [{ surface: "cli", usage: "nous daemon status" }],
		tags: ["daemon", "status", "socket", "transport", "pid"],
		sideEffectClass: "read_only",
	},
	{
		id: "debug.daemon",
		title: "Debug daemon state",
		summary:
			"Inspect recent threads, task queues, pending decisions, and runtime health.",
		category: "inspect",
		syntaxes: [{ surface: "cli", usage: "nous debug daemon" }],
		tags: ["debug", "daemon", "inspect", "tasks", "decisions", "outbox"],
		sideEffectClass: "read_only",
	},
	{
		id: "debug.thread",
		title: "Debug a thread",
		summary:
			"Inspect recent turns, trust receipts, process-surface items, and linked intent state for a thread.",
		category: "inspect",
		syntaxes: [{ surface: "cli", usage: "nous debug thread <threadId>" }],
		tags: ["debug", "thread", "inspect", "trust receipt", "turn surface"],
		sideEffectClass: "read_only",
	},
	{
		id: "events.list",
		title: "Inspect recent events",
		summary: "View recent persisted events for runtime debugging and audit trails.",
		category: "inspect",
		syntaxes: [{ surface: "cli", usage: "nous events [N]" }],
		tags: ["events", "log", "audit", "recent events", "timeline"],
		sideEffectClass: "read_only",
	},
	{
		id: "memory.browse",
		title: "Inspect stored memory",
		summary: "Browse or search persisted memories across tiers.",
		category: "inspect",
		syntaxes: [{ surface: "cli", usage: "nous memory [search]" }],
		tags: ["memory", "search memory", "episodic", "semantic", "prospective"],
		sideEffectClass: "read_only",
	},
	{
		id: "permissions.show",
		title: "Show permission policy",
		summary: "Inspect the current permission rules and grant-all flag.",
		category: "permissions",
		syntaxes: [{ surface: "cli", usage: "nous permissions" }],
		tags: ["permissions", "policy", "show", "rules"],
		sideEffectClass: "read_only",
	},
	{
		id: "permissions.grant_all",
		title: "Enable grant-all mode",
		summary:
			"Enable the power-user override that bypasses normal permission prompts.",
		category: "permissions",
		syntaxes: [{ surface: "cli", usage: "nous permissions grant-all" }],
		tags: ["permissions", "grant all", "allow everything", "power user"],
		sideEffectClass: "state_change",
	},
	{
		id: "permissions.reset",
		title: "Reset permission policy",
		summary: "Reset the permission policy back to the repository defaults.",
		category: "permissions",
		syntaxes: [{ surface: "cli", usage: "nous permissions reset" }],
		tags: ["permissions", "reset", "defaults"],
		sideEffectClass: "state_change",
	},
	{
		id: "permissions.allow_action",
		title: "Allow a permission action",
		summary: "Set matching permission rules to auto-allow for an action.",
		category: "permissions",
		syntaxes: [{ surface: "cli", usage: "nous permissions allow <action>" }],
		tags: ["permissions", "allow", "auto allow", "fs.read", "shell.exec"],
		sideEffectClass: "state_change",
	},
	{
		id: "permissions.revoke_action",
		title: "Revoke a permission action",
		summary: "Set matching permission rules to deny for an action.",
		category: "permissions",
		syntaxes: [{ surface: "cli", usage: "nous permissions revoke <action>" }],
		tags: ["permissions", "revoke", "deny", "fs.write", "network.http"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.status",
		title: "Show network status",
		summary:
			"Inspect Inter-Nous seed-exchange status, counters, and local identity.",
		category: "network",
		syntaxes: [{ surface: "cli", usage: "nous network status" }],
		tags: ["network", "status", "inter-nous", "exchange", "seed"],
		sideEffectClass: "read_only",
	},
	{
		id: "network.enable",
		title: "Enable Inter-Nous exchange",
		summary: "Enable local Inter-Nous seed exchange.",
		category: "network",
		syntaxes: [{ surface: "cli", usage: "nous network enable" }],
		tags: ["network", "enable", "inter-nous", "sharing on"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.pause",
		title: "Pause Inter-Nous exchange",
		summary: "Pause local Inter-Nous seed exchange without deleting stored data.",
		category: "network",
		syntaxes: [{ surface: "cli", usage: "nous network pause" }],
		tags: ["network", "pause", "disable", "inter-nous", "sharing off"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.policy",
		title: "Show network policy",
		summary: "Inspect the structured Inter-Nous communication policy.",
		category: "network",
		syntaxes: [{ surface: "cli", usage: "nous network policy" }],
		tags: ["network", "policy", "sharing", "communication"],
		sideEffectClass: "read_only",
	},
	{
		id: "network.procedures",
		title: "List exportable procedures",
		summary: "List validated local procedures that can be exported.",
		category: "network",
		syntaxes: [{ surface: "cli", usage: "nous network procedures" }],
		tags: ["network", "procedures", "export", "validated"],
		sideEffectClass: "read_only",
	},
	{
		id: "network.export",
		title: "Export a procedure bundle",
		summary:
			"Export a validated procedure summary by fingerprint into a portable bundle.",
		category: "network",
		syntaxes: [
			{
				surface: "cli",
				usage: "nous network export <fingerprint> [--out <path>]",
			},
		],
		tags: ["network", "export", "bundle", "fingerprint", "procedure"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.import",
		title: "Import a procedure bundle",
		summary: "Import a portable procedure-summary bundle into local storage.",
		category: "network",
		syntaxes: [{ surface: "cli", usage: "nous network import <bundlePath>" }],
		tags: ["network", "import", "bundle", "procedure"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.log",
		title: "Inspect network exchange log",
		summary: "View recent Inter-Nous communication events.",
		category: "network",
		syntaxes: [{ surface: "cli", usage: "nous network log [N]" }],
		tags: ["network", "log", "events", "communication"],
		sideEffectClass: "read_only",
	},
	{
		id: "agents.list",
		title: "List registered agents",
		summary:
			"List built-in registered agents in foreground mode. Daemon-backed listing is not wired yet.",
		category: "inspect",
		syntaxes: [{ surface: "cli", usage: "nous agents" }],
		tags: ["agents", "router", "list agents"],
		foregroundOnly: true,
		sideEffectClass: "read_only",
	},
	{
		id: "session.exit",
		title: "Exit the REPL",
		summary: "Detach the current client session and quit the REPL.",
		category: "session",
		syntaxes: [
			{ surface: "repl", usage: "/exit" },
			{ surface: "repl", usage: "/quit" },
		],
		tags: ["exit", "quit", "leave repl", "close repl"],
		sideEffectClass: "state_change",
	},
];

export function getOperationCatalog(): readonly OperationCatalogEntry[] {
	return OPERATION_CATALOG;
}

export function getOperationCatalogEntry(
	id: string,
): OperationCatalogEntry | undefined {
	return OPERATION_CATALOG.find((entry) => entry.id === id);
}

export function listCatalogOperations(
	context: OperationAvailabilityContext,
): OperationCatalogEntry[] {
	return OPERATION_CATALOG.filter((entry) => {
		if (!entry.syntaxes.some((syntax) => syntax.surface === context.surface)) {
			return false;
		}
		return context.includeUnavailable || isOperationAvailable(entry, context);
	}).sort(compareOperationEntries);
}

export function searchCatalogOperations(
	query: string,
	context: OperationAvailabilityContext,
): OperationCatalogEntry[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return listCatalogOperations(context);
	}
	const tokens = tokenize(normalizedQuery);
	return OPERATION_CATALOG.map((entry) => ({
		entry,
		score: scoreOperationEntry(entry, tokens, normalizedQuery, context),
	}))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score || compareOperationEntries(a.entry, b.entry))
		.map(({ entry }) => entry);
}

export function operationAvailabilityNote(
	entry: OperationCatalogEntry,
	context: OperationAvailabilityContext,
): string | undefined {
	if (!entry.syntaxes.some((syntax) => syntax.surface === context.surface)) {
		return context.surface === "repl"
			? "not available in the REPL"
			: "not available as a top-level CLI command";
	}
	if (entry.requiresDaemon && !context.daemonRunning) {
		return "requires a running daemon";
	}
	if (entry.requiresThread && !context.currentThreadId) {
		return "requires an attached thread";
	}
	if (entry.foregroundOnly && context.daemonRunning) {
		return "foreground-only; not wired through the daemon yet";
	}
	return undefined;
}

export function primarySyntaxForSurface(
	entry: OperationCatalogEntry,
	surface: OperationSurface,
): string {
	return (
		entry.syntaxes.find((syntax) => syntax.surface === surface)?.usage ??
		entry.syntaxes[0]?.usage ??
		entry.id
	);
}

export function categoryLabel(category: OperationCategory): string {
	switch (category) {
		case "core":
			return "Core";
		case "daemon":
			return "Daemon";
		case "thread":
			return "Threads";
		case "inspect":
			return "Inspect";
		case "permissions":
			return "Permissions";
		case "network":
			return "Network";
		case "discovery":
			return "Discovery";
		case "session":
			return "Session";
	}
}

function isOperationAvailable(
	entry: OperationCatalogEntry,
	context: OperationAvailabilityContext,
): boolean {
	return operationAvailabilityNote(entry, context) === undefined;
}

function compareOperationEntries(
	left: OperationCatalogEntry,
	right: OperationCatalogEntry,
): number {
	return (
		CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category) ||
		left.title.localeCompare(right.title)
	);
}

function tokenize(value: string): string[] {
	return value
		.split(/[\s/_.:-]+/)
		.map((token) => token.trim())
		.filter(Boolean);
}

function scoreOperationEntry(
	entry: OperationCatalogEntry,
	tokens: string[],
	normalizedQuery: string,
	context: OperationAvailabilityContext,
): number {
	let score = 0;
	const availabilityPenalty = isOperationAvailable(entry, context) ? 0 : -4;
	const haystacks = {
		id: entry.id.toLowerCase(),
		title: entry.title.toLowerCase(),
		summary: entry.summary.toLowerCase(),
		category: entry.category.toLowerCase(),
		tags: (entry.tags ?? []).join(" ").toLowerCase(),
		syntax: entry.syntaxes.map((syntax) => syntax.usage.toLowerCase()).join(" "),
	};

	for (const token of tokens) {
		if (haystacks.id.includes(token)) score += 8;
		if (haystacks.title.includes(token)) score += 7;
		if (haystacks.syntax.includes(token)) score += 6;
		if (haystacks.tags.includes(token)) score += 5;
		if (haystacks.summary.includes(token)) score += 4;
		if (haystacks.category.includes(token)) score += 3;
	}

	if (haystacks.title.includes(normalizedQuery)) score += 10;
	if (haystacks.syntax.includes(normalizedQuery)) score += 9;
	if (haystacks.tags.includes(normalizedQuery)) score += 8;
	if (haystacks.summary.includes(normalizedQuery)) score += 6;

	return score + availabilityPenalty;
}
