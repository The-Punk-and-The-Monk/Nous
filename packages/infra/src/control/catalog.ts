import type {
	ControlSurfaceCategory,
	ControlSurfaceContext,
	ControlSurfaceEntry,
	ControlSurfaceKind,
} from "@nous/core";

const CATEGORY_ORDER: ControlSurfaceCategory[] = [
	"core",
	"discovery",
	"session",
	"thread",
	"daemon",
	"inspect",
	"permissions",
	"network",
];

const CONTROL_SURFACE_CATALOG: ControlSurfaceEntry[] = [
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
			{ surface: "ide", usage: "Command Palette → Search Nous operations" },
			{ surface: "web", usage: "Search control operations" },
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
		channels: ["cli", "ide", "web"],
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
			{ surface: "ide", usage: "Show Nous status" },
			{ surface: "web", usage: "Open status dashboard" },
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
		channels: ["cli", "ide", "web"],
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
			{ surface: "ide", usage: "Attach to thread <threadId>" },
			{ surface: "web", usage: "Open thread <threadId>" },
		],
		tags: [
			"attach",
			"thread",
			"switch to thread",
			"open thread",
			"connect to thread",
			"join thread",
			"切到 thread",
		],
		channels: ["cli", "ide", "web"],
		requiresDaemon: true,
		sideEffectClass: "read_only",
	},
	{
		id: "thread.detach",
		title: "Leave the current thread",
		summary:
			"Return the current client surface to global mode so the next message can target a different thread.",
		category: "thread",
		syntaxes: [
			{ surface: "repl", usage: "/detach" },
			{ surface: "ide", usage: "Detach from current thread" },
			{ surface: "web", usage: "Back to inbox/global view" },
		],
		tags: [
			"detach",
			"leave thread",
			"global mode",
			"return to inbox",
			"退出当前线程",
		],
		channels: ["cli", "ide", "web"],
		requiresThread: true,
		sideEffectClass: "read_only",
	},
	{
		id: "daemon.start",
		title: "Start the daemon",
		summary: "Launch the background Nous daemon process.",
		category: "daemon",
		syntaxes: [
			{ surface: "cli", usage: "nous daemon start" },
			{ surface: "ide", usage: "Start daemon" },
			{ surface: "web", usage: "Start daemon" },
		],
		tags: ["daemon", "start", "boot", "launch", "后台启动"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "daemon.stop",
		title: "Stop the daemon",
		summary: "Gracefully stop the background Nous daemon process.",
		category: "daemon",
		syntaxes: [
			{ surface: "cli", usage: "nous daemon stop" },
			{ surface: "ide", usage: "Stop daemon" },
			{ surface: "web", usage: "Stop daemon" },
		],
		tags: ["daemon", "stop", "shutdown", "kill", "关闭后台"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "daemon.status",
		title: "Show daemon transport status",
		summary: "Inspect whether the daemon is running and how clients connect to it.",
		category: "daemon",
		syntaxes: [
			{ surface: "cli", usage: "nous daemon status" },
			{ surface: "repl", usage: "/daemon status" },
			{ surface: "ide", usage: "Show daemon transport status" },
			{ surface: "web", usage: "Show daemon transport status" },
		],
		tags: ["daemon", "status", "socket", "transport", "pid"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "debug.daemon",
		title: "Debug daemon state",
		summary:
			"Inspect recent threads, task queues, pending decisions, and runtime health.",
		category: "inspect",
		syntaxes: [
			{ surface: "cli", usage: "nous debug daemon" },
			{ surface: "repl", usage: "/debug daemon" },
			{ surface: "ide", usage: "Debug daemon state" },
			{ surface: "web", usage: "Open daemon debug view" },
		],
		tags: ["debug", "daemon", "inspect", "tasks", "decisions", "outbox"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "debug.thread",
		title: "Debug a thread",
		summary:
			"Inspect recent turns, trust receipts, process-surface items, and linked intent state for a thread.",
		category: "inspect",
		syntaxes: [
			{ surface: "cli", usage: "nous debug thread <threadId>" },
			{ surface: "repl", usage: "/debug thread [threadId]" },
			{ surface: "ide", usage: "Debug thread <threadId>" },
			{ surface: "web", usage: "Open thread debug view" },
		],
		tags: ["debug", "thread", "inspect", "trust receipt", "turn surface"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "events.list",
		title: "Inspect recent events",
		summary: "View recent persisted events for runtime debugging and audit trails.",
		category: "inspect",
		syntaxes: [
			{ surface: "cli", usage: "nous events [N]" },
			{ surface: "repl", usage: "/events [N]" },
			{ surface: "ide", usage: "Show recent events" },
			{ surface: "web", usage: "Open event timeline" },
		],
		tags: ["events", "log", "audit", "recent events", "timeline"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "memory.browse",
		title: "Inspect stored memory",
		summary: "Browse or search persisted memories across tiers.",
		category: "inspect",
		syntaxes: [
			{ surface: "cli", usage: "nous memory [search]" },
			{ surface: "repl", usage: "/memory [search]" },
			{ surface: "ide", usage: "Inspect memory" },
			{ surface: "web", usage: "Browse memory" },
		],
		tags: ["memory", "search memory", "episodic", "semantic", "prospective"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "permissions.show",
		title: "Show permission policy",
		summary: "Inspect the current permission rules and grant-all flag.",
		category: "permissions",
		syntaxes: [
			{ surface: "cli", usage: "nous permissions" },
			{ surface: "repl", usage: "/permissions" },
			{ surface: "ide", usage: "Inspect permissions" },
			{ surface: "web", usage: "Inspect permissions" },
		],
		tags: ["permissions", "policy", "show", "rules"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "permissions.grant_all",
		title: "Enable grant-all mode",
		summary:
			"Enable the power-user override that bypasses normal permission prompts.",
		category: "permissions",
		syntaxes: [
			{ surface: "cli", usage: "nous permissions grant-all" },
			{ surface: "ide", usage: "Enable grant-all permissions" },
			{ surface: "web", usage: "Enable grant-all permissions" },
		],
		tags: ["permissions", "grant all", "allow everything", "power user"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "permissions.reset",
		title: "Reset permission policy",
		summary: "Reset the permission policy back to the repository defaults.",
		category: "permissions",
		syntaxes: [
			{ surface: "cli", usage: "nous permissions reset" },
			{ surface: "ide", usage: "Reset permission policy" },
			{ surface: "web", usage: "Reset permission policy" },
		],
		tags: ["permissions", "reset", "defaults"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "permissions.allow_action",
		title: "Allow a permission action",
		summary: "Set matching permission rules to auto-allow for an action.",
		category: "permissions",
		syntaxes: [
			{ surface: "cli", usage: "nous permissions allow <action>" },
			{ surface: "ide", usage: "Allow permission action <action>" },
			{ surface: "web", usage: "Allow permission action <action>" },
		],
		tags: ["permissions", "allow", "auto allow", "fs.read", "shell.exec"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "permissions.revoke_action",
		title: "Revoke a permission action",
		summary: "Set matching permission rules to deny for an action.",
		category: "permissions",
		syntaxes: [
			{ surface: "cli", usage: "nous permissions revoke <action>" },
			{ surface: "ide", usage: "Revoke permission action <action>" },
			{ surface: "web", usage: "Revoke permission action <action>" },
		],
		tags: ["permissions", "revoke", "deny", "fs.write", "network.http"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.status",
		title: "Show network status",
		summary:
			"Inspect Inter-Nous seed-exchange status, counters, and local identity.",
		category: "network",
		syntaxes: [
			{ surface: "cli", usage: "nous network status" },
			{ surface: "repl", usage: "/network status" },
			{ surface: "ide", usage: "Show network status" },
			{ surface: "web", usage: "Show network status" },
		],
		tags: ["network", "status", "inter-nous", "exchange", "seed"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "network.enable",
		title: "Enable Inter-Nous exchange",
		summary: "Enable local Inter-Nous seed exchange.",
		category: "network",
		syntaxes: [
			{ surface: "cli", usage: "nous network enable" },
			{ surface: "ide", usage: "Enable Inter-Nous exchange" },
			{ surface: "web", usage: "Enable Inter-Nous exchange" },
		],
		tags: ["network", "enable", "inter-nous", "sharing on"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.pause",
		title: "Pause Inter-Nous exchange",
		summary: "Pause local Inter-Nous seed exchange without deleting stored data.",
		category: "network",
		syntaxes: [
			{ surface: "cli", usage: "nous network pause" },
			{ surface: "ide", usage: "Pause Inter-Nous exchange" },
			{ surface: "web", usage: "Pause Inter-Nous exchange" },
		],
		tags: ["network", "pause", "disable", "inter-nous", "sharing off"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.policy",
		title: "Show network policy",
		summary: "Inspect the structured Inter-Nous communication policy.",
		category: "network",
		syntaxes: [
			{ surface: "cli", usage: "nous network policy" },
			{ surface: "repl", usage: "/network policy" },
			{ surface: "ide", usage: "Inspect network policy" },
			{ surface: "web", usage: "Inspect network policy" },
		],
		tags: ["network", "policy", "sharing", "communication"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "network.procedures",
		title: "List exportable procedures",
		summary: "List validated local procedures that can be exported.",
		category: "network",
		syntaxes: [
			{ surface: "cli", usage: "nous network procedures" },
			{ surface: "ide", usage: "List exportable procedures" },
			{ surface: "web", usage: "List exportable procedures" },
		],
		tags: ["network", "procedures", "export", "validated"],
		channels: ["cli", "ide", "web"],
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
			{
				surface: "ide",
				usage: "Export procedure summary <fingerprint>",
			},
			{
				surface: "web",
				usage: "Export procedure summary <fingerprint>",
			},
		],
		tags: ["network", "export", "bundle", "fingerprint", "procedure"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.import",
		title: "Import a procedure bundle",
		summary: "Import a portable procedure-summary bundle into local storage.",
		category: "network",
		syntaxes: [
			{ surface: "cli", usage: "nous network import <bundlePath>" },
			{ surface: "ide", usage: "Import procedure bundle <bundlePath>" },
			{ surface: "web", usage: "Import procedure bundle <bundlePath>" },
		],
		tags: ["network", "import", "bundle", "procedure"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
	{
		id: "network.log",
		title: "Inspect network exchange log",
		summary: "View recent Inter-Nous communication events.",
		category: "network",
		syntaxes: [
			{ surface: "cli", usage: "nous network log [N]" },
			{ surface: "repl", usage: "/network log [N]" },
			{ surface: "ide", usage: "Inspect network exchange log" },
			{ surface: "web", usage: "Inspect network exchange log" },
		],
		tags: ["network", "log", "events", "communication"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "read_only",
	},
	{
		id: "agents.list",
		title: "List registered agents",
		summary:
			"List built-in registered agents in foreground mode. Daemon-backed listing is not wired yet.",
		category: "inspect",
		syntaxes: [
			{ surface: "cli", usage: "nous agents" },
			{ surface: "ide", usage: "List registered agents" },
			{ surface: "web", usage: "List registered agents" },
		],
		tags: ["agents", "router", "list agents"],
		channels: ["cli", "ide", "web"],
		foregroundOnly: true,
		sideEffectClass: "read_only",
	},
	{
		id: "session.exit",
		title: "Exit the current client session",
		summary: "Detach the current client session and close the interactive surface.",
		category: "session",
		syntaxes: [
			{ surface: "repl", usage: "/exit" },
			{ surface: "repl", usage: "/quit" },
			{ surface: "ide", usage: "Close Nous session" },
			{ surface: "web", usage: "Close session" },
		],
		tags: ["exit", "quit", "leave repl", "close repl"],
		channels: ["cli", "ide", "web"],
		sideEffectClass: "state_change",
	},
];

export function getControlSurfaceCatalog(): readonly ControlSurfaceEntry[] {
	return CONTROL_SURFACE_CATALOG;
}

export function getControlSurfaceEntry(
	id: string,
): ControlSurfaceEntry | undefined {
	return CONTROL_SURFACE_CATALOG.find((entry) => entry.id === id);
}

export function listControlSurfaceEntries(
	context: ControlSurfaceContext & { includeUnavailable?: boolean },
): ControlSurfaceEntry[] {
	return CONTROL_SURFACE_CATALOG.filter((entry) => {
		if (!entry.channels?.includes(context.channelType)) {
			return false;
		}
		if (!entry.syntaxes.some((syntax) => syntax.surface === context.surface)) {
			return false;
		}
		return (
			context.includeUnavailable || controlSurfaceAvailabilityNote(entry, context) === undefined
		);
	}).sort(compareEntries);
}

export function searchControlSurfaceEntries(
	query: string,
	context: ControlSurfaceContext & { includeUnavailable?: boolean },
): ControlSurfaceEntry[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return listControlSurfaceEntries(context);
	}
	const tokens = tokenize(normalizedQuery);
	return CONTROL_SURFACE_CATALOG.map((entry) => ({
		entry,
		score: scoreControlSurfaceEntry(entry, tokens, normalizedQuery, context),
	}))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score || compareEntries(a.entry, b.entry))
		.map(({ entry }) => entry);
}

export function controlSurfaceAvailabilityNote(
	entry: ControlSurfaceEntry,
	context: ControlSurfaceContext,
): string | undefined {
	if (!entry.channels?.includes(context.channelType)) {
		return `not available on ${context.channelType}`;
	}
	if (!entry.syntaxes.some((syntax) => syntax.surface === context.surface)) {
		return `not available on ${context.surface}`;
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

export function primaryControlSurfaceSyntax(
	entry: ControlSurfaceEntry,
	surface: ControlSurfaceKind,
): string {
	return (
		entry.syntaxes.find((syntax) => syntax.surface === surface)?.usage ??
		entry.syntaxes[0]?.usage ??
		entry.id
	);
}

export function controlSurfaceCategoryLabel(
	category: ControlSurfaceCategory,
): string {
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

function compareEntries(
	left: ControlSurfaceEntry,
	right: ControlSurfaceEntry,
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

function scoreControlSurfaceEntry(
	entry: ControlSurfaceEntry,
	tokens: string[],
	normalizedQuery: string,
	context: ControlSurfaceContext & { includeUnavailable?: boolean },
): number {
	let score = 0;
	const availabilityPenalty =
		controlSurfaceAvailabilityNote(entry, context) === undefined ? 0 : -4;
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
