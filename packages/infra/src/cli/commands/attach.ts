import type { DialogueMessage, ThreadSnapshot } from "@nous/core";
import { colors } from "../ui/colors.ts";

export function attachCommand(snapshot: ThreadSnapshot): void {
	console.log(colors.bold(`\n  νοῦς — Thread ${snapshot.thread.id}\n`));
	if (snapshot.thread.title) {
		console.log(`  ${colors.cyan("Title:")} ${snapshot.thread.title}`);
	}
	console.log(`  ${colors.dim("Status:")} ${snapshot.thread.status}\n`);

	for (const message of snapshot.messages) {
		renderDialogueMessage(message);
	}

	if (snapshot.pendingOutbox.length > 0) {
		console.log(
			`\n  ${colors.yellow("Pending outbox:")} ${snapshot.pendingOutbox.length}`,
		);
		for (const entry of snapshot.pendingOutbox) {
			console.log(
				`    ${colors.dim(entry.id.slice(0, 12))} → ${entry.targetChannel ?? "any"} (${entry.status})`,
			);
		}
	}

	console.log();
}

export function renderDialogueMessage(
	message: DialogueMessage,
	options?: { prefix?: string },
): void {
	const role =
		message.role === "human"
			? colors.cyan("human")
			: message.role === "assistant"
				? colors.green("nous")
				: colors.dim(message.role);
	const prefix = options?.prefix ? `${options.prefix} ` : "  ";
	console.log(
		`${prefix}${role} ${colors.dim(message.createdAt)} ${message.content}`,
	);
}
