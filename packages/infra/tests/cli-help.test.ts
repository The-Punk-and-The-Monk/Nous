import { describe, expect, test } from "bun:test";
import {
	formatCliHelpLines,
	formatReplCommandsLines,
} from "../src/cli/help.ts";

describe("CLI help and discovery rendering", () => {
	test("filters top-level help by query through the shared catalog", () => {
		const output = formatCliHelpLines({
			query: "network",
			daemonRunning: true,
		}).join("\n");

		expect(output).toContain("nous network status");
		expect(output).toContain("nous network export <fingerprint> [--out <path>]");
		expect(output).toContain('Control Operations Matching "network"');
	});

	test("renders REPL capability discovery with thread availability notes", () => {
		const output = formatReplCommandsLines({
			daemonRunning: true,
		}).join("\n");

		expect(output).toContain("/commands [query]");
		expect(output).toContain("/detach");
		expect(output).toContain("/debug daemon");
		expect(output).toContain("/events [N]");
		expect(output).toContain("/memory [search]");
		expect(output).toContain("/permissions");
		expect(output).toContain("/network status");
		expect(output).toContain("requires an attached thread");
		expect(output).toContain("nous debug daemon");
	});

	test("searches REPL discovery across both REPL and CLI control surfaces", () => {
		const output = formatReplCommandsLines({
			daemonRunning: true,
			currentThreadId: "thread_123",
			query: "thread",
		}).join("\n");

		expect(output).toContain("/attach <threadId>");
		expect(output).toContain("nous debug thread <threadId>");
	});
});
