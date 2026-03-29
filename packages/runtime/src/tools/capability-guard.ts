import { resolve } from "node:path";
import type { CapabilityName, CapabilitySet, ToolDef } from "@nous/core";
import { CapabilityDeniedError, hasCapability } from "@nous/core";

/** Check if the agent has all required capabilities for a tool. Throws if not. */
export function assertCapabilities(
	tool: ToolDef,
	capabilities: CapabilitySet,
): void {
	for (const cap of tool.requiredCapabilities) {
		if (!hasCapability(capabilities, cap)) {
			throw new CapabilityDeniedError(cap, tool.name);
		}
	}
}

/** Check path-level access for fs.read and fs.write capabilities */
export function assertPathAccess(
	capabilities: CapabilitySet,
	capability: "fs.read" | "fs.write",
	path: string,
): void {
	const normalizedPath = resolve(path);
	const val = capabilities[capability];
	if (val === false) {
		throw new CapabilityDeniedError(capability, `path: ${path}`);
	}
	if (typeof val === "object" && "paths" in val) {
		const allowed = val.paths.some((p) =>
			p === "*" ? true : normalizedPath.startsWith(resolvePathPattern(p)),
		);
		if (!allowed) {
			throw new CapabilityDeniedError(
				capability,
				`path: ${path} (allowed: ${val.paths.join(", ")})`,
			);
		}
	}
}

export function assertShellCommandAccess(
	capabilities: CapabilitySet,
	command: string,
): void {
	const val = capabilities["shell.exec"];
	const executable = extractExecutable(command);
	if (val === false || !executable) {
		throw new CapabilityDeniedError("shell.exec", `command: ${command}`);
	}
	if (typeof val === "object" && "allowlist" in val) {
		const allowed = val.allowlist.some(
			(entry) => entry === "*" || entry === executable,
		);
		if (!allowed) {
			throw new CapabilityDeniedError(
				"shell.exec",
				`command: ${executable} (allowed: ${val.allowlist.join(", ")})`,
			);
		}
	}
}

/** Check domain-level access for network.http */
export function assertDomainAccess(
	capabilities: CapabilitySet,
	domain: string,
): void {
	const val = capabilities["network.http"];
	if (val === false) {
		throw new CapabilityDeniedError("network.http", `domain: ${domain}`);
	}
	if (typeof val === "object" && "domains" in val) {
		const allowed = val.domains.some(
			(d) => domain === d || domain.endsWith(`.${d}`),
		);
		if (!allowed) {
			throw new CapabilityDeniedError(
				"network.http",
				`domain: ${domain} (allowed: ${val.domains.join(", ")})`,
			);
		}
	}
}

function extractExecutable(command: string): string | undefined {
	const trimmed = command.trim();
	if (!trimmed) return undefined;
	return trimmed.split(/\s+/)[0];
}

function resolvePathPattern(pattern: string): string {
	return resolve(pattern.replace(/\/\*\*$/, ""));
}
