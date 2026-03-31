import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
	AttentionResult,
	ChannelScope,
	Event,
	PerceptionSignal,
} from "@nous/core";
import { now, prefixedId } from "@nous/core";
import type { EventStore, IntentStore } from "@nous/persistence";
import { snapshotFiles } from "@nous/runtime";

export interface PromotedPerception {
	signal: PerceptionSignal;
	message: string;
	confidence: number;
	autoSubmit: boolean;
	suggestedIntentText?: string;
	cooldownKey: string;
}

export interface PerceptionServiceConfig {
	eventStore: EventStore;
	intentStore: IntentStore;
	onPromoted?: (promotion: PromotedPerception) => void | Promise<void>;
	pollIntervalMs?: number;
	cooldownMs?: number;
	idleOnly?: boolean;
}

export class PerceptionService {
	private readonly observedRoots = new Set<string>();
	private readonly fsSensor = new FileSystemSensor();
	private readonly gitSensor = new GitSensor();
	private readonly attention = new HeuristicAttentionFilter();
	private readonly lastPromotionAt = new Map<string, number>();
	private readonly lastRootPromotion = new Map<
		string,
		{ signalType: string; at: number }
	>();
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor(private readonly config: PerceptionServiceConfig) {}

	start(): void {
		if (this.intervalId) return;
		this.intervalId = setInterval(
			() => void this.tick(),
			this.config.pollIntervalMs ?? 5000,
		);
	}

	stop(): void {
		if (!this.intervalId) return;
		clearInterval(this.intervalId);
		this.intervalId = null;
	}

	observeScope(scope: ChannelScope): void {
		const root = scope.projectRoot ?? scope.workingDirectory;
		if (!root) return;
		this.observedRoots.add(resolve(root));
	}

	async tick(): Promise<void> {
		const activeIntents = this.config.intentStore.getActive();
		const activeIntentCount =
			this.config.idleOnly === false ? 0 : activeIntents.length;
		for (const root of this.observedRoots) {
			const signals = [
				...this.fsSensor.poll(root),
				...this.gitSensor.poll(root),
			];

			for (const signal of signals) {
				this.emitEvent("sensor.signal", "sensor", signal.sensorId, signal);
				const evaluation = this.attention.evaluate(signal, activeIntentCount);
				signal.attentionResult = evaluation;
				this.emitEvent("attention.evaluated", "sensor", signal.id, evaluation);
				if (evaluation.disposition !== "promote") continue;
				const promotion = buildPromotion(signal, evaluation, activeIntentCount);
				if (!promotion) continue;
				if (this.isCoolingDown(promotion.cooldownKey)) continue;
				const suppressionReason = this.getSuppressionReason(signal);
				if (suppressionReason) {
					this.emitEvent("attention.suppressed", "sensor", signal.id, {
						reason: suppressionReason,
						signalType: signal.signalType,
						rootDir: readRootDir(signal),
					});
					continue;
				}
				const promotedAt = Date.now();
				this.lastPromotionAt.set(promotion.cooldownKey, promotedAt);
				const rootDir = readRootDir(signal);
				if (rootDir) {
					this.lastRootPromotion.set(rootDir, {
						signalType: signal.signalType,
						at: promotedAt,
					});
				}
				this.emitEvent("attention.promoted", "sensor", signal.id, {
					message: promotion.message,
					confidence: promotion.confidence,
					autoSubmit: promotion.autoSubmit,
					signalType: signal.signalType,
				});
				await this.config.onPromoted?.(promotion);
			}
		}
	}

	private isCoolingDown(key: string): boolean {
		const cooldownMs = this.config.cooldownMs ?? 60000;
		const lastAt = this.lastPromotionAt.get(key);
		return lastAt !== undefined && Date.now() - lastAt < cooldownMs;
	}

	private getSuppressionReason(signal: PerceptionSignal): string | null {
		if (signal.signalType !== "git.status_changed") return null;
		const rootDir = readRootDir(signal);
		if (!rootDir) return null;
		const lastPromotion = this.lastRootPromotion.get(rootDir);
		if (!lastPromotion) return null;
		const cooldownMs = this.config.cooldownMs ?? 60000;
		const isRecent = Date.now() - lastPromotion.at < cooldownMs;
		if (
			isRecent &&
			(lastPromotion.signalType === "fs.file_changed" ||
				lastPromotion.signalType === "fs.file_created")
		) {
			return "suppressed redundant git status notice after a recent file-change promotion";
		}
		return null;
	}

	private emitEvent(
		type: Event["type"],
		entityType: Event["entityType"],
		entityId: string,
		payload: unknown,
	): void {
		this.config.eventStore.append({
			id: prefixedId("evt"),
			timestamp: now(),
			type,
			entityType,
			entityId,
			payload,
		});
	}
}

export class FileSystemSensor {
	private readonly snapshots = new Map<string, Map<string, number>>();

	poll(rootDir: string): PerceptionSignal[] {
		if (!existsSync(rootDir)) return [];
		const next = new Map<string, number>(
			snapshotFiles(rootDir).map((entry) => [entry.path, entry.mtimeMs]),
		);
		const previous = this.snapshots.get(rootDir);
		this.snapshots.set(rootDir, next);
		if (!previous) return [];

		const signals: PerceptionSignal[] = [];
		for (const [path, mtimeMs] of next) {
			const before = previous.get(path);
			if (before === undefined) {
				signals.push(
					this.createSignal(rootDir, "fs.file_created", { path, mtimeMs }),
				);
				continue;
			}
			if (before !== mtimeMs) {
				signals.push(
					this.createSignal(rootDir, "fs.file_changed", { path, mtimeMs }),
				);
			}
		}
		for (const path of previous.keys()) {
			if (!next.has(path)) {
				signals.push(this.createSignal(rootDir, "fs.file_deleted", { path }));
			}
		}
		return signals.slice(0, 20);
	}

	private createSignal(
		rootDir: string,
		signalType: string,
		payload: Record<string, unknown>,
	): PerceptionSignal {
		return {
			id: prefixedId("sig"),
			sensorId: `sensor_fs:${rootDir}`,
			timestamp: now(),
			signalType,
			payload: { rootDir, ...payload },
		};
	}
}

export class GitSensor {
	private readonly snapshots = new Map<string, GitSnapshot>();

	poll(rootDir: string): PerceptionSignal[] {
		if (!existsGitRepo(rootDir)) return [];
		const next = captureGitSnapshot(rootDir);
		if (!next) return [];
		const previous = this.snapshots.get(rootDir);
		this.snapshots.set(rootDir, next);
		if (!previous) return [];

		const signals: PerceptionSignal[] = [];
		if (previous.branch !== next.branch) {
			signals.push(
				this.createSignal(rootDir, "git.branch_changed", {
					from: previous.branch,
					to: next.branch,
				}),
			);
		}
		if (previous.status !== next.status) {
			signals.push(
				this.createSignal(rootDir, "git.status_changed", {
					from: previous.status,
					to: next.status,
				}),
			);
		}
		return signals;
	}

	private createSignal(
		rootDir: string,
		signalType: string,
		payload: Record<string, unknown>,
	): PerceptionSignal {
		return {
			id: prefixedId("sig"),
			sensorId: `sensor_git:${rootDir}`,
			timestamp: now(),
			signalType,
			payload: { rootDir, ...payload },
		};
	}
}

export class HeuristicAttentionFilter {
	evaluate(
		signal: PerceptionSignal,
		activeIntentCount: number,
	): AttentionResult {
		if (activeIntentCount > 0) {
			switch (signal.signalType) {
				case "git.branch_changed":
				case "git.status_changed":
				case "fs.file_changed":
				case "fs.file_created":
					return {
						relevance: 0.4,
						disposition: "log",
					};
				default:
					return { relevance: 0.1, disposition: "discard" };
			}
		}

		switch (signal.signalType) {
			case "git.branch_changed":
				return {
					relevance: 0.9,
					disposition: "promote",
				};
			case "git.status_changed":
				return {
					relevance: activeIntentCount > 0 ? 0.5 : 0.8,
					disposition: activeIntentCount > 0 ? "log" : "promote",
				};
			case "fs.file_changed":
			case "fs.file_created":
				if (
					isHighValuePath(
						String((signal.payload as { path?: string }).path ?? ""),
					)
				) {
					return {
						relevance: activeIntentCount > 0 ? 0.55 : 0.78,
						disposition: activeIntentCount > 0 ? "log" : "promote",
					};
				}
				return { relevance: 0.2, disposition: "discard" };
			default:
				return { relevance: 0.1, disposition: "discard" };
		}
	}
}

interface GitSnapshot {
	branch: string;
	status: string;
}

function captureGitSnapshot(rootDir: string): GitSnapshot | undefined {
	const branch = runGit(rootDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
	const status = runGit(rootDir, ["status", "--short", "--untracked-files=no"]);
	if (branch === undefined || status === undefined) return undefined;
	return {
		branch,
		status: status.trim() ? "dirty" : "clean",
	};
}

function existsGitRepo(rootDir: string): boolean {
	return existsSync(join(rootDir, ".git"));
}

function runGit(rootDir: string, args: string[]): string | undefined {
	try {
		const proc = Bun.spawnSync(["git", "-C", rootDir, ...args], {
			stdout: "pipe",
			stderr: "ignore",
		});
		if (proc.exitCode !== 0) return undefined;
		return proc.stdout.toString().trim();
	} catch {
		return undefined;
	}
}

function buildPromotionMessage(signal: PerceptionSignal): string | undefined {
	const payload = signal.payload as {
		path?: string;
		rootDir?: string;
		from?: string;
		to?: string;
	};
	const pathKind = classifyPath(payload.path);
	switch (signal.signalType) {
		case "git.branch_changed":
			return `Ambient notice: git branch changed from ${payload.from ?? "unknown"} to ${payload.to ?? "unknown"} in ${payload.rootDir ?? "workspace"}.`;
		case "git.status_changed":
			return `Ambient notice: workspace git status changed from ${payload.from ?? "unknown"} to ${payload.to ?? "unknown"} in ${payload.rootDir ?? "workspace"}.`;
		case "fs.file_changed":
		case "fs.file_created":
			return buildFileChangePromotionMessage(
				payload.path,
				payload.rootDir,
				pathKind,
			);
		default:
			return undefined;
	}
}

function buildPromotion(
	signal: PerceptionSignal,
	evaluation: AttentionResult,
	activeIntentCount: number,
): PromotedPerception | undefined {
	const message = buildPromotionMessage(signal);
	if (!message) return undefined;
	const payload = signal.payload as {
		path?: string;
		rootDir?: string;
		from?: string;
		to?: string;
	};
	const confidence = evaluation.relevance;
	const cooldownKey = `${signal.signalType}:${payload.rootDir ?? "workspace"}:${payload.path ?? payload.to ?? "state"}`;
	const suggestedIntentText = buildSuggestedIntentText(
		signal,
		activeIntentCount,
		payload,
	);

	return {
		signal,
		message,
		confidence,
		autoSubmit: Boolean(suggestedIntentText),
		suggestedIntentText: suggestedIntentText ?? undefined,
		cooldownKey,
	};
}

function buildSuggestedIntentText(
	signal: PerceptionSignal,
	activeIntentCount: number,
	payload: {
		path?: string;
		rootDir?: string;
		from?: string;
		to?: string;
	},
): string | null {
	if (activeIntentCount > 0) return null;

	switch (signal.signalType) {
		case "fs.file_changed":
		case "fs.file_created":
			if (!payload.path || !isHighValuePath(payload.path)) return null;
			return buildFileChangeFollowupIntent(payload.path, payload.rootDir);
		case "git.branch_changed":
			return `Inspect the newly checked out branch ${payload.to ?? "unknown"} in ${payload.rootDir ?? "the workspace"} and summarize the repository state, recent changes, and any immediate risks. Do not modify files.`;
		default:
			return null;
	}
}

function isHighValuePath(path: string): boolean {
	return (
		/(\.test\.|\.spec\.)/.test(path) ||
		path.endsWith("package.json") ||
		path.endsWith("bun.lock") ||
		path.endsWith("bun.lockb") ||
		path.endsWith("tsconfig.json") ||
		path.endsWith("README.md") ||
		path.endsWith(".env")
	);
}

function readRootDir(signal: PerceptionSignal): string | undefined {
	const payload = signal.payload as { rootDir?: string };
	return typeof payload.rootDir === "string" ? payload.rootDir : undefined;
}

type SignalPathKind =
	| "tests"
	| "dependencies"
	| "config"
	| "docs"
	| "secrets"
	| "other";

function classifyPath(path?: string): SignalPathKind {
	if (!path) return "other";
	if (/(\.test\.|\.spec\.)/.test(path)) return "tests";
	if (
		path.endsWith("package.json") ||
		path.endsWith("bun.lock") ||
		path.endsWith("bun.lockb")
	) {
		return "dependencies";
	}
	if (path.endsWith("tsconfig.json")) return "config";
	if (path.endsWith("README.md")) return "docs";
	if (path.endsWith(".env")) return "secrets";
	return "other";
}

function buildFileChangePromotionMessage(
	path: string | undefined,
	rootDir: string | undefined,
	kind: SignalPathKind,
): string {
	switch (kind) {
		case "tests":
			return `Ambient notice: test-related file ${path ?? "unknown"} changed in ${rootDir ?? "workspace"}. Consider running or reviewing the affected tests.`;
		case "dependencies":
			return `Ambient notice: dependency or package metadata file ${path ?? "unknown"} changed in ${rootDir ?? "workspace"}. Consider install/build/test follow-up checks.`;
		case "config":
			return `Ambient notice: project configuration file ${path ?? "unknown"} changed in ${rootDir ?? "workspace"}. Consider checking downstream tooling impact.`;
		case "docs":
			return `Ambient notice: documentation file ${path ?? "unknown"} changed in ${rootDir ?? "workspace"}. Consider verifying that docs and implementation still match.`;
		case "secrets":
			return `Ambient notice: sensitive config file ${path ?? "unknown"} changed in ${rootDir ?? "workspace"}. Consider a cautious review for safety and correctness.`;
		default:
			return `Ambient notice: ${path ?? "a file"} changed in ${rootDir ?? "workspace"}. Consider reviewing or running related checks.`;
	}
}

function buildFileChangeFollowupIntent(
	path: string,
	rootDir: string | undefined,
): string {
	const workspace = rootDir ?? "the workspace";
	switch (classifyPath(path)) {
		case "tests":
			return `Inspect the recent test-related change to ${path} in ${workspace}, identify the most relevant test command or validation step, and report whether it should be run. Do not modify files.`;
		case "dependencies":
			return `Inspect the recent dependency/configuration change to ${path} in ${workspace} and report which install, build, or test follow-up checks are advisable. Do not modify files.`;
		case "config":
			return `Inspect the recent project-configuration change to ${path} in ${workspace} and summarize likely downstream tooling or build impact. Do not modify files.`;
		case "docs":
			return `Inspect the recent documentation change to ${path} in ${workspace} and report whether any implementation, examples, or usage guidance may now be out of sync. Do not modify files.`;
		case "secrets":
			return `Inspect the recent sensitive-config change to ${path} in ${workspace} and report any safety or operational risks. Do not modify files.`;
		default:
			return `Inspect the recent change to ${path} in ${workspace} and report whether any follow-up checks or commands are advisable. Do not modify files.`;
	}
}
