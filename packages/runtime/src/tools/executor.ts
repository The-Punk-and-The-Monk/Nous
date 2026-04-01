import { resolve } from "node:path";
import { rm, writeFile } from "node:fs/promises";
import type {
	CapabilitySet,
	PermissionCallback,
	PermissionRequest,
	RollbackExecutionResult,
	ToolDef,
	ToolResult,
	ToolRollbackPlan,
} from "@nous/core";
import { CapabilityDeniedError, expandCapability, prefixedId } from "@nous/core";
import {
	assertCapabilities,
	assertPathAccess,
	assertShellCommandAccess,
} from "./capability-guard.ts";

export interface ToolExecutionContext {
	signal: AbortSignal;
}

export interface ToolExecutionOptions {
	signal?: AbortSignal;
	onPermissionNeeded?: PermissionCallback;
}

export interface ToolHandlerOutput {
	output: string;
	rollbackPlan?: ToolRollbackPlan;
}

export type ToolHandlerResult = string | ToolHandlerOutput;

export type ToolHandler = (
	input: Record<string, unknown>,
	context: ToolExecutionContext,
) => Promise<ToolHandlerResult>;

export class ToolExecutor {
	private handlers = new Map<string, ToolHandler>();

	registerHandler(toolName: string, handler: ToolHandler): void {
		this.handlers.set(toolName, handler);
	}

	async execute(
		tool: ToolDef,
		input: Record<string, unknown>,
		capabilities: CapabilitySet,
		options: ToolExecutionOptions = {},
	): Promise<ToolResult> {
		const handler = this.handlers.get(tool.name);
		if (!handler) {
			return {
				id: prefixedId("tr"),
				toolName: tool.name,
				success: false,
				output: `No handler registered for tool: ${tool.name}`,
				durationMs: 0,
				sideEffectClass: tool.sideEffectClass,
				approvalMode: tool.approvalMode,
				rollbackHint: tool.rollbackHint,
				rollbackPlan: defaultRollbackPlan(tool),
			};
		}

		const start = Date.now();
		const timeoutMs = tool.timeoutMs ?? 30000;
		let abortWaiter:
			| {
					promise: Promise<never>;
					dispose(): void;
			  }
			| undefined;

		try {
			// Check capabilities — with optional interactive approval
			await this.checkPermissions(tool, input, capabilities, options.onPermissionNeeded);
			throwIfAborted(options.signal, tool.name);
			abortWaiter = createAbortWaiter(options.signal, tool.name);

			const handlerResult = await Promise.race([
				handler(input, {
					signal: options.signal ?? new AbortController().signal,
				}),
				timeout(timeoutMs, tool.name),
				abortWaiter.promise,
			]);
			abortWaiter.dispose();
			const normalized = normalizeHandlerResult(handlerResult, tool);

			return {
				id: prefixedId("tr"),
				toolName: tool.name,
				success: true,
				output: normalized.output,
				durationMs: Date.now() - start,
				sideEffectClass: tool.sideEffectClass,
				approvalMode: tool.approvalMode,
				rollbackHint: tool.rollbackHint,
				rollbackPlan: normalized.rollbackPlan,
			};
		} catch (err) {
			const interrupted = err instanceof ToolInterruptedError;
			return {
				id: prefixedId("tr"),
				toolName: tool.name,
				success: false,
				output: (err as Error).message,
				durationMs: Date.now() - start,
				interrupted,
				sideEffectClass: tool.sideEffectClass,
				approvalMode: tool.approvalMode,
				rollbackHint: tool.rollbackHint,
				rollbackPlan: defaultRollbackPlan(tool),
			};
		} finally {
			abortWaiter?.dispose();
		}
	}

	async rollback(
		plan: ToolRollbackPlan,
		capabilities: CapabilitySet,
	): Promise<RollbackExecutionResult> {
		try {
			switch (plan.kind) {
				case "restore_file":
					assertPathAccess(capabilities, "fs.write", plan.path);
					await writeFile(plan.path, plan.content, "utf-8");
					return {
						success: true,
						output: `Restored file contents at ${plan.path}`,
					};
				case "delete_file":
					assertPathAccess(capabilities, "fs.write", plan.path);
					await rm(plan.path, { force: true });
					return {
						success: true,
						output: `Deleted file created during execution: ${plan.path}`,
					};
				case "manual":
					return {
						success: false,
						output: `Manual rollback required: ${plan.description}`,
					};
			}
		} catch (error) {
			return {
				success: false,
				output: (error as Error).message,
			};
		}
	}

	/**
	 * Check capabilities with optional interactive approval.
	 * If the hard check fails but a permissionCallback is provided,
	 * invoke it to let the user approve the action.
	 */
	private async checkPermissions(
		tool: ToolDef,
		input: Record<string, unknown>,
		capabilities: CapabilitySet,
		onPermissionNeeded?: PermissionCallback,
	): Promise<void> {
		try {
			assertCapabilities(tool, capabilities);
			assertToolInputAccess(tool, input, capabilities);
		} catch (err) {
			if (!(err instanceof CapabilityDeniedError) || !onPermissionNeeded) {
				throw err;
			}

			const request = buildPermissionRequest(tool, input, err);
			const decision = await onPermissionNeeded(request);

			if (decision === "deny") {
				throw err;
			}
			if (decision === "allow_session") {
				expandCapability(capabilities, request);
			}
			// allow_once and allow_session both proceed to execution
		}
	}
}

function buildPermissionRequest(
	tool: ToolDef,
	input: Record<string, unknown>,
	err: CapabilityDeniedError,
): PermissionRequest {
	const base: PermissionRequest = {
		capability: err.capability as PermissionRequest["capability"],
		toolName: tool.name,
		detail: err.detail ?? err.message,
	};

	switch (tool.name) {
		case "file_read":
			base.path = resolve(String(input.path ?? ""));
			break;
		case "file_write":
			base.path = resolve(String(input.path ?? ""));
			break;
		case "glob":
		case "grep":
			base.path = resolve(String(input.path ?? input.cwd ?? process.cwd()));
			break;
		case "shell":
			base.command = extractExecutableFromCommand(
				String(input.command ?? ""),
			);
			break;
		default:
			{
				const commands = resolveDeclaredShellCommands(tool, input);
				if (commands.length > 0) {
					base.command = commands[0];
				}
			}
			break;
	}

	return base;
}

function extractExecutableFromCommand(command: string): string | undefined {
	const trimmed = command.trim();
	if (!trimmed) return undefined;
	return trimmed.split(/\s+/)[0];
}

function normalizeHandlerResult(
	result: ToolHandlerResult,
	tool: ToolDef,
): ToolHandlerOutput {
	if (typeof result === "string") {
		return {
			output: result,
			rollbackPlan: defaultRollbackPlan(tool),
		};
	}

	return {
		output: result.output,
		rollbackPlan: result.rollbackPlan ?? defaultRollbackPlan(tool),
	};
}

function defaultRollbackPlan(tool: ToolDef): ToolRollbackPlan | undefined {
	if (tool.rollbackPolicy === "manual") {
		const description =
			tool.rollbackHint?.trim() ||
			`Manual rollback required for tool ${tool.name}.`;
		return {
			kind: "manual",
			description,
		};
	}
	return undefined;
}

function assertToolInputAccess(
	tool: ToolDef,
	input: Record<string, unknown>,
	capabilities: CapabilitySet,
): void {
	for (const command of resolveDeclaredShellCommands(tool, input)) {
		assertShellCommandAccess(capabilities, command);
	}

	switch (tool.name) {
		case "shell":
			assertShellCommandAccess(capabilities, String(input.command ?? ""));
			return;
		case "file_read":
			assertPathAccess(capabilities, "fs.read", String(input.path ?? ""));
			return;
		case "file_write":
			assertPathAccess(capabilities, "fs.write", String(input.path ?? ""));
			return;
		case "glob":
			assertPathAccess(
				capabilities,
				"fs.read",
				String(input.cwd ?? process.cwd()),
			);
			return;
		case "grep":
			assertPathAccess(
				capabilities,
				"fs.read",
				String(input.path ?? process.cwd()),
			);
			return;
		default:
			return;
	}
}

function resolveDeclaredShellCommands(
	tool: ToolDef,
	input: Record<string, unknown>,
): string[] {
	const commands = [...(tool.invokesShellCommands ?? [])];

	if (tool.shellCommandInputKey) {
		const raw = input[tool.shellCommandInputKey];
		if (typeof raw !== "string" || raw.trim().length === 0) {
			throw new Error(
				`Tool '${tool.name}' requires a non-empty string for '${tool.shellCommandInputKey}' to resolve its shell command.`,
			);
		}
		const command = raw.trim();
		if (
			tool.shellCommandAllowlist &&
			tool.shellCommandAllowlist.length > 0 &&
			!tool.shellCommandAllowlist.includes(command)
		) {
			throw new Error(
				`Tool '${tool.name}' received unsupported shell command '${command}'. Allowed: ${tool.shellCommandAllowlist.join(", ")}`,
			);
		}
		commands.push(command);
	}

	return [...new Set(commands)];
}

function timeout(ms: number, toolName: string): Promise<never> {
	return new Promise((_, reject) =>
		setTimeout(
			() => reject(new Error(`Tool '${toolName}' timed out after ${ms}ms`)),
			ms,
		),
	);
}

function createAbortWaiter(
	signal: AbortSignal | undefined,
	toolName: string,
): {
	promise: Promise<never>;
	dispose(): void;
} {
	if (!signal) {
		return {
			promise: new Promise<never>(() => {}),
			dispose() {},
		};
	}
	if (signal.aborted) {
		return {
			promise: Promise.reject(new ToolInterruptedError(toolName)),
			dispose() {},
		};
	}
	const listener = () => reject(new ToolInterruptedError(toolName));
	let reject!: (error: ToolInterruptedError) => void;
	const promise = new Promise<never>((_, rejectFn) => {
		reject = rejectFn as (error: ToolInterruptedError) => void;
		signal.addEventListener("abort", listener, { once: true });
	});
	return {
		promise,
		dispose() {
			signal.removeEventListener("abort", listener);
		},
	};
}

function throwIfAborted(
	signal: AbortSignal | undefined,
	toolName: string,
): void {
	if (!signal?.aborted) return;
	throw new ToolInterruptedError(toolName);
}

export class ToolInterruptedError extends Error {
	constructor(toolName: string) {
		super(`Tool '${toolName}' was interrupted before completion`);
		this.name = "ToolInterruptedError";
	}
}
