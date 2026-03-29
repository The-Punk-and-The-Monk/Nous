import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
	CommunicationPolicy,
	Event,
	ProcedureCandidate,
	ValidationState,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { EventStore } from "@nous/persistence";
import type { NousConfigLoadOptions } from "../config/home.ts";
import {
	ensureNousIdentity,
	getNousNetworkPaths,
	loadCommunicationPolicy,
} from "../config/network.ts";

export interface ProcedureSummaryBundle {
	version: 1;
	kind: "procedure.summary";
	id: string;
	exportedAt: string;
	from: {
		instanceId: string;
		publicKey: string;
	};
	procedure: {
		fingerprint: string;
		title: string;
		sampleIntent: string;
		successCount: number;
		traceIds: string[];
		validationState: ValidationState;
		lastUpdatedAt: string;
	};
	provenance: {
		traceCount: number;
		sourcePath: string;
	};
}

export interface InterNousSeedStatus {
	instanceId: string;
	networkEnabled: boolean;
	validatedProcedures: number;
	importedProcedures: number;
	exportBundles: number;
	importBundles: number;
	policy: CommunicationPolicy;
}

export class InterNousSeedExchange {
	private readonly paths;
	private readonly proceduresDir: string;

	constructor(
		private readonly options: NousConfigLoadOptions & {
			eventStore?: EventStore;
		} = {},
	) {
		this.paths = getNousNetworkPaths(options);
		this.proceduresDir = join(
			dirname(this.paths.importedSkillsDir),
			"procedures",
		);
		for (const dir of [
			this.paths.exportsDir,
			this.paths.importsDir,
			this.paths.importedSkillsDir,
			this.proceduresDir,
		]) {
			mkdirSync(dir, { recursive: true });
		}
	}

	async getStatus(): Promise<InterNousSeedStatus> {
		const identity = await ensureNousIdentity(this.options);
		const policy = loadCommunicationPolicy(this.options);
		return {
			instanceId: identity.instanceId,
			networkEnabled: policy.networkEnabled,
			validatedProcedures: this.listLocalValidatedProcedures().length,
			importedProcedures: this.listImportedProcedures().length,
			exportBundles: listJsonFiles(this.paths.exportsDir).length,
			importBundles: listJsonFiles(this.paths.importsDir).length,
			policy,
		};
	}

	listLocalValidatedProcedures(): ProcedureCandidate[] {
		return listJsonFiles(this.proceduresDir)
			.map((filePath) => readJson<ProcedureCandidate>(filePath))
			.filter(
				(value): value is ProcedureCandidate =>
					Boolean(value) && value?.validationState === "validated",
			);
	}

	listImportedProcedures(): Array<
		ProcedureSummaryBundle["procedure"] & {
			fromInstanceId: string;
			bundleId: string;
			importedAt: string;
		}
	> {
		return listJsonFiles(this.paths.importedSkillsDir)
			.map((filePath) =>
				readJson<
					ProcedureSummaryBundle["procedure"] & {
						fromInstanceId: string;
						bundleId: string;
						importedAt: string;
					}
				>(filePath),
			)
			.filter(
				(
					value,
				): value is ProcedureSummaryBundle["procedure"] & {
					fromInstanceId: string;
					bundleId: string;
					importedAt: string;
				} => Boolean(value),
			);
	}

	async exportProcedureSummary(input: {
		fingerprint: string;
		outputPath?: string;
	}): Promise<{
		bundle: ProcedureSummaryBundle;
		bundlePath: string;
	}> {
		const identity = await ensureNousIdentity(this.options);
		const policy = loadCommunicationPolicy(this.options);
		this.assertNetworkEnabled(policy);

		const procedurePath = join(this.proceduresDir, `${input.fingerprint}.json`);
		const procedure = readJson<ProcedureCandidate>(procedurePath);
		if (!procedure || procedure.validationState !== "validated") {
			throw new Error(
				`Validated procedure '${input.fingerprint}' not found in local skills/procedures.`,
			);
		}

		const bundle: ProcedureSummaryBundle = {
			version: 1,
			kind: "procedure.summary",
			id: prefixedId("bundle"),
			exportedAt: now(),
			from: {
				instanceId: identity.instanceId,
				publicKey: identity.publicKey,
			},
			procedure: {
				fingerprint: procedure.fingerprint,
				title: procedure.title,
				sampleIntent: procedure.sampleIntent,
				successCount: procedure.successCount,
				traceIds: procedure.traceIds,
				validationState: procedure.validationState,
				lastUpdatedAt: procedure.lastUpdatedAt,
			},
			provenance: {
				traceCount: procedure.traceIds.length,
				sourcePath: procedurePath,
			},
		};

		const bundlePath = resolve(
			input.outputPath ??
				join(
					this.paths.exportsDir,
					`${bundle.exportedAt.slice(0, 10)}-${input.fingerprint}.json`,
				),
		);
		writeJson(bundlePath, bundle);
		this.emitEvent("comm.pattern_shared", bundle.id, {
			kind: bundle.kind,
			fingerprint: bundle.procedure.fingerprint,
			to: "file-export",
			path: bundlePath,
		});

		return { bundle, bundlePath };
	}

	async importProcedureSummary(bundlePath: string): Promise<{
		bundle: ProcedureSummaryBundle;
		storedBundlePath: string;
		materializedPath: string;
	}> {
		const policy = loadCommunicationPolicy(this.options);
		this.assertNetworkEnabled(policy);

		const bundle = readJson<ProcedureSummaryBundle>(resolve(bundlePath));
		if (
			!bundle ||
			bundle.kind !== "procedure.summary" ||
			bundle.version !== 1
		) {
			throw new Error("Unsupported inter-Nous bundle.");
		}
		if (bundle.procedure.validationState !== "validated") {
			throw new Error("Only validated procedure summaries can be imported.");
		}

		const storedBundlePath = join(
			this.paths.importsDir,
			`${bundle.from.instanceId}-${bundle.id}.json`,
		);
		writeJson(storedBundlePath, bundle);

		const materializedPath = join(
			this.paths.importedSkillsDir,
			`${bundle.from.instanceId}__${bundle.procedure.fingerprint}.json`,
		);
		writeJson(materializedPath, {
			...bundle.procedure,
			fromInstanceId: bundle.from.instanceId,
			bundleId: bundle.id,
			importedAt: now(),
			sourceBundle: basename(storedBundlePath),
		});

		this.emitEvent("comm.insight_received", bundle.id, {
			kind: bundle.kind,
			fingerprint: bundle.procedure.fingerprint,
			from: bundle.from.instanceId,
			path: storedBundlePath,
		});

		return {
			bundle,
			storedBundlePath,
			materializedPath,
		};
	}

	listCommunicationEvents(limit = 20): Event[] {
		const eventStore = this.options.eventStore;
		if (!eventStore) return [];
		const events = eventStore.query({ entityType: "communication" });
		return events.slice(Math.max(0, events.length - limit));
	}

	private assertNetworkEnabled(policy: CommunicationPolicy): void {
		if (!policy.networkEnabled) {
			throw new Error(
				"Inter-Nous exchange is paused. Run `nous network enable` first.",
			);
		}
	}

	private emitEvent(
		type: Event["type"],
		entityId: string,
		payload: Record<string, unknown>,
	): void {
		const eventStore = this.options.eventStore;
		if (!eventStore) return;
		eventStore.append({
			id: prefixedId("evt"),
			timestamp: now(),
			type,
			entityType: "communication",
			entityId,
			payload,
		});
	}
}

function readJson<T>(path: string): T | undefined {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return undefined;
	}
}

function writeJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function listJsonFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith(".json"))
		.map((name) => join(dir, name))
		.sort();
}
