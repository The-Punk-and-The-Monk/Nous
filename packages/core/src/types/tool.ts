import type {
	ToolApprovalMode,
	ToolIdempotency,
	ToolSideEffectClass,
} from "./artifact.ts";
import type { CapabilityName } from "./capability.ts";

export type ToolInterruptibility = "cooperative" | "after_tool" | "never";

export type ToolRollbackPolicy = "none" | "manual" | "handler_declared";

export interface RestoreFileRollbackPlan {
	kind: "restore_file";
	path: string;
	content: string;
}

export interface DeleteFileRollbackPlan {
	kind: "delete_file";
	path: string;
}

export interface ManualRollbackPlan {
	kind: "manual";
	description: string;
}

export type ToolRollbackPlan =
	| RestoreFileRollbackPlan
	| DeleteFileRollbackPlan
	| ManualRollbackPlan;

export interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	requiredCapabilities: CapabilityName[];
	timeoutMs: number;
	sideEffectClass: ToolSideEffectClass;
	idempotency: ToolIdempotency;
	interruptibility: ToolInterruptibility;
	approvalMode?: ToolApprovalMode;
	rollbackPolicy?: ToolRollbackPolicy;
	rollbackHint?: string;
}

export interface ToolResult {
	id: string;
	toolName: string;
	success: boolean;
	output: string;
	durationMs: number;
	interrupted?: boolean;
	sideEffectClass?: ToolSideEffectClass;
	approvalMode?: ToolApprovalMode;
	rollbackHint?: string;
	rollbackPlan?: ToolRollbackPlan;
}

export interface RollbackExecutionResult {
	success: boolean;
	output: string;
}
