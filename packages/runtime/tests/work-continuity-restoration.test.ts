import { describe, expect, test } from "bun:test";
import { SQLiteMemoryStore, initDatabase } from "@nous/persistence";
import {
	MemoryService,
	evaluateWorkContinuationRestoration,
} from "../src/index.ts";

describe("work continuity restoration", () => {
	test("promotes a work item into structured continuity memory", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });

		const entry = service.promoteWorkContinuation({
			workItemId: "intent_123",
			summary: "Inspect auth refresh regression",
			threadId: "thread_123",
			scope: {
				projectRoot: "/repo/app",
				workingDirectory: "/repo/app",
			},
			sourceSurfaceKind: "cli",
			relevantFacts: ["Auth refresh broke after token path changed."],
			pendingQuestions: ["Which branch should resume the fix?"],
		});

		const stored = store.getById(entry.id);
		const metadata = (stored?.metadata ?? {}) as Record<string, unknown>;
		const tags = Array.isArray(metadata.tags) ? metadata.tags : [];

		expect(stored?.tier).toBe("semantic");
		expect(metadata.intentId).toBe("intent_123");
		expect(metadata.threadId).toBe("thread_123");
		expect(metadata.projectRoot).toBe("/repo/app");
		expect(tags).toContain("work_continuity");
		expect(tags).toContain("structured");
		expect(tags).toContain("double_gate_candidate");
		expect(tags).toContain("surface:cli");
	});

	test("rejects restoration when no promoted structured memory is supplied", () => {
		const verdict = evaluateWorkContinuationRestoration({
			permissionGranted: true,
			boundaryAccepted: true,
		});

		expect(verdict.allowed).toBe(false);
		expect(verdict.gates.structuredPromotion).toBe(false);
		expect(verdict.reason).toContain(
			"no promoted structured work-continuity memory",
		);
	});

	test("rejects restoration when the live scene does not match", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });
		const entry = service.promoteWorkContinuation({
			workItemId: "intent_auth",
			summary: "Inspect auth refresh regression",
			threadId: "thread_auth",
			scope: {
				projectRoot: "/repo/auth",
				workingDirectory: "/repo/auth",
			},
		});

		const verdict = evaluateWorkContinuationRestoration({
			memoryEntry: entry,
			scope: {
				projectRoot: "/repo/other",
				workingDirectory: "/repo/other",
			},
			workItemId: "intent_auth",
			permissionGranted: true,
			boundaryAccepted: true,
		});

		expect(verdict.allowed).toBe(false);
		expect(verdict.gates.structuredPromotion).toBe(true);
		expect(verdict.gates.liveSceneMatch).toBe(false);
		expect(verdict.reason).toContain("current scene did not match");
	});

	test("rejects restoration when permission or boundary checks fail", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });
		const entry = service.promoteWorkContinuation({
			workItemId: "intent_auth",
			summary: "Inspect auth refresh regression",
			threadId: "thread_auth",
			scope: {
				projectRoot: "/repo/auth",
				workingDirectory: "/repo/auth",
			},
		});

		const verdict = evaluateWorkContinuationRestoration({
			memoryEntry: entry,
			scope: {
				projectRoot: "/repo/auth",
				workingDirectory: "/repo/auth",
			},
			workItemId: "intent_auth",
			permissionGranted: false,
			boundaryAccepted: true,
		});

		expect(verdict.allowed).toBe(false);
		expect(verdict.gates.structuredPromotion).toBe(true);
		expect(verdict.gates.liveSceneMatch).toBe(true);
		expect(verdict.gates.permissionBoundary).toBe(false);
		expect(verdict.reason).toContain("permission or boundary checks");
	});

	test("allows restoration only when both gates pass", () => {
		const store = new SQLiteMemoryStore(initDatabase());
		const service = new MemoryService({ store, agentId: "nous" });
		const entry = service.promoteWorkContinuation({
			workItemId: "intent_auth",
			summary: "Inspect auth refresh regression",
			threadId: "thread_auth",
			scope: {
				projectRoot: "/repo/auth",
				workingDirectory: "/repo/auth",
			},
		});

		const verdict = evaluateWorkContinuationRestoration({
			memoryEntry: entry,
			scope: {
				projectRoot: "/repo/auth",
				workingDirectory: "/repo/auth",
			},
			workItemId: "intent_auth",
			permissionGranted: true,
			boundaryAccepted: true,
		});

		expect(verdict.allowed).toBe(true);
		expect(verdict.gates).toEqual({
			structuredPromotion: true,
			liveSceneMatch: true,
			permissionBoundary: true,
		});
	});
});
