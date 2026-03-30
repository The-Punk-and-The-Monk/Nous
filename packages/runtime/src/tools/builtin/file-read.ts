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
	sideEffectClass: "read_only",
	idempotency: "idempotent",
	interruptibility: "after_tool",
	approvalMode: "auto",
	rollbackPolicy: "none",
};

export const fileReadHandler: ToolHandler = async (input, context) => {
	if (context.signal.aborted) {
		throw new Error("file_read interrupted before start");
	}
	const path = input.path as string;
	return await readFile(path, "utf-8");
};
