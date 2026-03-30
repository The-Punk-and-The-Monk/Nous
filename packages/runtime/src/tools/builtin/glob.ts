import type { ToolDef } from "@nous/core";
import { Glob } from "bun";
import type { ToolHandler } from "../executor.ts";

export const globDef: ToolDef = {
	name: "glob",
	description: "Search for files matching a glob pattern",
	inputSchema: {
		type: "object",
		properties: {
			pattern: {
				type: "string",
				description: "Glob pattern (e.g., '**/*.ts')",
			},
			cwd: { type: "string", description: "Working directory for the search" },
		},
		required: ["pattern"],
	},
	requiredCapabilities: ["fs.read"],
	timeoutMs: 15000,
	sideEffectClass: "read_only",
	idempotency: "idempotent",
	interruptibility: "after_tool",
	approvalMode: "auto",
	rollbackPolicy: "none",
};

export const globHandler: ToolHandler = async (input, context) => {
	const pattern = input.pattern as string;
	const cwd = (input.cwd as string) ?? ".";
	const glob = new Glob(pattern);
	const matches: string[] = [];
	for await (const file of glob.scan({ cwd, dot: false })) {
		if (context.signal.aborted) {
			throw new Error("glob interrupted before completion");
		}
		matches.push(file);
		if (matches.length >= 500) break;
	}
	if (matches.length === 0) return "No files matched the pattern.";
	return matches.join("\n");
};
