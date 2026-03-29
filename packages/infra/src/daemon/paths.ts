import { resolve } from "node:path";
import { ensureNousHome, loadNousConfig } from "../config/home.ts";

export interface DaemonPaths {
	baseDir: string;
	configDir: string;
	daemonDir: string;
	stateDir: string;
	logsDir: string;
	toolsDir: string;
	skillsDir: string;
	socketPath: string;
	pidPath: string;
	statePath: string;
	dbPath: string;
	host: string;
	port: number;
}

export function getDaemonPaths(): DaemonPaths {
	const home = ensureNousHome();
	const config = loadNousConfig();
	const socketPath = resolve(
		process.env.NOUS_SOCKET ??
			config.daemon.socketPath ??
			`${home.daemonDir}/nous.sock`,
	);
	const pidPath = resolve(
		process.env.NOUS_PID_FILE ??
			config.daemon.pidPath ??
			`${home.daemonDir}/nous.pid`,
	);
	const statePath = resolve(
		process.env.NOUS_STATE_FILE ??
			config.daemon.statePath ??
			`${home.daemonDir}/daemon.json`,
	);
	const dbPath = resolve(
		process.env.NOUS_DB ?? config.storage.dbPath ?? `${home.stateDir}/nous.db`,
	);
	const host = process.env.NOUS_HOST ?? config.daemon.host;
	const port = Number.parseInt(
		process.env.NOUS_PORT ?? String(config.daemon.port),
		10,
	);

	return {
		baseDir: home.homeDir,
		configDir: home.configDir,
		daemonDir: home.daemonDir,
		stateDir: home.stateDir,
		logsDir: home.logsDir,
		toolsDir: home.toolsDir,
		skillsDir: home.skillsDir,
		socketPath,
		pidPath,
		statePath,
		dbPath,
		host,
		port,
	};
}
