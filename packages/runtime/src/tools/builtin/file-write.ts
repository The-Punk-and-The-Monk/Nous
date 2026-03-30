import { mkdir, readFile, writeFile } from "node:fs/promises";
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
	sideEffectClass: "write",
	idempotency: "best_effort",
	interruptibility: "after_tool",
	approvalMode: "ask",
	rollbackPolicy: "handler_declared",
};

export const fileWriteHandler: ToolHandler = async (input, context) => {
	if (context.signal.aborted) {
		throw new Error("file_write interrupted before start");
	}
	const path = input.path as string;
	const content = input.content as string;
	let previousContent: string | undefined;
	let existed = true;
	try {
		previousContent = await readFile(path, "utf-8");
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			existed = false;
		} else {
			throw error;
		}
	}
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf-8");
	return {
		output: `Written ${content.length} bytes to ${path}`,
		rollbackPlan: existed
			? {
					kind: "restore_file",
					path,
					content: previousContent ?? "",
				}
			: {
					kind: "delete_file",
					path,
				},
	};
};
