import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface DaemonPaths {
	baseDir: string;
	socketPath: string;
	pidPath: string;
	statePath: string;
	dbPath: string;
	host: string;
	port: number;
}

export function getDaemonPaths(): DaemonPaths {
	const baseDir = resolve(process.env.NOUS_HOME ?? ".nous");
	const socketPath = resolve(process.env.NOUS_SOCKET ?? `${baseDir}/nous.sock`);
	const pidPath = resolve(process.env.NOUS_PID_FILE ?? `${baseDir}/nous.pid`);
	const statePath = resolve(
		process.env.NOUS_STATE_FILE ?? `${baseDir}/daemon.json`,
	);
	const dbPath = resolve(process.env.NOUS_DB ?? `${baseDir}/nous.db`);
	const host = process.env.NOUS_HOST ?? "127.0.0.1";
	const port = Number.parseInt(process.env.NOUS_PORT ?? "4317", 10);

	mkdirSync(dirname(socketPath), { recursive: true });
	mkdirSync(dirname(pidPath), { recursive: true });
	mkdirSync(dirname(statePath), { recursive: true });
	mkdirSync(dirname(dbPath), { recursive: true });

	return { baseDir, socketPath, pidPath, statePath, dbPath, host, port };
}
