import type { ISOTimestamp } from "../utils/timestamp.ts";
import type { Intent } from "./intent.ts";

export interface EnvironmentContext {
	cwd: string;
	os: string;
	arch: string;
	shell: string;
	availableTools: string[];
	timestamp: ISOTimestamp;
}

export interface ProjectContext {
	rootDir: string;
	type: string;
	language: string;
	framework?: string;
	packageManager?: string;
	gitBranch?: string;
	gitStatus?: string;
	gitStatusDetail: string[];
	directoryTree: string;
	readmeSnippet?: string;
	configFiles: string[];
	localNousConfigFiles: string[];
	focusedFile?: string;
}

export interface UserContext {
	activeIntents: Pick<Intent, "id" | "raw" | "goal" | "status" | "source">[];
	recentMemoryHints: string[];
	scopeLabels: string[];
}

export interface PermissionContext {
	autoAllowed: string[];
	approvalRequired: string[];
	denied: string[];
	explanation: string;
}

export interface AssembledContext {
	environment: EnvironmentContext;
	project: ProjectContext;
	user: UserContext;
	permissions: PermissionContext;
}
