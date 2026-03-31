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
	const recentMemoryHints = input.context.user.recentMemoryHints.slice(0, 5);
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
	const recentThreadMessages = (input.recentThreadMessages ?? [])
		.slice(-6)
		.map(
			(message) =>
				`${message.role}: ${compact(message.content.replace(/\s+/g, " ").trim(), 180)}`,
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
