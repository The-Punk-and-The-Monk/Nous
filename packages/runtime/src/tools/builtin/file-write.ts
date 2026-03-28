import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";

export const fileWriteDef: ToolDef = {
	name: "file_write",
	description:
		"Write content to a file at the given path. Creates parent directories if needed.",
	inputSchema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Absolute or relative path to the file",
			},
			content: { type: "string", description: "Content to write" },
		},
		required: ["path", "content"],
	},
	requiredCapabilities: ["fs.write"],
	timeoutMs: 10000,
};

export const fileWriteHandler: ToolHandler = async (input) => {
	const path = input.path as string;
	const content = input.content as string;
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf-8");
	return `Written ${content.length} bytes to ${path}`;
};
