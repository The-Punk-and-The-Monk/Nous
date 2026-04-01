import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	RelationshipBoundary,
	StreamChunk,
} from "@nous/core";
import { ensureNousHome } from "../src/config/home.ts";
import { NousDaemon } from "../src/daemon/server.ts";

const tempDirs: string[] = [];
const ENV_KEYS = [
	"NOUS_HOME",
	"NOUS_DB",
	"NOUS_SOCKET",
	"NOUS_PID_FILE",
	"NOUS_STATE_FILE",
] as const;

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (ORIGINAL_ENV[key] === undefined) {
			delete process.env[key];
			continue;
		}
		process.env[key] = ORIGINAL_ENV[key];
	}

	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("NousDaemon proactive reflection isolation", () => {
	test("swallows background reflection failures so the daemon tick does not crash", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-daemon-reflection-"));
		tempDirs.push(root);
		process.env.NOUS_HOME = join(root, ".nous");
		process.env.NOUS_DB = undefined;
		process.env.NOUS_SOCKET = undefined;
		process.env.NOUS_PID_FILE = undefined;
		process.env.NOUS_STATE_FILE = undefined;

		const daemon = new NousDaemon({
			llm: new ThrowingProvider(new Error("reflection backend exploded")),
		});

		try {
			const internals = daemon as unknown as {
				proactive: {
					enqueueSignalAgenda(input: {
						signalId: string;
						signalType: string;
						summary: string;
						confidence: number;
						scope: {
							projectRoot: string;
							workingDirectory: string;
							focusedFile?: string;
						};
						threadId?: string;
						suggestedIntentText?: string;
					}): void;
				};
				runProactiveReflectionTick(): Promise<void>;
				isReflectionTickRunning: boolean;
			};

			internals.proactive.enqueueSignalAgenda({
				signalId: "sig_reflection_fail",
				signalType: "fs.file_changed",
				summary:
					"Ambient notice: test-related file package.json changed in /repo/app. Consider follow-up checks.",
				confidence: 0.82,
				threadId: "thread_ambient",
				scope: {
					projectRoot: "/repo/app",
					workingDirectory: "/repo/app",
					focusedFile: "package.json",
				},
				suggestedIntentText:
					"Inspect the package.json change and report advisable follow-up checks. Do not modify files.",
			});

			await expect(internals.runProactiveReflectionTick()).resolves.toBeUndefined();
			expect(internals.isReflectionTickRunning).toBe(false);

			await expect(internals.runProactiveReflectionTick()).resolves.toBeUndefined();
			expect(internals.isReflectionTickRunning).toBe(false);
		} finally {
			await daemon.shutdown();
		}
	});

	test("builds ambient relationship boundary from private config overrides", async () => {
		const root = mkdtempSync(join(tmpdir(), "nous-daemon-relationship-"));
		tempDirs.push(root);
		process.env.NOUS_HOME = join(root, ".nous");
		process.env.NOUS_DB = undefined;
		process.env.NOUS_SOCKET = undefined;
		process.env.NOUS_PID_FILE = undefined;
		process.env.NOUS_STATE_FILE = undefined;

		const paths = ensureNousHome({ env: process.env, cwd: root });
		writeFileSync(
			join(paths.configDir, "relationship.json"),
			JSON.stringify(
				{
					relationship: {
						assistantStyle: {
							warmth: "high",
						},
						interruptionPolicy: {
							maxUnpromptedMessagesPerDay: 2,
						},
						autonomyPolicy: {
							allowAmbientAutoExecution: false,
						},
					},
				},
				null,
				2,
			),
		);

		const daemon = new NousDaemon({
			llm: new ThrowingProvider(new Error("unused in this test")),
		});

		try {
			const internals = daemon as unknown as {
				buildAmbientRelationshipBoundary(): RelationshipBoundary;
			};
			const boundary = internals.buildAmbientRelationshipBoundary();

			expect(boundary.assistantStyle.warmth).toBe("high");
			expect(boundary.interruptionPolicy.maxUnpromptedMessagesPerDay).toBe(2);
			expect(boundary.autonomyPolicy.allowAmbientAutoExecution).toBe(false);
		} finally {
			await daemon.shutdown();
		}
	});
});

const ORIGINAL_ENV = {
	NOUS_HOME: process.env.NOUS_HOME,
	NOUS_DB: process.env.NOUS_DB,
	NOUS_SOCKET: process.env.NOUS_SOCKET,
	NOUS_PID_FILE: process.env.NOUS_PID_FILE,
	NOUS_STATE_FILE: process.env.NOUS_STATE_FILE,
} as const;

class ThrowingProvider implements LLMProvider {
	readonly name = "throwing";

	constructor(private readonly error: Error) {}

	getCapabilities(): LLMProviderCapabilities {
		return {
			structuredOutputModes: ["json_schema"],
		};
	}

	async chat(_request: LLMRequest): Promise<LLMResponse> {
		throw this.error;
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		yield {
			type: "message_end",
			usage: {
				inputTokens: 0,
				outputTokens: 0,
			},
		};
	}
}
