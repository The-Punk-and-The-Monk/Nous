import { existsSync, readFileSync } from "node:fs";
import { type Socket, createConnection } from "node:net";
import type { ClientEnvelope, DaemonEnvelope } from "@nous/core";
import { now, prefixedId } from "@nous/core";
import { getDaemonPaths } from "./paths.ts";

export class DaemonClientSession {
	private socket?: Socket;
	private buffer = "";
	private readonly pending = new Map<
		string,
		{
			resolve: (value: DaemonEnvelope) => void;
			reject: (error: Error) => void;
		}
	>();
	private readonly listeners = new Set<(message: DaemonEnvelope) => void>();

	async connect(): Promise<void> {
		if (this.socket) return;
		const transport = readTransportState();
		const paths = getDaemonPaths();
		this.socket =
			transport?.mode === "tcp"
				? createConnection(
						transport.port ?? paths.port,
						transport.host ?? paths.host,
					)
				: createConnection(paths.socketPath);

		await new Promise<void>((resolve, reject) => {
			const handleError = (error: Error) => reject(error);
			this.socket?.once("error", handleError);
			this.socket?.once("connect", () => {
				this.socket?.off("error", handleError);
				resolve();
			});
		});

		this.socket.on("data", (chunk) => this.handleData(chunk.toString()));
		this.socket.on("error", (error) => this.rejectAll(error));
		this.socket.on("close", () => {
			this.rejectAll(new Error("Daemon connection closed"));
			this.socket = undefined;
		});
	}

	async send(message: ClientEnvelope): Promise<DaemonEnvelope> {
		await this.connect();
		return new Promise<DaemonEnvelope>((resolve, reject) => {
			this.pending.set(message.id, { resolve, reject });
			this.socket?.write(`${JSON.stringify(message)}\n`);
		});
	}

	async request<TPayload = unknown>(params: {
		type: ClientEnvelope["type"];
		channel: ClientEnvelope["channel"];
		payload: TPayload;
	}): Promise<DaemonEnvelope> {
		return this.send({
			id: prefixedId("req"),
			type: params.type,
			channel: params.channel,
			payload: params.payload,
			timestamp: now(),
		});
	}

	onMessage(listener: (message: DaemonEnvelope) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	close(): void {
		this.socket?.end();
		this.socket?.destroy();
		this.socket = undefined;
	}

	private handleData(chunk: string): void {
		this.buffer += chunk;
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() ?? "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const parsed = JSON.parse(trimmed) as DaemonEnvelope;
				if (parsed.id && this.pending.has(parsed.id)) {
					const pending = this.pending.get(parsed.id);
					this.pending.delete(parsed.id);
					pending?.resolve(parsed);
					continue;
				}
				for (const listener of this.listeners) {
					listener(parsed);
				}
			} catch (error) {
				this.rejectAll(error as Error);
			}
		}
	}

	private rejectAll(error: Error): void {
		for (const [id, pending] of this.pending) {
			pending.reject(error);
			this.pending.delete(id);
		}
	}
}

export async function sendDaemonRequest(
	message: ClientEnvelope,
): Promise<DaemonEnvelope> {
	const session = new DaemonClientSession();
	try {
		return await session.send(message);
	} finally {
		session.close();
	}
}

interface TransportState {
	mode: "unix" | "tcp";
	socketPath?: string;
	host?: string;
	port?: number;
}

function readTransportState(): TransportState | undefined {
	const { statePath } = getDaemonPaths();
	if (!existsSync(statePath)) return undefined;
	try {
		return JSON.parse(readFileSync(statePath, "utf8")) as TransportState;
	} catch {
		return undefined;
	}
}
