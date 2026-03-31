import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface NousPaths {
	homeDir: string;
	configDir: string;
	daemonDir: string;
	stateDir: string;
	logsDir: string;
	artifactsDir: string;
	networkDir: string;
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
		openaiModel: string;
		openaiBaseURL?: string;
		openaiCompatBaseURL?: string;
		openaiWireApi?: "chat_completions" | "responses";
		openaiCompatWireApi?: "chat_completions" | "responses";
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
		reflectionIntervalMs: number;
		prospectiveLookaheadMs: number;
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
	const artifactsDir = join(homeDir, "artifacts");
	const networkDir = join(homeDir, "network");
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
		artifactsDir,
		networkDir,
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
		paths.artifactsDir,
		paths.networkDir,
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
			priority: ["openai", "openai_compat", "anthropic", "claude_cli"],
			openaiModel: "gpt-5.1",
			openaiWireApi: "responses",
			openaiCompatWireApi: "chat_completions",
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
			reflectionIntervalMs: 60000,
			prospectiveLookaheadMs: 900000,
		},
	});
	writeDefaultJsonIfMissing(join(paths.configDir, "network.json"), {
		networkEnabled: false,
		sharing: {
			enabled: false,
			autoShare: false,
			excludeDomains: [],
			excludeKeywords: [],
			minLocalConfidence: 0.8,
		},
		respondToQueries: {
			enabled: false,
			autoRespond: false,
			maxConsultationsPerDay: 10,
			allowedDomains: [],
			blockedInstances: [],
		},
		queryOthers: {
			enabled: false,
			autoQuery: false,
			maxQueriesPerDay: 10,
			preferredSpecialists: [],
		},
		collectiveInsights: {
			enabled: true,
			autoApply: false,
			minConfidence: 0.9,
		},
	});
	writeDefaultJsonIfMissing(join(paths.configDir, "permissions.json"), {
		grantAll: false,
		rules: [
			{
				action: "fs.read",
				scope: { type: "directory", paths: ["./**"] },
				approval: "auto_allow",
			},
			{
				action: "fs.write",
				scope: { type: "directory", paths: ["./**"] },
				approval: "ask_once",
			},
			{
				action: "shell.exec",
				scope: {
					type: "command",
					allowlist: [
						"ls",
						"cat",
						"head",
						"tail",
						"wc",
						"find",
						"which",
						"echo",
						"date",
					],
				},
				approval: "auto_allow",
			},
			{
				action: "shell.exec",
				scope: {
					type: "command",
					allowlist: ["git", "bun", "npm", "node", "tsc", "biome"],
				},
				approval: "ask_once",
			},
			{
				action: "shell.exec",
				scope: { type: "command", allowlist: [] },
				approval: "always_ask",
			},
			{
				action: "network.http",
				scope: { type: "network", domains: [] },
				approval: "always_ask",
			},
			{
				action: "browser.control",
				scope: { type: "all" },
				approval: "always_ask",
			},
			{
				action: "spawn_subagent",
				scope: { type: "all" },
				approval: "ask_once",
			},
			{
				action: "memory.write",
				scope: { type: "all" },
				approval: "auto_allow",
			},
			{
				action: "evolution.self_mutate",
				scope: { type: "all" },
				approval: "always_ask",
			},
			{
				action: "escalate_to_human",
				scope: { type: "all" },
				approval: "auto_allow",
			},
		],
	});
	writeDefaultJsonIfMissing(
		join(paths.secretsDir, "providers.json"),
		{
			providers: {
				openai: {},
				anthropic: {},
				openaiCompat: {},
			},
		},
		0o600,
	);

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

function writeDefaultJsonIfMissing(
	path: string,
	value: JsonValue,
	mode?: number,
): void {
	if (existsSync(path)) return;
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode });
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
		priority: ["openai", "openai_compat", "anthropic", "claude_cli"],
		openaiModel: "gpt-5.1",
		openaiWireApi: "responses",
		openaiCompatWireApi: "chat_completions",
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
		reflectionIntervalMs: 60000,
		prospectiveLookaheadMs: 900000,
	},
};
