import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilitySet } from "@nous/core";
import { initDatabase, SQLiteMemoryStore } from "@nous/persistence";
import {
	MemoryService,
	ToolExecutor,
	ToolRegistry,
	registerBuiltinTools,
} from "../src/index.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("Tier 2 builtin tools", () => {
	test("git tools still respect shell allowlists", async () => {
		const root = createGitRepo();
		const { registry, executor } = createToolRuntime();
		const gitStatus = registry.get("git_status");
		expect(gitStatus).toBeDefined();
		if (!gitStatus) {
			throw new Error("Expected git_status tool to be registered");
		}

		const result = await executor.execute(
			gitStatus,
			{ cwd: root },
			createCapabilities({
				"shell.exec": { allowlist: ["ls"] },
			}),
		);

		expect(result.success).toBe(false);
		expect(result.output).toContain("shell.exec");
	});

	test("git_status and git_diff expose repo state as explicit tools", async () => {
		const root = createGitRepo();
		const { registry, executor } = createToolRuntime();
		const gitStatus = registry.get("git_status");
		const gitDiff = registry.get("git_diff");
		expect(gitStatus).toBeDefined();
		expect(gitDiff).toBeDefined();
		if (!gitStatus || !gitDiff) {
			throw new Error("Expected git tools to be registered");
		}

		const capabilities = createCapabilities({
			"shell.exec": { allowlist: ["git"] },
		});

		const statusResult = await executor.execute(
			gitStatus,
			{ cwd: root },
			capabilities,
		);
		const diffResult = await executor.execute(
			gitDiff,
			{ cwd: root, path: "app.txt" },
			capabilities,
		);

		expect(statusResult.success).toBe(true);
		expect(statusResult.output).toContain("app.txt");
		expect(diffResult.success).toBe(true);
		expect(diffResult.output).toContain("+beta updated");
	});

	test("memory_store and memory_search round-trip semantic notes", async () => {
		const memory = new MemoryService({
			store: new SQLiteMemoryStore(initDatabase()),
			agentId: "nous",
		});
		const { registry, executor } = createToolRuntime({ memory });
		const memoryStore = registry.get("memory_store");
		const memorySearch = registry.get("memory_search");
		expect(memoryStore).toBeDefined();
		expect(memorySearch).toBeDefined();
		if (!memoryStore || !memorySearch) {
			throw new Error("Expected memory tools to be registered");
		}

		const capabilities = createCapabilities({ "memory.write": true });

		const storeResult = await executor.execute(
			memoryStore,
			{
				content: "Project policy: prefer Bun scripts for local verification.",
				factType: "policy",
				projectRoot: "/repo/app",
				tags: ["project", "runtime"],
			},
			capabilities,
		);
		const searchResult = await executor.execute(
			memorySearch,
			{
				query: "prefer Bun scripts",
				projectRoot: "/repo/app",
				tiers: ["semantic"],
			},
			capabilities,
		);

		expect(storeResult.success).toBe(true);
		expect(storeResult.output).toContain("Stored memory");
		expect(searchResult.success).toBe(true);
		expect(searchResult.output).toContain("prefer Bun scripts");
		expect(searchResult.output).toContain("manual_note");
	});
});

function createToolRuntime(options: { memory?: MemoryService } = {}): {
	registry: ToolRegistry;
	executor: ToolExecutor;
} {
	const registry = new ToolRegistry();
	const executor = new ToolExecutor();
	registerBuiltinTools(registry, executor, options);
	return { registry, executor };
}

function createCapabilities(
	overrides: Partial<CapabilitySet> = {},
): CapabilitySet {
	return {
		"shell.exec": false,
		"fs.read": false,
		"fs.write": false,
		"browser.control": false,
		"network.http": false,
		spawn_subagent: false,
		"memory.write": false,
		escalate_to_human: true,
		...overrides,
	};
}

function createGitRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "nous-builtin-tools-"));
	tempDirs.push(root);

	runGit(["init"], root);
	runGit(["config", "user.email", "nous@example.com"], root);
	runGit(["config", "user.name", "Nous Test"], root);
	writeFileSync(join(root, "app.txt"), "alpha\nbeta\n", "utf8");
	runGit(["add", "app.txt"], root);
	runGit(["commit", "-m", "init"], root);
	writeFileSync(join(root, "app.txt"), "alpha\nbeta updated\n", "utf8");

	return root;
}

function runGit(args: string[], cwd: string): void {
	const proc = Bun.spawnSync(["git", ...args], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	if (proc.exitCode === 0) {
		return;
	}
	throw new Error(
		`git ${args.join(" ")} failed: ${proc.stderr.toString().trim()}`,
	);
}
