import { createInterface } from "node:readline";
import type { PermissionCallback, PermissionDecision, PermissionRequest } from "@nous/core";
import { colors } from "./colors.ts";

/**
 * Create a PermissionCallback that prompts the user on stdin/stdout.
 * The prompt shows what capability is needed and lets the user approve or deny.
 */
export function createInteractivePermissionCallback(): PermissionCallback {
	return async (request: PermissionRequest): Promise<PermissionDecision> => {
		const label = formatPermissionLabel(request);
		const detail = formatPermissionDetail(request);

		console.log();
		console.log(`  ${colors.yellow("⚠")} ${colors.bold("Permission needed:")} ${label}`);
		if (detail) {
			console.log(`    ${colors.dim(detail)}`);
		}

		const answer = await askUser(
			`    ${colors.cyan("Allow?")} [${colors.bold("y")}]es once / [${colors.bold("a")}]lways / [${colors.bold("n")}]o: `,
		);

		const normalized = answer.trim().toLowerCase();
		if (normalized === "a" || normalized === "always") {
			console.log(`    ${colors.green("✓")} Allowed for this session`);
			return "allow_session";
		}
		if (normalized === "y" || normalized === "yes" || normalized === "") {
			console.log(`    ${colors.green("✓")} Allowed once`);
			return "allow_once";
		}
		console.log(`    ${colors.red("✗")} Denied`);
		return "deny";
	};
}

/**
 * Create a PermissionCallback that auto-approves everything (--yes mode).
 */
export function createAutoApprovePermissionCallback(): PermissionCallback {
	return async (request: PermissionRequest): Promise<PermissionDecision> => {
		const label = formatPermissionLabel(request);
		console.log(`  ${colors.yellow("⚠")} ${colors.dim("Auto-approved:")} ${label}`);
		return "allow_session";
	};
}

function formatPermissionLabel(request: PermissionRequest): string {
	switch (request.capability) {
		case "fs.read":
			return `Read file: ${request.path ?? "unknown"}`;
		case "fs.write":
			return `Write file: ${request.path ?? "unknown"}`;
		case "shell.exec":
			return `Execute command: ${request.command ?? "unknown"}`;
		case "network.http":
			return `HTTP request to: ${request.domain ?? "unknown"}`;
		case "browser.control":
			return "Browser control";
		case "spawn_subagent":
			return "Spawn sub-agent";
		case "memory.write":
			return "Write to memory";
		case "escalate_to_human":
			return "Escalate to human";
		default:
			return `${request.capability} via ${request.toolName}`;
	}
}

function formatPermissionDetail(request: PermissionRequest): string {
	return `Tool: ${request.toolName} — ${request.detail}`;
}

function askUser(prompt: string): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(prompt, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}
