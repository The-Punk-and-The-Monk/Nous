import { readFile } from "node:fs/promises";
import type { ToolDef } from "@nous/core";
import type { ToolHandler } from "../executor.ts";

export const fileReadDef: ToolDef = {
	name: "file_read",
	description: "Read the contents of a file at the given path",
	inputSchema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Absolute or relative path to the file",
			},
		},
		required: ["path"],
	},
	requiredCapabilities: ["fs.read"],
	timeoutMs: 10000,
};

export const fileReadHandler: ToolHandler = async (input) => {
	const path = input.path as string;
	return await readFile(path, "utf-8");
};
