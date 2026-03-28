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
	const val = capabilities[capability];
	if (val === false) {
		throw new CapabilityDeniedError(capability, `path: ${path}`);
	}
	if (typeof val === "object" && "paths" in val) {
		const allowed = val.paths.some((p) => path.startsWith(p) || p === "*");
		if (!allowed) {
			throw new CapabilityDeniedError(
				capability,
				`path: ${path} (allowed: ${val.paths.join(", ")})`,
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
