import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface NousPaths {
	homeDir: string;
	configDir: string;
	daemonDir: string;
	stateDir: string;
	logsDir: string;
	toolsDir: string;
	skillsDir: string;
	cacheDir: string;
	secretsDir: string;
	projectDir?: string;
}

export interface NousConfig {
	daemon: {
		host: string;
		port: number;
		socketPath?: string;
		pidPath?: string;
		statePath?: string;
	};
	storage: {
		dbPath?: string;
	};
	provider: {
		priority: Array<"openai_compat" | "openai" | "anthropic" | "claude_cli">;
		claudeModel: string;
		openaiModel?: string;
	};
	sensors: {
		enabled: boolean;
		pollIntervalMs: number;
		cooldownMs: number;
		fs: { enabled: boolean };
		git: { enabled: boolean };
	};
	ambient: {
		enabled: boolean;
		autoSubmit: boolean;
		idleOnly: boolean;
	};
}

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;

type JsonObject = {
	[key: string]: JsonValue;
};

export interface NousConfigLoadOptions {
	cwd?: string;
	env?: Record<string, string | undefined>;
}

export function getNousPaths(options: NousConfigLoadOptions = {}): NousPaths {
	const env = options.env ?? process.env;
	const cwd = options.cwd ?? process.cwd();
	const homeDir = resolve(env.NOUS_HOME ?? join(homedir(), ".nous"));
	const configDir = join(homeDir, "config");
	const daemonDir = join(homeDir, "daemon");
	const stateDir = join(homeDir, "state");
	const logsDir = join(homeDir, "logs");
	const toolsDir = join(homeDir, "tools");
	const skillsDir = join(homeDir, "skills");
	const cacheDir = join(homeDir, "cache");
	const secretsDir = join(homeDir, "secrets");
	const projectDir = findNearestNousProjectDir(cwd);

	return {
		homeDir,
		configDir,
		daemonDir,
		stateDir,
		logsDir,
		toolsDir,
		skillsDir,
		cacheDir,
		secretsDir,
		projectDir: projectDir ?? undefined,
	};
}

export function ensureNousHome(options: NousConfigLoadOptions = {}): NousPaths {
	const paths = getNousPaths(options);
	for (const dir of [
		paths.homeDir,
		paths.configDir,
		paths.daemonDir,
		paths.stateDir,
		paths.logsDir,
		paths.toolsDir,
		paths.skillsDir,
		paths.cacheDir,
		paths.secretsDir,
	]) {
		mkdirSync(dir, { recursive: true });
	}

	writeDefaultJsonIfMissing(join(paths.configDir, "config.json"), {
		daemon: { host: "127.0.0.1", port: 4317 },
		storage: {},
	});
	writeDefaultJsonIfMissing(join(paths.configDir, "providers.json"), {
		provider: {
			priority: ["openai_compat", "openai", "anthropic", "claude_cli"],
			claudeModel: "sonnet",
		},
	});
	writeDefaultJsonIfMissing(join(paths.configDir, "sensors.json"), {
		sensors: {
			enabled: true,
			pollIntervalMs: 5000,
			cooldownMs: 60000,
			fs: { enabled: true },
			git: { enabled: true },
		},
	});
	writeDefaultJsonIfMissing(join(paths.configDir, "ambient.json"), {
		ambient: {
			enabled: true,
			autoSubmit: true,
			idleOnly: true,
		},
	});
	writeDefaultJsonIfMissing(join(paths.configDir, "permissions.json"), {
		permissions: {
			note: "Permission system config placeholder.",
		},
	});

	return paths;
}

export function loadNousConfig(
	options: NousConfigLoadOptions = {},
): NousConfig {
	const env = options.env ?? process.env;
	const paths = getNousPaths(options);

	const merged = deepMerge(
		asJsonObject(DEFAULT_NOUS_CONFIG),
		readJson(join(paths.configDir, "config.json")),
		readJson(join(paths.configDir, "providers.json")),
		readJson(join(paths.configDir, "sensors.json")),
		readJson(join(paths.configDir, "ambient.json")),
		paths.projectDir
			? readJson(join(paths.projectDir, "config.json"))
			: undefined,
		paths.projectDir
			? readJson(join(paths.projectDir, "providers.json"))
			: undefined,
		paths.projectDir
			? readJson(join(paths.projectDir, "sensors.json"))
			: undefined,
		paths.projectDir
			? readJson(join(paths.projectDir, "ambient.json"))
			: undefined,
	);
	const config = merged as unknown as NousConfig;

	if (env.NOUS_HOST) config.daemon.host = env.NOUS_HOST;
	if (env.NOUS_PORT) config.daemon.port = Number.parseInt(env.NOUS_PORT, 10);
	if (env.NOUS_DB) config.storage.dbPath = resolve(env.NOUS_DB);
	if (env.NOUS_MODEL) config.provider.claudeModel = env.NOUS_MODEL;

	return config;
}

function findNearestNousProjectDir(start: string): string | null {
	let current = resolve(start);
	while (true) {
		const candidate = join(current, ".nous");
		if (existsSync(candidate)) return candidate;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

function writeDefaultJsonIfMissing(path: string, value: JsonValue): void {
	if (existsSync(path)) return;
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path: string): JsonObject | undefined {
	if (!existsSync(path)) return undefined;
	try {
		return asJsonObject(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return undefined;
	}
}

function deepMerge(...values: Array<JsonObject | undefined>): JsonObject {
	const result: JsonObject = {};
	for (const value of values) {
		if (!value) continue;
		mergeInto(result, value);
	}
	return result;
}

function mergeInto(target: JsonObject, source: JsonObject): void {
	for (const [key, value] of Object.entries(source)) {
		if (isPlainObject(value) && isPlainObject(target[key])) {
			mergeInto(target[key] as JsonObject, value as JsonObject);
			continue;
		}
		target[key] = value;
	}
}

function isPlainObject(value: JsonValue | undefined): boolean {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asJsonObject(value: unknown): JsonObject | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as JsonObject;
}

const DEFAULT_NOUS_CONFIG: NousConfig = {
	daemon: {
		host: "127.0.0.1",
		port: 4317,
	},
	storage: {},
	provider: {
		priority: ["openai_compat", "openai", "anthropic", "claude_cli"],
		claudeModel: "sonnet",
	},
	sensors: {
		enabled: true,
		pollIntervalMs: 5000,
		cooldownMs: 60000,
		fs: { enabled: true },
		git: { enabled: true },
	},
	ambient: {
		enabled: true,
		autoSubmit: true,
		idleOnly: true,
	},
};
