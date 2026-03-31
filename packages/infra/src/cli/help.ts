import {
	controlSurfaceAvailabilityNote,
	controlSurfaceCategoryLabel,
	listControlSurfaceEntries,
	primaryControlSurfaceSyntax,
	searchControlSurfaceEntries,
} from "../control/catalog.ts";
import type { ControlSurfaceContext, ControlSurfaceEntry } from "@nous/core";
import { colors } from "./ui/colors.ts";

export function printCliHelp(options?: {
	query?: string;
	daemonRunning?: boolean;
}): void {
	for (const line of formatCliHelpLines(options)) {
		console.log(line);
	}
}

export function formatCliHelpLines(options?: {
	query?: string;
	daemonRunning?: boolean;
}): string[] {
	const context: ControlSurfaceContext & { includeUnavailable?: boolean } = {
		surface: "cli",
		channelType: "cli",
		daemonRunning: options?.daemonRunning ?? false,
		includeUnavailable: true,
	};
	const query = options?.query?.trim();
	const entries = query
		? searchControlSurfaceEntries(query, context)
		: listControlSurfaceEntries(context);
	const lines = [
		`  ${colors.bold("νοῦς — Autonomous Agent Framework")}`,
		"",
		`  ${colors.bold("Task Plane:")}`,
		`    ${padUsage("nous", 26)}Open daemon REPL (when daemon is running)`,
		`    ${padUsage("nous <intent>", 26)}Execute or submit a natural-language intent`,
		"",
		`  ${colors.bold(query ? `Control Operations Matching "${query}"` : "Control Operations:")}`,
	];
	if (entries.length === 0) {
		lines.push(`    ${colors.dim("No matching control operations.")}`);
		lines.push("");
	} else {
		pushGroupedOperationLines(lines, entries, context, {
			indent: "    ",
			showAvailabilityNotes: query ? true : false,
		});
		lines.push("");
	}
	lines.push(`  ${colors.bold("Discovery Tips:")}`);
	lines.push(
		`    ${colors.dim("nous help network")} search command topics by keyword`,
	);
	lines.push(
		`    ${colors.dim("nous")} open the REPL, then use ${colors.dim("/commands")} or ask ${colors.dim("\"what can you do here?\"")}`,
	);
	lines.push("");
	lines.push(`  ${colors.bold("Options:")}`);
	lines.push(
		`    ${padUsage("--log-level <level>", 26)}Set log level: debug, info, warn, error, silent`,
	);
	lines.push(
		`    ${padUsage("--yes, -y", 26)}Auto-approve all permission prompts`,
	);
	lines.push(
		`    ${padUsage("--dangerously-skip-permissions", 26)}Alias for --yes`,
	);
	lines.push("");
	lines.push(`  ${colors.bold("Environment:")}`);
	lines.push(
		`    ${colors.dim("Recommended default: direct OpenAI via OPENAI_API_KEY (or ~/.nous/secrets/providers.json).")}`,
	);
	lines.push("");
	lines.push(`    ${padUsage("ANTHROPIC_API_KEY", 26)}Direct Anthropic API key`);
	lines.push(
		`    ${padUsage("ANTHROPIC_AUTH_TOKEN", 26)}OAuth token from Claude Pro/Max subscription`,
	);
	lines.push(
		`    ${padUsage("ANTHROPIC_BASE_URL", 26)}Custom Anthropic API endpoint`,
	);
	lines.push(`    ${padUsage("OPENAI_API_KEY", 26)}Direct OpenAI API key`);
	lines.push(
		`    ${padUsage("OPENAI_MODEL", 26)}OpenAI / OpenAI-compatible model name`,
	);
	lines.push(
		`    ${padUsage("OPENAI_API_BASE_URL", 26)}Custom base URL for direct OpenAI API`,
	);
	lines.push(
		`    ${padUsage("OPENAI_BASE_URL", 26)}Alias for direct OpenAI base URL`,
	);
	lines.push(
		`    ${padUsage("OPENAI_COMPAT_BASE_URL", 26)}OpenAI-compatible endpoint (for proxy / local gateway)`,
	);
	lines.push(
		`    ${padUsage("OPENAI_ORG_ID", 26)}Optional OpenAI organization ID`,
	);
	lines.push(
		`    ${padUsage("OPENAI_PROJECT_ID", 26)}Optional OpenAI project ID`,
	);
	lines.push(
		`    ${padUsage("NOUS_MODEL", 26)}Model for Claude CLI provider (default: sonnet)`,
	);
	lines.push(`    ${padUsage("NOUS_HOME", 26)}Nous user home (default: ~/.nous)`);
	lines.push(
		`    ${padUsage("NOUS_DB", 26)}Database path (default: ~/.nous/state/nous.db)`,
	);
	lines.push(
		`    ${padUsage("NOUS_SECRETS_FILE", 26)}Override provider secrets file (default: ~/.nous/secrets/providers.json)`,
	);
	lines.push(
		`    ${padUsage("NOUS_LOG_LEVEL", 26)}Log level: debug, info, warn, error, silent (default: info)`,
	);
	lines.push("");
	lines.push(
		`    ${colors.dim("Provider secrets: env vars override ~/.nous/secrets/providers.json")}`,
	);
	lines.push(
		`    ${colors.dim("Provider priority default: OpenAI > OpenAI-compatible > Anthropic > Claude CLI")}`,
	);
	lines.push("");
	lines.push(`  ${colors.bold("Examples:")}`);
	lines.push(
		`    ${colors.dim('nous "Read README.md and summarize what this project is about"')}`,
	);
	lines.push(`    ${colors.dim('nous "Find all TODO comments in the codebase"')}`);
	lines.push(`    ${colors.dim("nous daemon start")}`);
	lines.push(`    ${colors.dim("nous help permissions")}`);
	lines.push(`    ${colors.dim("nous attach thread_abc123 --once")}`);
	lines.push("");
	return lines;
}

export function printReplCommands(options: {
	daemonRunning: boolean;
	currentThreadId?: string;
	query?: string;
}): void {
	for (const line of formatReplCommandsLines(options)) {
		console.log(line);
	}
}

export function formatReplCommandsLines(options: {
	daemonRunning: boolean;
	currentThreadId?: string;
	query?: string;
}): string[] {
	const query = options.query?.trim();
	const replContext: ControlSurfaceContext & { includeUnavailable?: boolean } = {
		surface: "repl",
		channelType: "cli",
		daemonRunning: options.daemonRunning,
		currentThreadId: options.currentThreadId,
		includeUnavailable: true,
	};
	const cliContext: ControlSurfaceContext & { includeUnavailable?: boolean } = {
		surface: "cli",
		channelType: "cli",
		daemonRunning: options.daemonRunning,
		currentThreadId: options.currentThreadId,
		includeUnavailable: true,
	};
	const replEntries = query
		? searchControlSurfaceEntries(query, replContext).filter((entry) =>
				entry.syntaxes.some((syntax) => syntax.surface === "repl"),
			)
		: listControlSurfaceEntries(replContext).filter((entry) =>
				entry.syntaxes.some((syntax) => syntax.surface === "repl"),
			);
	const cliEntries = query
		? searchControlSurfaceEntries(query, cliContext).filter((entry) =>
				entry.syntaxes.some((syntax) => syntax.surface === "cli"),
			)
		: listControlSurfaceEntries(cliContext).filter((entry) =>
				entry.syntaxes.some((syntax) => syntax.surface === "cli"),
			);
	const lines = [`  ${colors.bold("νοῦς — REPL Commands")}`, ""];
	lines.push(
		`  ${colors.dim("Conversation:")} type a normal task or reply to continue the current thread.`,
	);
	lines.push(
		`  ${colors.dim("Current thread:")} ${options.currentThreadId ?? "(none attached; the next message can create or discover a thread)"}`,
	);
	lines.push(
		`  ${colors.dim("Natural-language control:")} ordinary REPL text is first resolved semantically against the control surface; try ${colors.dim('"show daemon status"')}, ${colors.dim('"attach to thread_123"')}, or ${colors.dim('"what can you do here?"')}.`,
	);
	lines.push("");
	if (replEntries.length === 0 && cliEntries.length === 0) {
		lines.push(`  ${colors.yellow("No matching commands found.")}`);
		lines.push(
			`  ${colors.dim("Try /commands, /commands thread, or /commands network.")}`,
		);
		lines.push("");
		return lines;
	}
	if (replEntries.length > 0) {
		lines.push(
			`  ${colors.bold(query ? "Matching REPL Controls:" : "Direct REPL Controls:")}`,
		);
		pushGroupedOperationLines(lines, replEntries, replContext, {
			indent: "    ",
			showAvailabilityNotes: true,
		});
		lines.push("");
	}
	if (cliEntries.length > 0) {
		lines.push(
			`  ${colors.bold(query ? "Matching CLI Commands:" : "Useful CLI Commands:")}`,
		);
		pushGroupedOperationLines(lines, cliEntries, cliContext, {
			indent: "    ",
			showAvailabilityNotes: query ? true : false,
		});
		lines.push("");
	}
	return lines;
}

function pushGroupedOperationLines(
	lines: string[],
	entries: ControlSurfaceEntry[],
	context: ControlSurfaceContext,
	options: { indent: string; showAvailabilityNotes: boolean },
): void {
	let currentCategory: string | undefined;
	for (const entry of entries) {
		const category = controlSurfaceCategoryLabel(entry.category);
		if (category !== currentCategory) {
			lines.push(`${options.indent}${colors.cyan(category)}`);
			currentCategory = category;
		}
		const availabilityNote = options.showAvailabilityNotes
			? controlSurfaceAvailabilityNote(entry, context)
			: undefined;
		lines.push(
			formatOperationLine(
				entry,
				context,
				options.indent,
				availabilityNote,
			),
		);
	}
}

function formatOperationLine(
	entry: ControlSurfaceEntry,
	context: ControlSurfaceContext,
	indent: string,
	availabilityNote?: string,
): string {
	const usage = primaryControlSurfaceSyntax(entry, context.surface);
	const suffix = availabilityNote ? ` ${colors.dim(`[${availabilityNote}]`)}` : "";
	return `${indent}  ${padUsage(usage, 36)}${entry.summary}${suffix}`;
}

function padUsage(value: string, width: number): string {
	return value.length >= width ? `${value} ` : value.padEnd(width, " ");
}
