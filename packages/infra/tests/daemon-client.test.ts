import { describe, expect, test } from "bun:test";
import { DaemonClientSession } from "../src/daemon/client.ts";

describe("DaemonClientSession", () => {
	test("rejects pending requests when a matching error envelope arrives", async () => {
		const session = new DaemonClientSession() as unknown as {
			pending: Map<
				string,
				{
					resolve(value: unknown): void;
					reject(error: Error): void;
				}
			>;
			handleData(chunk: string): void;
		};

		const result = new Promise((resolve, reject) => {
			session.pending.set("req_1", { resolve, reject });
		});

		session.handleData(
			`${JSON.stringify({
				id: "req_1",
				type: "error",
				timestamp: "2026-04-01T00:00:00.000Z",
				payload: { message: "Connection error." },
			})}\n`,
		);

		await expect(result).rejects.toThrow("Connection error.");
	});
});
