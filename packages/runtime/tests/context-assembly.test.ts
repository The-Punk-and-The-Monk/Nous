import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ContextAssembler,
	renderContextForSystemPrompt,
} from "../src/context/assembly.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("ContextAssembler", () => {
	test("assembles environment and project context from scope", () => {
		const root = mkdtempSync(join(tmpdir(), "nous-context-"));
		tempDirs.push(root);
		mkdirSync(join(root, "packages"));
		mkdirSync(join(root, ".nous"));
		writeFileSync(
			join(root, "package.json"),
			JSON.stringify({ dependencies: { react: "^18.0.0" } }),
		);
		writeFileSync(join(root, "tsconfig.json"), "{}");
		writeFileSync(join(root, "README.md"), "# Demo\n\nThis is a demo repo.");
		writeFileSync(join(root, ".nous", "ambient.json"), "{}");

		const assembler = new ContextAssembler();
		const context = assembler.assemble({
			scope: {
				workingDirectory: root,
				projectRoot: root,
				focusedFile: "src/index.ts",
				labels: ["coding", "repo"],
			},
			activeIntents: [],
			recentMemoryHints: ["User prefers concise output."],
			permissionContext: {
				autoAllowed: ["fs.read under /repo/**"],
				approvalRequired: ["fs.write under /repo/** (approval on first use)"],
				denied: [],
				explanation: "Reads are auto-allowed; writes require approval.",
			},
		});

		expect(context.project.rootDir).toBe(root);
		expect(context.project.type).toBe("typescript-monorepo");
		expect(context.project.language).toBe("typescript");
		expect(context.project.framework).toBe("react");
		expect(context.project.configFiles).toContain("package.json");
		expect(context.project.localNousConfigFiles).toContain(
			".nous/ambient.json",
		);
		expect(context.project.readmeSnippet).toContain("demo repo");
		expect(context.user.recentMemoryHints).toEqual([
			"User prefers concise output.",
		]);
		expect(context.user.scopeLabels).toEqual(["coding", "repo"]);
		expect(context.permissions.explanation).toContain(
			"writes require approval",
		);
	});

	test("renders assembled context into a system prompt block", () => {
		const assembler = new ContextAssembler();
		const context = assembler.assemble({
			scope: {
				projectRoot: process.cwd(),
				workingDirectory: process.cwd(),
			},
			activeIntents: [
				{
					id: "int_1",
					raw: "Refactor auth module",
					goal: { summary: "Refactor auth module", successCriteria: [] },
					status: "active",
					source: "human",
				},
			],
			permissionContext: {
				autoAllowed: ["fs.read under current project"],
				approvalRequired: ["shell.exec for git (approval on first use)"],
				denied: ["network.http to any domain"],
				explanation: "Read access is auto-allowed; git commands need approval.",
			},
		});

		const prompt = renderContextForSystemPrompt(context);
		expect(prompt).toContain("Context Assembly");
		expect(prompt).toContain("Active intents");
		expect(prompt).toContain("Refactor auth module");
		expect(prompt).toContain("Permission boundary summary");
		expect(prompt).toContain("shell.exec for git");
	});
});
