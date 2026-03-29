import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	type CommunicationPolicy,
	DEFAULT_COMMUNICATION_POLICY,
} from "@nous/core";
import type { NousIdentity } from "../network/identity.ts";
import { generateIdentity } from "../network/identity.ts";
import {
	type NousConfigLoadOptions,
	ensureNousHome,
	getNousPaths,
} from "./home.ts";

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;

type JsonObject = {
	[key: string]: JsonValue;
};

export interface NousNetworkPaths {
	identityPath: string;
	exportsDir: string;
	importsDir: string;
	importedSkillsDir: string;
	policyPath: string;
}

export function getNousNetworkPaths(
	options: NousConfigLoadOptions = {},
): NousNetworkPaths {
	const paths = getNousPaths(options);
	return {
		identityPath: join(paths.networkDir, "identity.json"),
		exportsDir: join(paths.networkDir, "exports"),
		importsDir: join(paths.networkDir, "imports"),
		importedSkillsDir: join(paths.skillsDir, "imported"),
		policyPath: join(paths.configDir, "network.json"),
	};
}

export function loadCommunicationPolicy(
	options: NousConfigLoadOptions = {},
): CommunicationPolicy {
	ensureNousHome(options);
	const paths = getNousNetworkPaths(options);
	const parsed = readJson(paths.policyPath);
	return deepMerge(
		asJsonObject(DEFAULT_COMMUNICATION_POLICY) ?? {},
		parsed ?? {},
	) as unknown as CommunicationPolicy;
}

export function saveCommunicationPolicy(
	policy: CommunicationPolicy,
	options: NousConfigLoadOptions = {},
): void {
	ensureNousHome(options);
	const paths = getNousNetworkPaths(options);
	writeFileSync(paths.policyPath, `${JSON.stringify(policy, null, 2)}\n`);
}

export function updateCommunicationPolicy(
	patch: Partial<CommunicationPolicy>,
	options: NousConfigLoadOptions = {},
): CommunicationPolicy {
	const current = loadCommunicationPolicy(options);
	const next = deepMerge(
		asJsonObject(current) ?? {},
		asJsonObject(patch) ?? {},
	) as unknown as CommunicationPolicy;
	saveCommunicationPolicy(next, options);
	return next;
}

export function setNetworkEnabled(
	enabled: boolean,
	options: NousConfigLoadOptions = {},
): CommunicationPolicy {
	return updateCommunicationPolicy({ networkEnabled: enabled }, options);
}

export async function ensureNousIdentity(
	options: NousConfigLoadOptions = {},
): Promise<NousIdentity> {
	ensureNousHome(options);
	const paths = getNousNetworkPaths(options);
	mkdirSync(paths.exportsDir, { recursive: true });
	mkdirSync(paths.importsDir, { recursive: true });
	mkdirSync(paths.importedSkillsDir, { recursive: true });

	const existing = loadNousIdentity(options);
	if (existing) return existing;

	const identity = await generateIdentity();
	writeFileSync(paths.identityPath, `${JSON.stringify(identity, null, 2)}\n`);
	return identity;
}

export function loadNousIdentity(
	options: NousConfigLoadOptions = {},
): NousIdentity | undefined {
	const paths = getNousNetworkPaths(options);
	const parsed = readJson(paths.identityPath);
	if (!parsed) return undefined;
	const instanceId = readString(parsed.instanceId);
	const publicKey = readString(parsed.publicKey);
	const privateKey = readString(parsed.privateKey);
	const createdAt = readString(parsed.createdAt);
	if (!instanceId || !publicKey || !privateKey || !createdAt) return undefined;
	return {
		instanceId,
		publicKey,
		privateKey,
		createdAt,
	};
}

function readJson(path: string): JsonObject | undefined {
	if (!existsSync(path)) return undefined;
	try {
		return asJsonObject(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return undefined;
	}
}

function deepMerge(left: JsonObject, right: JsonObject): JsonObject {
	const result: JsonObject = { ...left };
	for (const [key, value] of Object.entries(right)) {
		if (isPlainObject(result[key]) && isPlainObject(value)) {
			result[key] = deepMerge(result[key] as JsonObject, value as JsonObject);
			continue;
		}
		result[key] = value;
	}
	return result;
}

function isPlainObject(value: JsonValue | undefined): boolean {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asJsonObject(value: unknown): JsonObject | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return undefined;
	return value as JsonObject;
}

function readString(value: JsonValue | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
