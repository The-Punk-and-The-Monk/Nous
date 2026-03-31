import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CapabilitySet, PermissionContext } from "@nous/core";
import { DENY_ALL } from "@nous/core";
import { type NousConfigLoadOptions, getNousPaths } from "./home.ts";

export type PermissionApproval =
	| "auto_allow"
	| "ask_once"
	| "always_ask"
	| "deny";

export type PermissionAction =
	| "fs.read"
	| "fs.write"
	| "shell.exec"
	| "network.http"
	| "browser.control"
	| "spawn_subagent"
	| "memory.write"
	| "evolution.self_mutate"
	| "escalate_to_human";

export type PermissionScope =
	| { type: "directory"; paths: string[] }
	| { type: "command"; allowlist: string[] }
	| { type: "network"; domains: string[] }
	| { type: "system"; level: "user" | "root" }
	| { type: "all" };

export interface PermissionRule {
	action: PermissionAction;
	scope: PermissionScope;
	approval: PermissionApproval;
	grantedAt?: string;
	grantedContext?: string;
}

export interface PermissionPolicy {
	grantAll: boolean;
	rules: PermissionRule[];
}

export interface PermissionResolutionInput {
	projectRoot?: string;
}

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };

export function createDefaultPermissionPolicy(): PermissionPolicy {
	return {
		grantAll: false,
		rules: [
			{
				action: "fs.read",
				scope: { type: "directory", paths: ["./**"] },
				approval: "auto_allow",
			},
			{
				action: "fs.write",
				scope: { type: "directory", paths: ["./**"] },
				approval: "ask_once",
			},
			{
				action: "shell.exec",
				scope: {
					type: "command",
					allowlist: [
						"ls",
						"cat",
						"head",
						"tail",
						"wc",
						"find",
						"which",
						"echo",
						"date",
					],
				},
				approval: "auto_allow",
			},
			{
				action: "shell.exec",
				scope: {
					type: "command",
					allowlist: ["git", "bun", "npm", "node", "tsc", "biome"],
				},
				approval: "ask_once",
			},
			{
				action: "shell.exec",
				scope: { type: "command", allowlist: [] },
				approval: "always_ask",
			},
			{
				action: "network.http",
				scope: { type: "network", domains: [] },
				approval: "always_ask",
			},
			{
				action: "browser.control",
				scope: { type: "all" },
				approval: "always_ask",
			},
			{
				action: "spawn_subagent",
				scope: { type: "all" },
				approval: "ask_once",
			},
			{
				action: "memory.write",
				scope: { type: "all" },
				approval: "auto_allow",
			},
			{
				action: "evolution.self_mutate",
				scope: { type: "all" },
				approval: "always_ask",
			},
			{
				action: "escalate_to_human",
				scope: { type: "all" },
				approval: "auto_allow",
			},
		],
	};
}

export function loadPermissionPolicy(
	options: NousConfigLoadOptions = {},
): PermissionPolicy {
	const paths = getNousPaths(options);
	const filePath = join(paths.configDir, "permissions.json");
	const data = readJson(filePath);
	if (!data) return createDefaultPermissionPolicy();

	const rules = Array.isArray(data.rules)
		? data.rules
				.map(parsePermissionRule)
				.filter((rule): rule is PermissionRule => Boolean(rule))
		: createDefaultPermissionPolicy().rules;
	return {
		grantAll: data.grantAll === true,
		rules,
	};
}

export function savePermissionPolicy(
	policy: PermissionPolicy,
	options: NousConfigLoadOptions = {},
): void {
	const paths = getNousPaths(options);
	const filePath = join(paths.configDir, "permissions.json");
	writeFileSync(filePath, `${JSON.stringify(policy, null, 2)}\n`);
}

export function resetPermissionPolicy(
	options: NousConfigLoadOptions = {},
): PermissionPolicy {
	const policy = createDefaultPermissionPolicy();
	savePermissionPolicy(policy, options);
	return policy;
}

export function resolvePermissionCapabilities(
	policy: PermissionPolicy,
	input: PermissionResolutionInput = {},
): CapabilitySet {
	if (policy.grantAll) {
		return {
			"shell.exec": { allowlist: ["*"] },
			"fs.read": { paths: ["*"] },
			"fs.write": { paths: ["*"] },
			"browser.control": true,
			"network.http": { domains: ["*"] },
			spawn_subagent: true,
			"memory.write": true,
			escalate_to_human: true,
		};
	}

	const projectRoot = input.projectRoot
		? resolve(input.projectRoot)
		: undefined;
	const allowedShell = new Set<string>();
	const allowedReadPaths = new Set<string>();
	const allowedWritePaths = new Set<string>();
	const allowedDomains = new Set<string>();
	let browserControl = false;
	let spawnSubagent = false;
	let memoryWrite = false;
	let escalateToHuman = false;

	for (const rule of policy.rules) {
		if (rule.approval !== "auto_allow") continue;

		switch (rule.action) {
			case "shell.exec":
				if (rule.scope.type === "all") {
					allowedShell.add("*");
				} else if (rule.scope.type === "command") {
					for (const command of rule.scope.allowlist) {
						allowedShell.add(command);
					}
				}
				break;
			case "fs.read":
				if (rule.scope.type === "all") {
					allowedReadPaths.add("*");
				} else if (rule.scope.type === "directory") {
					for (const path of rule.scope.paths) {
						allowedReadPaths.add(resolvePermissionPath(path, projectRoot));
					}
				}
				break;
			case "fs.write":
				if (rule.scope.type === "all") {
					allowedWritePaths.add("*");
				} else if (rule.scope.type === "directory") {
					for (const path of rule.scope.paths) {
						allowedWritePaths.add(resolvePermissionPath(path, projectRoot));
					}
				}
				break;
			case "network.http":
				if (rule.scope.type === "all") {
					allowedDomains.add("*");
				} else if (rule.scope.type === "network") {
					for (const domain of rule.scope.domains) {
						allowedDomains.add(domain);
					}
				}
				break;
			case "browser.control":
				browserControl = true;
				break;
			case "spawn_subagent":
				spawnSubagent = true;
				break;
			case "memory.write":
				memoryWrite = true;
				break;
			case "escalate_to_human":
				escalateToHuman = true;
				break;
			default:
				break;
		}
	}

	return {
		...DENY_ALL,
		"shell.exec":
			allowedShell.size > 0 ? { allowlist: [...allowedShell] } : false,
		"fs.read":
			allowedReadPaths.size > 0 ? { paths: [...allowedReadPaths] } : false,
		"fs.write":
			allowedWritePaths.size > 0 ? { paths: [...allowedWritePaths] } : false,
		"network.http":
			allowedDomains.size > 0 ? { domains: [...allowedDomains] } : false,
		"browser.control": browserControl,
		spawn_subagent: spawnSubagent,
		"memory.write": memoryWrite,
		escalate_to_human: escalateToHuman,
	};
}

export function describePermissionBoundary(
	policy: PermissionPolicy,
	input: PermissionResolutionInput = {},
): PermissionContext {
	if (policy.grantAll) {
		return {
			autoAllowed: ["All actions are auto-allowed in the current scope."],
			approvalRequired: [],
			denied: [],
			explanation:
				"Grant-all is enabled, so Nous can act without per-action approval checks.",
		};
	}

	const autoAllowed = new Set<string>();
	const approvalRequired = new Set<string>();
	const denied = new Set<string>();

	for (const rule of policy.rules) {
		const line = formatPermissionRule(rule, input);
		if (!line) continue;
		switch (rule.approval) {
			case "auto_allow":
				autoAllowed.add(line);
				break;
			case "deny":
				denied.add(line);
				break;
			case "ask_once":
				approvalRequired.add(`${line} (will prompt user on first use — go ahead and use the tool)`);
				break;
			case "always_ask":
				approvalRequired.add(`${line} (will prompt user each time — go ahead and use the tool)`);
				break;
			default:
				break;
		}
	}

	const autoAllowedLines = [...autoAllowed];
	const approvalRequiredLines = [...approvalRequired];
	const deniedLines = [...denied];

	return {
		autoAllowed: autoAllowedLines,
		approvalRequired: approvalRequiredLines,
		denied: deniedLines,
		explanation: buildPermissionExplanation({
			autoAllowed: autoAllowedLines,
			approvalRequired: approvalRequiredLines,
			denied: deniedLines,
		}),
	};
}

export function revokePermissionAction(
	policy: PermissionPolicy,
	action: PermissionAction,
): PermissionPolicy {
	return {
		grantAll: false,
		rules: policy.rules.map((rule) =>
			rule.action === action ? { ...rule, approval: "deny" as const } : rule,
		),
	};
}

export function allowPermissionAction(
	policy: PermissionPolicy,
	action: PermissionAction,
): PermissionPolicy {
	return {
		grantAll: false,
		rules: policy.rules.map((rule) =>
			rule.action === action
				? { ...rule, approval: "auto_allow" as const }
				: rule,
		),
	};
}

function resolvePermissionPath(path: string, projectRoot?: string): string {
	if (path === "*") return "*";
	if (path.startsWith("./")) {
		return normalizePermissionPath(
			join(projectRoot ?? process.cwd(), path.slice(2)),
		);
	}
	return normalizePermissionPath(path);
}

function normalizePermissionPath(path: string): string {
	return resolve(path).replace(/\\/g, "/");
}

function formatPermissionRule(
	rule: PermissionRule,
	input: PermissionResolutionInput,
): string | undefined {
	switch (rule.action) {
		case "fs.read":
		case "fs.write":
			if (rule.scope.type === "all") {
				return `${rule.action} on any path`;
			}
			if (rule.scope.type === "directory") {
				const paths = rule.scope.paths.map((path) =>
					resolvePermissionPath(path, input.projectRoot),
				);
				return `${rule.action} under ${paths.join(", ")}`;
			}
			return undefined;
		case "shell.exec":
			if (rule.scope.type === "all") return "shell.exec for any command";
			if (rule.scope.type === "command") {
				if (rule.scope.allowlist.length === 0) {
					return "shell.exec for commands outside the allowlist";
				}
				return `shell.exec for ${rule.scope.allowlist.join(", ")}`;
			}
			return undefined;
		case "network.http":
			if (rule.scope.type === "all") return "network.http to any domain";
			if (rule.scope.type === "network") {
				if (rule.scope.domains.length === 0) {
					return "network.http to domains not explicitly auto-allowed";
				}
				return `network.http to ${rule.scope.domains.join(", ")}`;
			}
			return undefined;
		case "browser.control":
			return "browser.control";
		case "spawn_subagent":
			return "spawn_subagent";
		case "memory.write":
			return "memory.write";
		case "evolution.self_mutate":
			return "evolution.self_mutate";
		case "escalate_to_human":
			return "escalate_to_human";
		default:
			return undefined;
	}
}

function buildPermissionExplanation(input: {
	autoAllowed: string[];
	approvalRequired: string[];
	denied: string[];
}): string {
	const parts: string[] = [];
	if (input.autoAllowed.length > 0) {
		parts.push(`Auto-allowed: ${input.autoAllowed.slice(0, 2).join("; ")}`);
	}
	if (input.approvalRequired.length > 0) {
		parts.push(
			`Needs approval (go ahead and use the tool, the runtime handles prompting): ${input.approvalRequired.slice(0, 2).join("; ")}`,
		);
	}
	if (input.denied.length > 0) {
		parts.push(`Denied: ${input.denied.slice(0, 2).join("; ")}`);
	}
	return parts.length > 0
		? parts.join(" ")
		: "No permissions are currently granted for this scope.";
}

function parsePermissionRule(value: JsonValue): PermissionRule | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return undefined;
	const object = value as JsonObject;
	const action = readAction(object.action);
	const approval = readApproval(object.approval);
	const scope = parsePermissionScope(object.scope);
	if (!action || !approval || !scope) return undefined;
	return {
		action,
		approval,
		scope,
		grantedAt:
			typeof object.grantedAt === "string" ? object.grantedAt : undefined,
		grantedContext:
			typeof object.grantedContext === "string"
				? object.grantedContext
				: undefined,
	};
}

function parsePermissionScope(
	value: JsonValue | undefined,
): PermissionScope | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return undefined;
	const object = value as JsonObject;
	switch (object.type) {
		case "directory":
			return {
				type: "directory",
				paths: readStringArray(object.paths),
			};
		case "command":
			return {
				type: "command",
				allowlist: readStringArray(object.allowlist),
			};
		case "network":
			return {
				type: "network",
				domains: readStringArray(object.domains),
			};
		case "system": {
			const level = object.level;
			if (level === "user" || level === "root") {
				return { type: "system", level };
			}
			return undefined;
		}
		case "all":
			return { type: "all" };
		default:
			return undefined;
	}
}

function readAction(
	value: JsonValue | undefined,
): PermissionAction | undefined {
	switch (value) {
		case "fs.read":
		case "fs.write":
		case "shell.exec":
		case "network.http":
		case "browser.control":
		case "spawn_subagent":
		case "memory.write":
		case "evolution.self_mutate":
		case "escalate_to_human":
			return value;
		default:
			return undefined;
	}
}

function readApproval(
	value: JsonValue | undefined,
): PermissionApproval | undefined {
	switch (value) {
		case "auto_allow":
		case "ask_once":
		case "always_ask":
		case "deny":
			return value;
		default:
			return undefined;
	}
}

function readStringArray(value: JsonValue | undefined): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function readJson(path: string): JsonObject | undefined {
	if (!existsSync(path)) return undefined;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return undefined;
		}
		return parsed as JsonObject;
	} catch {
		return undefined;
	}
}
