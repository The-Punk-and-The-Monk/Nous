/** Structured logger for Nous framework */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	silent: 4,
};

const LEVEL_COLORS: Record<string, string> = {
	debug: "\x1b[90m", // gray
	info: "\x1b[36m", // cyan
	warn: "\x1b[33m", // yellow
	error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

function resolveLogLevel(): LogLevel {
	const env = process.env.NOUS_LOG_LEVEL?.toLowerCase();
	if (env && env in LEVEL_PRIORITY) return env as LogLevel;
	return "info";
}

let globalLevel: LogLevel = resolveLogLevel();

/** Set the global log level */
export function setLogLevel(level: LogLevel): void {
	globalLevel = level;
}

/** Get the current global log level */
export function getLogLevel(): LogLevel {
	return globalLevel;
}

export interface Logger {
	debug(msg: string, data?: Record<string, unknown>): void;
	info(msg: string, data?: Record<string, unknown>): void;
	warn(msg: string, data?: Record<string, unknown>): void;
	error(msg: string, data?: Record<string, unknown>): void;
	child(name: string): Logger;
}

function formatData(data?: Record<string, unknown>): string {
	if (!data || Object.keys(data).length === 0) return "";
	const parts: string[] = [];
	for (const [k, v] of Object.entries(data)) {
		const val = typeof v === "string" ? v : JSON.stringify(v);
		parts.push(`${k}=${val}`);
	}
	return ` ${DIM}${parts.join(" ")}${RESET}`;
}

function formatTime(): string {
	const d = new Date();
	return `${DIM}${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}${RESET}`;
}

/** Create a named logger instance */
export function createLogger(name: string): Logger {
	function log(
		level: LogLevel,
		msg: string,
		data?: Record<string, unknown>,
	): void {
		if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[globalLevel]) return;
		const color = LEVEL_COLORS[level] ?? "";
		const tag = `${color}${level.toUpperCase().padEnd(5)}${RESET}`;
		const prefix = `${DIM}[${name}]${RESET}`;
		const line = `${formatTime()} ${tag} ${prefix} ${msg}${formatData(data)}`;

		if (level === "error") {
			console.error(line);
		} else if (level === "warn") {
			console.warn(line);
		} else {
			console.log(line);
		}
	}

	return {
		debug: (msg, data) => log("debug", msg, data),
		info: (msg, data) => log("info", msg, data),
		warn: (msg, data) => log("warn", msg, data),
		error: (msg, data) => log("error", msg, data),
		child: (childName) => createLogger(`${name}:${childName}`),
	};
}
