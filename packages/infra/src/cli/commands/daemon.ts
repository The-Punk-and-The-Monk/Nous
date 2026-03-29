import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { getDaemonPaths } from "../../daemon/paths.ts";
import { colors } from "../ui/colors.ts";

export async function daemonCommand(
	action: "start" | "stop" | "status" | "_serve",
): Promise<boolean> {
	const paths = getDaemonPaths();

	if (action === "status") {
		const running = isDaemonRunning();
		const transport = readTransportState();
		console.log(colors.bold("\n  νοῦς — Daemon Status\n"));
		console.log(
			`  Running: ${running ? colors.green("yes") : colors.red("no")}`,
		);
		console.log(`  Socket: ${transport?.socketPath ?? paths.socketPath}`);
		console.log(
			`  Transport: ${transport?.mode === "tcp" ? `${transport.host ?? paths.host}:${transport.port ?? paths.port}` : "unix"}`,
		);
		console.log(`  PID file: ${paths.pidPath}`);
		console.log(`  DB: ${paths.dbPath}\n`);
		return true;
	}

	if (action === "stop") {
		if (!existsSync(paths.pidPath)) {
			console.log(`\n  ${colors.yellow("No daemon PID file found.")}\n`);
			return true;
		}
		const pid = Number.parseInt(readFileSync(paths.pidPath, "utf8"), 10);
		if (Number.isFinite(pid)) {
			process.kill(pid, "SIGTERM");
			console.log(
				`\n  ${colors.green("Stopped daemon")} ${colors.dim(`(PID ${pid})`)}\n`,
			);
			return true;
		}
		console.log(`\n  ${colors.red("Invalid daemon PID file.")}\n`);
		return true;
	}

	if (action === "start") {
		if (isDaemonRunning()) {
			console.log(`\n  ${colors.yellow("Daemon already running.")}\n`);
			return true;
		}

		const child = spawn(
			process.execPath,
			[process.argv[1], "daemon", "_serve"],
			{
				detached: true,
				stdio: "ignore",
				env: { ...process.env },
			},
		);
		child.unref();
		const ready = await waitForDaemonReady();
		if (!ready) {
			console.log(`\n  ${colors.red("Daemon failed to become ready.")}`);
			console.log(
				`  ${colors.dim("Check whether the current environment allows local socket/port listening.")}\n`,
			);
			return false;
		}
		console.log(
			`\n  ${colors.green("Started daemon")} ${colors.dim(`(PID ${child.pid ?? "unknown"})`)}`,
		);
		console.log(`  Socket: ${paths.socketPath}`);
		console.log(`  TCP fallback: ${paths.host}:${paths.port}`);
		console.log(`  DB: ${paths.dbPath}\n`);
		return true;
	}

	return false;
}

export function isDaemonRunning(): boolean {
	const { pidPath, socketPath, statePath } = getDaemonPaths();
	if (!existsSync(pidPath)) return false;
	if (!existsSync(socketPath) && !existsSync(statePath)) return false;
	try {
		const pid = Number.parseInt(readFileSync(pidPath, "utf8"), 10);
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function waitForDaemonReady(timeoutMs = 4000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (isDaemonRunning()) return true;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return isDaemonRunning();
}

function readTransportState():
	| {
			mode: "unix" | "tcp";
			socketPath?: string;
			host?: string;
			port?: number;
	  }
	| undefined {
	const { statePath } = getDaemonPaths();
	if (!existsSync(statePath)) return undefined;
	try {
		return JSON.parse(readFileSync(statePath, "utf8")) as {
			mode: "unix" | "tcp";
			socketPath?: string;
			host?: string;
			port?: number;
		};
	} catch {
		return undefined;
	}
}
