import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionTrace, ProcedureCandidate } from "@nous/core";
import { now, prefixedId } from "@nous/core";
import { getNousPaths } from "../config/home.ts";

export class LocalProcedureSeedStore {
	private readonly baseDir: string;
	private readonly tracesDir: string;
	private readonly candidatesDir: string;
	private readonly proceduresDir: string;

	constructor(options: { baseDir?: string } = {}) {
		this.baseDir = options.baseDir ?? getNousPaths().skillsDir;
		this.tracesDir = join(this.baseDir, "traces");
		this.candidatesDir = join(this.baseDir, "candidates");
		this.proceduresDir = join(this.baseDir, "procedures");
		for (const dir of [
			this.baseDir,
			this.tracesDir,
			this.candidatesDir,
			this.proceduresDir,
		]) {
			mkdirSync(dir, { recursive: true });
		}
	}

	recordTrace(trace: ExecutionTrace): {
		candidate: ProcedureCandidate;
		procedurePromoted: boolean;
	} {
		writeJson(join(this.tracesDir, `${trace.id}.json`), trace);

		const fingerprint = fingerprintIntent(trace.intentText);
		const candidatePath = join(this.candidatesDir, `${fingerprint}.json`);
		const existing = readJson<ProcedureCandidate>(candidatePath);
		const candidate: ProcedureCandidate = existing
			? {
					...existing,
					successCount:
						trace.status === "achieved"
							? existing.successCount + 1
							: existing.successCount,
					traceIds: dedupe([...existing.traceIds, trace.id]),
					validationState:
						trace.status === "achieved" && existing.successCount + 1 >= 2
							? "validated"
							: existing.validationState,
					lastUpdatedAt: now(),
				}
			: {
					id: prefixedId("proc"),
					fingerprint,
					title: deriveTitle(trace.intentText),
					sampleIntent: trace.intentText,
					successCount: trace.status === "achieved" ? 1 : 0,
					traceIds: [trace.id],
					validationState: "proposed",
					lastUpdatedAt: now(),
				};

		writeJson(candidatePath, candidate);

		const shouldPromote = candidate.validationState === "validated";
		if (shouldPromote) {
			writeJson(join(this.proceduresDir, `${fingerprint}.json`), {
				id: prefixedId("skill"),
				fingerprint,
				title: candidate.title,
				sampleIntent: candidate.sampleIntent,
				validationState: candidate.validationState,
				traceIds: candidate.traceIds,
				successCount: candidate.successCount,
				lastUpdatedAt: candidate.lastUpdatedAt,
			});
		}

		return {
			candidate,
			procedurePromoted: shouldPromote,
		};
	}
}

function fingerprintIntent(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function deriveTitle(text: string): string {
	const trimmed = text.trim();
	return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`;
}

function dedupe(values: string[]): string[] {
	return [...new Set(values)];
}

function writeJson(path: string, value: unknown): void {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(path: string): T | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return undefined;
	}
}
