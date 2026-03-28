import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";

export const grepDef: ToolDef = {
	name: "grep",
	description:
		"Search file contents for a regex pattern. Returns matching lines with file paths and line numbers.",
	inputSchema: {
		type: "object",
		properties: {
			pattern: { type: "string", description: "Regex pattern to search for" },
			path: { type: "string", description: "File or directory to search in" },
			glob: { type: "string", description: "File glob filter (e.g., '*.ts')" },
		},
		required: ["pattern"],
	},
	requiredCapabilities: ["fs.read"],
	timeoutMs: 30000,
};

export const grepHandler: ToolHandler = async (input) => {
	const pattern = new RegExp(input.pattern as string, "g");
	const searchPath = (input.path as string) ?? ".";
	const fileGlob = input.glob as string | undefined;

	const results: string[] = [];
	const maxResults = 100;

	async function searchFile(filePath: string): Promise<void> {
		if (results.length >= maxResults) return;
		try {
			const content = await readFile(filePath, "utf-8");
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				if (pattern.test(lines[i])) {
					results.push(`${filePath}:${i + 1}: ${lines[i].trim()}`);
					if (results.length >= maxResults) return;
				}
				pattern.lastIndex = 0;
			}
		} catch {
			// Skip unreadable files
		}
	}

	async function searchDir(dirPath: string): Promise<void> {
		if (results.length >= maxResults) return;
		const entries = await readdir(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (results.length >= maxResults) return;
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
			const fullPath = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				await searchDir(fullPath);
			} else if (entry.isFile()) {
				if (fileGlob) {
					const g = new Bun.Glob(fileGlob);
					if (!g.match(entry.name)) continue;
				}
				await searchFile(fullPath);
			}
		}
	}

	const info = await stat(searchPath);
	if (info.isFile()) {
		await searchFile(searchPath);
	} else {
		await searchDir(searchPath);
	}

	if (results.length === 0) return "No matches found.";
	return results.join("\n");
};
