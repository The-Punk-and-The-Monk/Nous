import type { ToolExecutor } from "../executor.ts";
import type { ToolRegistry } from "../registry.ts";
import { fileReadDef, fileReadHandler } from "./file-read.ts";
import { fileWriteDef, fileWriteHandler } from "./file-write.ts";
import { globDef, globHandler } from "./glob.ts";
import { grepDef, grepHandler } from "./grep.ts";
import { shellDef, shellHandler } from "./shell.ts";

/** Register all builtin tools in the registry and executor */
export function registerBuiltinTools(
	registry: ToolRegistry,
	executor: ToolExecutor,
): void {
	const tools = [
		{ def: fileReadDef, handler: fileReadHandler },
		{ def: fileWriteDef, handler: fileWriteHandler },
		{ def: globDef, handler: globHandler },
		{ def: grepDef, handler: grepHandler },
		{ def: shellDef, handler: shellHandler },
	];

	for (const { def, handler } of tools) {
		registry.register(def);
		executor.registerHandler(def.name, handler);
	}
}
