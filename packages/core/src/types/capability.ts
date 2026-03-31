/**
 * Capability Token System
 *
 * Agents operate under the principle of least privilege.
 * Effective capability at runtime = AgentCapabilities ∩ TaskRequiredCapabilities ∩ IntentConstraints
 */

export interface CapabilitySet {
	"shell.exec": false | { allowlist: string[] };
	"fs.read": false | { paths: string[] };
	"fs.write": false | { paths: string[] };
	"browser.control": boolean;
	"network.http": false | { domains: string[] };
	spawn_subagent: boolean;
	"memory.write": boolean;
	escalate_to_human: boolean;
}

export type CapabilityName = keyof CapabilitySet;

export const CAPABILITY_NAMES = [
	"shell.exec",
	"fs.read",
	"fs.write",
	"browser.control",
	"network.http",
	"spawn_subagent",
	"memory.write",
	"escalate_to_human",
] as const satisfies readonly CapabilityName[];

export function isCapabilityName(value: string): value is CapabilityName {
	return (CAPABILITY_NAMES as readonly string[]).includes(value);
}

/** Check if a specific capability is granted */
export function hasCapability(
	caps: CapabilitySet,
	name: CapabilityName,
): boolean {
	const val = caps[name] as boolean | false | Record<string, unknown>;
	if (val === false) return false;
	if (val === true) return true;
	return typeof val === "object" && val !== null;
}

/** Intersect two capability sets (least privilege) */
export function intersectCapabilities(
	a: CapabilitySet,
	b: CapabilitySet,
): CapabilitySet {
	return {
		"shell.exec": intersectListCap(
			a["shell.exec"],
			b["shell.exec"],
			"allowlist",
		),
		"fs.read": intersectListCap(a["fs.read"], b["fs.read"], "paths"),
		"fs.write": intersectListCap(a["fs.write"], b["fs.write"], "paths"),
		"browser.control": a["browser.control"] && b["browser.control"],
		"network.http": intersectListCap(
			a["network.http"],
			b["network.http"],
			"domains",
		),
		spawn_subagent: a.spawn_subagent && b.spawn_subagent,
		"memory.write": a["memory.write"] && b["memory.write"],
		escalate_to_human: a.escalate_to_human && b.escalate_to_human,
	};
}

function intersectListCap<K extends string>(
	a: false | Record<K, string[]>,
	b: false | Record<K, string[]>,
	key: K,
): false | Record<K, string[]> {
	if (a === false || b === false) return false;
	// Intersect: keep only items present in both lists
	const aList = a[key];
	const bSet = new Set(b[key]);
	const result = aList.filter((item) => bSet.has(item));
	if (result.length === 0) return false;
	return { [key]: result } as Record<K, string[]>;
}

/** Default capability set: deny everything */
export const DENY_ALL: CapabilitySet = {
	"shell.exec": false,
	"fs.read": false,
	"fs.write": false,
	"browser.control": false,
	"network.http": false,
	spawn_subagent: false,
	"memory.write": false,
	escalate_to_human: false,
};

// --- Permission approval callback types ---

export interface PermissionRequest {
	capability: CapabilityName;
	toolName: string;
	detail: string;
	/** For fs.read/fs.write — the resolved path being accessed */
	path?: string;
	/** For shell.exec — the executable name */
	command?: string;
	/** For network.http — the domain being accessed */
	domain?: string;
}

export type PermissionDecision = "allow_once" | "allow_session" | "deny";

/**
 * Callback invoked when a tool needs a capability not in the auto-allowed set.
 * Returns a decision: allow this once, allow for the rest of the session, or deny.
 */
export type PermissionCallback = (
	request: PermissionRequest,
) => Promise<PermissionDecision>;

/**
 * Expand a CapabilitySet in-place to include a newly approved permission.
 * Mutates `caps` so future calls from the same AgentRuntime see the expansion.
 */
export function expandCapability(
	caps: CapabilitySet,
	request: PermissionRequest,
): void {
	switch (request.capability) {
		case "fs.read": {
			if (!request.path) break;
			const cur = caps["fs.read"];
			if (cur === false) {
				caps["fs.read"] = { paths: [request.path] };
			} else {
				cur.paths.push(request.path);
			}
			break;
		}
		case "fs.write": {
			if (!request.path) break;
			const cur = caps["fs.write"];
			if (cur === false) {
				caps["fs.write"] = { paths: [request.path] };
			} else {
				cur.paths.push(request.path);
			}
			break;
		}
		case "shell.exec": {
			if (!request.command) break;
			const cur = caps["shell.exec"];
			if (cur === false) {
				caps["shell.exec"] = { allowlist: [request.command] };
			} else {
				cur.allowlist.push(request.command);
			}
			break;
		}
		case "network.http": {
			if (!request.domain) break;
			const cur = caps["network.http"];
			if (cur === false) {
				caps["network.http"] = { domains: [request.domain] };
			} else {
				cur.domains.push(request.domain);
			}
			break;
		}
		case "browser.control":
			caps["browser.control"] = true;
			break;
		case "spawn_subagent":
			caps.spawn_subagent = true;
			break;
		case "memory.write":
			caps["memory.write"] = true;
			break;
		case "escalate_to_human":
			caps.escalate_to_human = true;
			break;
	}
}
