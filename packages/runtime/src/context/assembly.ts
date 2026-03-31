import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type {
	AssembledContext,
	ChannelScope,
	Intent,
	PermissionContext,
} from "@nous/core";
import { now } from "@nous/core";

export interface ContextAssemblyInput {
	scope: ChannelScope;
	activeIntents?: Pick<Intent, "id" | "raw" | "goal" | "status" | "source">[];
	recentMemoryHints?: string[];
	permissionContext?: PermissionContext;
}

export class ContextAssembler {
	assemble(input: ContextAssemblyInput): AssembledContext {
		const rootDir = resolveProjectRoot(input.scope);
		const gitStatusDetail = getGitStatusDetail(rootDir);
		return {
			environment: {
				cwd: input.scope.workingDirectory ?? process.cwd(),
				os: process.platform,
				arch: process.arch,
				shell: process.env.SHELL ?? "unknown",
				availableTools: detectAvailableTools([
					"git",
					"bun",
					"node",
					"npm",
					"python3",
				]),
				timestamp: now(),
			},
			project: {
				rootDir,
				type: detectProjectType(rootDir),
				language: detectLanguage(rootDir),
				framework: detectFramework(rootDir),
				packageManager: detectPackageManager(rootDir),
				gitBranch: getGitBranch(rootDir),
				gitStatus: getGitStatus(rootDir),
				gitStatusDetail,
				directoryTree: buildDirectoryTree(rootDir),
				readmeSnippet: readReadmeSnippet(rootDir),
				configFiles: detectConfigFiles(rootDir),
				localNousConfigFiles: detectLocalNousConfigFiles(rootDir),
				focusedFile: input.scope.focusedFile,
			},
			user: {
				activeIntents: input.activeIntents ?? [],
				recentMemoryHints: input.recentMemoryHints ?? [],
				scopeLabels: input.scope.labels ?? [],
			},
			permissions: input.permissionContext ?? {
				autoAllowed: [],
				approvalRequired: [],
				denied: [],
				explanation: "No permission boundary summary was provided.",
			},
		};
	}
}

export function renderContextForSystemPrompt(
	context: AssembledContext,
): string {
	const activeIntents =
		context.user.activeIntents.length > 0
			? context.user.activeIntents
					.map((intent) => `- ${intent.goal.summary} (${intent.status})`)
					.join("\n")
			: "- none";
	const memoryHints =
		context.user.recentMemoryHints.length > 0
			? context.user.recentMemoryHints.map((hint) => `- ${hint}`).join("\n")
			: "- none";
	const scopeLabels =
		context.user.scopeLabels.length > 0
			? context.user.scopeLabels.map((label) => `- ${label}`).join("\n")
			: "- none";
	const gitStatusDetail =
		context.project.gitStatusDetail.length > 0
			? context.project.gitStatusDetail.map((line) => `- ${line}`).join("\n")
			: "- none";
	const localNousConfig =
		context.project.localNousConfigFiles.length > 0
			? context.project.localNousConfigFiles
					.map((file) => `- ${file}`)
					.join("\n")
			: "- none";
	const permissionAutoAllowed =
		context.permissions.autoAllowed.length > 0
			? context.permissions.autoAllowed.map((line) => `- ${line}`).join("\n")
			: "- none";
	const permissionApprovalRequired =
		context.permissions.approvalRequired.length > 0
			? context.permissions.approvalRequired
					.map((line) => `- ${line}`)
					.join("\n")
			: "- none";
	const permissionDenied =
		context.permissions.denied.length > 0
			? context.permissions.denied.map((line) => `- ${line}`).join("\n")
			: "- none";

	return [
		"Context Assembly",
		`Environment: cwd=${context.environment.cwd}; os=${context.environment.os}; arch=${context.environment.arch}; shell=${context.environment.shell}; tools=${context.environment.availableTools.join(", ") || "none"}; timestamp=${context.environment.timestamp}`,
		`Project: root=${context.project.rootDir}; type=${context.project.type}; language=${context.project.language}; framework=${context.project.framework ?? "unknown"}; packageManager=${context.project.packageManager ?? "unknown"}; gitBranch=${context.project.gitBranch ?? "none"}; gitStatus=${context.project.gitStatus ?? "unknown"}; focusedFile=${context.project.focusedFile ?? "none"}`,
		`Git status detail:\n${gitStatusDetail}`,
		`Config files:\n${context.project.configFiles.map((file) => `- ${file}`).join("\n") || "- none"}`,
		`Local Nous config:\n${localNousConfig}`,
		`Directory tree:\n${context.project.directoryTree}`,
		`README snippet:\n${context.project.readmeSnippet ?? "(none)"}`,
		`Active intents:\n${activeIntents}`,
		`Scope labels:\n${scopeLabels}`,
		`Memory hints:\n${memoryHints}`,
		`Permission boundary summary: ${context.permissions.explanation}`,
		`Permission auto-allowed:\n${permissionAutoAllowed}`,
		`Permission approval-required:\n${permissionApprovalRequired}`,
		`Permission denied:\n${permissionDenied}`,
	].join("\n\n");
}

function resolveProjectRoot(scope: ChannelScope): string {
	return resolve(scope.projectRoot ?? scope.workingDirectory ?? process.cwd());
}

function detectAvailableTools(toolNames: string[]): string[] {
	return toolNames.filter((tool) => hasExecutableOnPath(tool));
}

function hasExecutableOnPath(name: string): boolean {
	const pathValue = process.env.PATH ?? "";
	for (const entry of pathValue.split(":")) {
		if (!entry) continue;
		const candidate = join(entry, name);
		if (existsSync(candidate)) return true;
	}
	return false;
}

function detectProjectType(rootDir: string): string {
	if (existsSync(join(rootDir, "package.json"))) {
		if (existsSync(join(rootDir, "packages"))) return "typescript-monorepo";
		return "javascript-package";
	}
	if (existsSync(join(rootDir, "pyproject.toml"))) return "python-package";
	if (existsSync(join(rootDir, "Cargo.toml"))) return "rust-crate";
	if (existsSync(join(rootDir, "go.mod"))) return "go-module";
	return "unknown";
}

function detectLanguage(rootDir: string): string {
	if (existsSync(join(rootDir, "tsconfig.json"))) return "typescript";
	if (existsSync(join(rootDir, "package.json"))) return "javascript";
	if (existsSync(join(rootDir, "pyproject.toml"))) return "python";
	if (existsSync(join(rootDir, "Cargo.toml"))) return "rust";
	if (existsSync(join(rootDir, "go.mod"))) return "go";
	return "unknown";
}

function detectFramework(rootDir: string): string | undefined {
	const packageJson = readJson(join(rootDir, "package.json"));
	if (!packageJson) return undefined;
	const deps = {
		...toStringMap(packageJson.dependencies),
		...toStringMap(packageJson.devDependencies),
	};
	if (deps.next) return "nextjs";
	if (deps.react) return "react";
	if (deps.vue) return "vue";
	if (deps.svelte) return "svelte";
	if (deps.express) return "express";
	return undefined;
}

function detectPackageManager(rootDir: string): string | undefined {
	if (
		existsSync(join(rootDir, "bun.lock")) ||
		existsSync(join(rootDir, "bun.lockb"))
	) {
		return "bun";
	}
	if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(rootDir, "package-lock.json"))) return "npm";
	if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
	if (existsSync(join(rootDir, "poetry.lock"))) return "poetry";
	if (existsSync(join(rootDir, "Cargo.lock"))) return "cargo";
	return undefined;
}

function detectConfigFiles(rootDir: string): string[] {
	const candidates = [
		"package.json",
		"tsconfig.json",
		"biome.json",
		"README.md",
		"AGENTS.md",
		"CLAUDE.md",
		".gitignore",
		"pyproject.toml",
		"Cargo.toml",
		"go.mod",
	];
	return candidates.filter((file) => existsSync(join(rootDir, file)));
}

function detectLocalNousConfigFiles(rootDir: string): string[] {
	const localNousRoot = join(rootDir, ".nous");
	if (!existsSync(localNousRoot)) return [];
	const candidates = [
		"config.json",
		"providers.json",
		"sensors.json",
		"ambient.json",
		"permissions.json",
	];
	return candidates
		.filter((file) => existsSync(join(localNousRoot, file)))
		.map((file) => `.nous/${file}`);
}

function buildDirectoryTree(
	rootDir: string,
	depth = 2,
	maxEntries = 20,
): string {
	const lines: string[] = [rootDir];
	walkTree(rootDir, "", depth, maxEntries, lines);
	return lines.join("\n");
}

function walkTree(
	rootDir: string,
	prefix: string,
	depth: number,
	maxEntries: number,
	lines: string[],
): void {
	if (depth <= 0) return;
	const entries = safeReadDir(rootDir)
		.filter((entry) => !shouldIgnore(entry.name))
		.slice(0, maxEntries);

	for (const entry of entries) {
		const marker = entry.isDirectory() ? "/" : "";
		lines.push(`${prefix}- ${entry.name}${marker}`);
		if (entry.isDirectory()) {
			walkTree(
				join(rootDir, entry.name),
				`${prefix}  `,
				depth - 1,
				Math.max(4, Math.floor(maxEntries / 2)),
				lines,
			);
		}
	}
}

function readReadmeSnippet(rootDir: string): string | undefined {
	const readmePaths = ["README.md", "readme.md", "README"];
	for (const candidate of readmePaths) {
		const path = join(rootDir, candidate);
		if (!existsSync(path)) continue;
		const content = readFileSync(path, "utf8");
		return content.split("\n").slice(0, 40).join("\n").slice(0, 2400);
	}
	return undefined;
}

function getGitBranch(rootDir: string): string | undefined {
	if (!existsSync(join(rootDir, ".git"))) return undefined;
	return runGit(rootDir, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? undefined;
}

function getGitStatus(rootDir: string): string | undefined {
	if (!existsSync(join(rootDir, ".git"))) return undefined;
	const conflicts = runGit(rootDir, ["diff", "--name-only", "--diff-filter=U"]);
	if (conflicts?.trim()) return "conflicts";

	const status = runGit(rootDir, ["status", "--short", "--untracked-files=no"]);
	if (status === undefined) return undefined;
	return status.trim() ? "dirty" : "clean";
}

function getGitStatusDetail(rootDir: string, limit = 12): string[] {
	if (!existsSync(join(rootDir, ".git"))) return [];
	const status = runGit(rootDir, ["status", "--short", "--untracked-files=no"]);
	if (!status?.trim()) return [];
	return status
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, limit);
}

function runGit(rootDir: string, args: string[]): string | undefined {
	try {
		const proc = Bun.spawnSync(["git", "-C", rootDir, ...args], {
			stdout: "pipe",
			stderr: "ignore",
		});
		if (proc.exitCode !== 0) return undefined;
		return proc.stdout.toString().trim();
	} catch {
		return undefined;
	}
}

function readJson(path: string): Record<string, unknown> | undefined {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

function toStringMap(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => {
			return typeof entry[1] === "string";
		}),
	);
}

function safeReadDir(path: string) {
	try {
		return readdirSync(path, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
	} catch {
		return [];
	}
}

function shouldIgnore(name: string): boolean {
	return (
		name === ".git" ||
		name === "node_modules" ||
		name === ".nous" ||
		name.startsWith(".DS_Store")
	);
}

export interface FileSnapshotEntry {
	path: string;
	mtimeMs: number;
}

export function snapshotFiles(
	rootDir: string,
	limit = 200,
): FileSnapshotEntry[] {
	const results: FileSnapshotEntry[] = [];
	collectFiles(rootDir, rootDir, results, limit);
	return results;
}

function collectFiles(
	rootDir: string,
	currentDir: string,
	results: FileSnapshotEntry[],
	limit: number,
): void {
	if (results.length >= limit) return;
	for (const entry of safeReadDir(currentDir)) {
		if (shouldIgnore(entry.name)) continue;
		const absolute = join(currentDir, entry.name);
		if (entry.isDirectory()) {
			collectFiles(rootDir, absolute, results, limit);
			if (results.length >= limit) return;
			continue;
		}
		try {
			const stat = statSync(absolute);
			results.push({
				path: relative(rootDir, absolute) || entry.name,
				mtimeMs: stat.mtimeMs,
			});
		} catch {
			// ignore ephemeral files that disappear during traversal
		}
	}
}
