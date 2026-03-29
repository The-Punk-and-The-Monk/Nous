import {
	type PermissionAction,
	type PermissionPolicy,
	allowPermissionAction,
	loadPermissionPolicy,
	resetPermissionPolicy,
	revokePermissionAction,
	savePermissionPolicy,
} from "../../config/permissions.ts";
import type { EnvLike } from "../provider.ts";
import { colors } from "../ui/colors.ts";

export function permissionsCommand(
	args: string[],
	options: { env?: EnvLike } = {},
): void {
	const env = options.env ?? process.env;
	const action = args[0] ?? "show";

	if (action === "show") {
		printPolicy(loadPermissionPolicy({ env }));
		return;
	}

	if (action === "grant-all") {
		const policy = loadPermissionPolicy({ env });
		policy.grantAll = true;
		savePermissionPolicy(policy, { env });
		console.log(`\n  ${colors.green("Enabled grant-all mode.")}\n`);
		return;
	}

	if (action === "reset") {
		resetPermissionPolicy({ env });
		console.log(
			`\n  ${colors.green("Reset permission policy to defaults.")}\n`,
		);
		return;
	}

	if ((action === "revoke" || action === "allow") && args[1]) {
		const permissionAction = parsePermissionAction(args[1]);
		if (!permissionAction) {
			console.log(
				`\n  ${colors.red(`Unknown permission action: ${args[1]}`)}\n`,
			);
			return;
		}
		const policy = loadPermissionPolicy({ env });
		const updated =
			action === "revoke"
				? revokePermissionAction(policy, permissionAction)
				: allowPermissionAction(policy, permissionAction);
		savePermissionPolicy(updated, { env });
		console.log(
			`\n  ${colors.green(`${action === "revoke" ? "Revoked" : "Allowed"} ${permissionAction}`)}\n`,
		);
		return;
	}

	printPermissionsHelp();
}

function printPolicy(policy: PermissionPolicy): void {
	console.log(colors.bold("\n  νοῦς — Permission Policy\n"));
	console.log(
		`  Grant-all: ${policy.grantAll ? colors.green("enabled") : colors.dim("disabled")}\n`,
	);

	for (const rule of policy.rules) {
		console.log(
			`  ${colors.cyan(rule.action.padEnd(22))} ${colors.dim(rule.approval.padEnd(12))} ${formatScope(rule)}`,
		);
	}
	console.log();
}

function formatScope(rule: PermissionPolicy["rules"][number]): string {
	switch (rule.scope.type) {
		case "directory":
			return `paths=${rule.scope.paths.join(", ") || "(none)"}`;
		case "command":
			return `allowlist=${rule.scope.allowlist.join(", ") || "(none)"}`;
		case "network":
			return `domains=${rule.scope.domains.join(", ") || "(none)"}`;
		case "system":
			return `level=${rule.scope.level}`;
		case "all":
			return "scope=all";
		default:
			return "scope=unknown";
	}
}

function parsePermissionAction(value: string): PermissionAction | undefined {
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

function printPermissionsHelp(): void {
	console.log(colors.bold("\n  νοῦς — permissions\n"));
	console.log(`  ${colors.dim("nous permissions")} show current rules`);
	console.log(
		`  ${colors.dim("nous permissions grant-all")} enable grant-all mode`,
	);
	console.log(`  ${colors.dim("nous permissions reset")} reset to defaults`);
	console.log(
		`  ${colors.dim("nous permissions revoke <action>")} set matching rules to deny`,
	);
	console.log(
		`  ${colors.dim("nous permissions allow <action>")} set matching rules to auto_allow\n`,
	);
}
