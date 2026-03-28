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
