import type { ToolExecutor } from "../executor.ts";
import type { ToolRegistry } from "../registry.ts";
import { fileReadDef, fileReadHandler } from "./file-read.ts";
import { fileWriteDef, fileWriteHandler } from "./file-write.ts";
import { gitDiffDef, gitDiffHandler } from "./git-diff.ts";
import { gitLogDef, gitLogHandler } from "./git-log.ts";
import { gitStatusDef, gitStatusHandler } from "./git-status.ts";
import { globDef, globHandler } from "./glob.ts";
import { grepDef, grepHandler } from "./grep.ts";
import type { MemoryToolDependencies } from "./memory-search.ts";
import { memorySearchDef, memorySearchHandler } from "./memory-search.ts";
import { memoryStoreDef, memoryStoreHandler } from "./memory-store.ts";
import { shellDef, shellHandler } from "./shell.ts";
import { testRunnerDef, testRunnerHandler } from "./test-runner.ts";

export interface BuiltinToolDependencies extends MemoryToolDependencies {}

/** Register all builtin tools in the registry and executor */
export function registerBuiltinTools(
	registry: ToolRegistry,
	executor: ToolExecutor,
	dependencies: BuiltinToolDependencies = {},
): void {
	const tools = [
		{ def: fileReadDef, handler: fileReadHandler },
		{ def: fileWriteDef, handler: fileWriteHandler },
		{ def: globDef, handler: globHandler },
		{ def: grepDef, handler: grepHandler },
		{ def: shellDef, handler: shellHandler },
		{ def: gitStatusDef, handler: gitStatusHandler },
		{ def: gitDiffDef, handler: gitDiffHandler },
		{ def: gitLogDef, handler: gitLogHandler },
		{ def: testRunnerDef, handler: testRunnerHandler },
	];

	if (dependencies.memory) {
		tools.push(
			{ def: memorySearchDef, handler: memorySearchHandler(dependencies) },
			{ def: memoryStoreDef, handler: memoryStoreHandler(dependencies) },
		);
	}

	for (const { def, handler } of tools) {
		registry.register(def);
		executor.registerHandler(def.name, handler);
	}
}
