import { describe, expect, test } from "bun:test";
import { formatThreadBadge } from "../src/cli/commands/repl.ts";

describe("REPL thread badge", () => {
	test("shows a longer readable thread id when no title is available", () => {
		expect(formatThreadBadge("thread_01KN4AEDCAYA8C29G1P7WTKYHB")).toBe(
			"thread_01KN4AEDC",
		);
	});

	test("includes the thread title when available", () => {
		expect(
			formatThreadBadge(
				"thread_01KN4AEDCAYA8C29G1P7WTKYHB",
				"跟我继续聊积极心理学",
			),
		).toBe("跟我继续聊积极心理学 · thread_01KN4AEDC");
	});

	test("truncates long thread titles to keep the prompt compact", () => {
		const badge = formatThreadBadge(
			"thread_01KN4AEDCAYA8C29G1P7WTKYHB",
			"这是一个非常非常长的线程标题需要被压缩显示而且还要继续变长",
		);
		expect(badge).toContain("...");
		expect(badge).toContain("thread_01KN4AEDC");
	});
});
