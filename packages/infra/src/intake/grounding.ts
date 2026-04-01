import type {
	AssembledContext,
	DialogueMessage,
	UserStateGrounding,
} from "@nous/core";

export interface UserStateGroundingInput {
	context: AssembledContext;
	recentThreadMessages?: Pick<DialogueMessage, "role" | "content">[];
}

export function buildUserStateGrounding(
	input: UserStateGroundingInput,
): UserStateGrounding {
	const activeIntentSummaries = input.context.user.activeIntents.map(
		(intent) => `${intent.goal.summary} (${intent.status})`,
	);
	// Pass through all memory hints — context budget trimming happens downstream
	const recentMemoryHints = input.context.user.recentMemoryHints;
	const permissionSummary = [
		...input.context.permissions.autoAllowed
			.slice(0, 2)
			.map((line) => `auto: ${line}`),
		...input.context.permissions.approvalRequired
			.slice(0, 2)
			.map((line) => `ask: ${line}`),
		...input.context.permissions.denied
			.slice(0, 2)
			.map((line) => `deny: ${line}`),
	];
	// Pass through full thread messages — context budget trimming happens downstream
	const recentThreadMessages = (input.recentThreadMessages ?? [])
		.map(
			(message) =>
				`${message.role}: ${message.content.replace(/\s+/g, " ").trim()}`,
		)
		.filter(Boolean);

	return {
		summary: [
			`project=${input.context.project.rootDir}`,
			`type=${input.context.project.type}`,
			`language=${input.context.project.language}`,
			`git=${input.context.project.gitStatus ?? "unknown"}`,
			`focusedFile=${input.context.project.focusedFile ?? "none"}`,
			`activeIntents=${activeIntentSummaries.length}`,
			`memoryHints=${recentMemoryHints.length}`,
			`scopeLabels=${input.context.user.scopeLabels.length}`,
			`approvalBoundaries=${input.context.permissions.approvalRequired.length}`,
		].join("; "),
		activeIntentSummaries,
		recentMemoryHints,
		permissionSummary,
		channelContext: {
			workingDirectory: input.context.environment.cwd,
			projectRoot: input.context.project.rootDir,
			focusedFile: input.context.project.focusedFile,
		},
		recentThreadMessages,
	};
}

function compact(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}
