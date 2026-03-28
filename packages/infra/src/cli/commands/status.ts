import type { IntentStore, TaskStore } from "@nous/persistence";
import { colors } from "../ui/colors.ts";
import { renderTaskList } from "../ui/tree.ts";

export function statusCommand(
	taskStore: TaskStore,
	intentStore: IntentStore,
): void {
	console.log(colors.bold("\n  νοῦς — Status\n"));

	const active = intentStore.getActive();
	if (active.length === 0) {
		console.log("  No active intents.\n");
		return;
	}

	for (const intent of active) {
		console.log(`  ${colors.cyan("Intent:")} ${intent.raw}`);
		console.log(`  ${colors.dim("ID:")} ${intent.id}`);
		console.log(`  ${colors.dim("Goal:")} ${intent.goal.summary}`);
		console.log();

		const tasks = taskStore.getByIntent(intent.id);
		if (tasks.length > 0) {
			console.log("  Tasks:");
			console.log(renderTaskList(tasks));
		}
		console.log();
	}

	// Summary counts
	const total = taskStore.count();
	const running = taskStore.count("running");
	const done = taskStore.count("done");
	const failed = taskStore.count("failed");

	console.log(
		`  ${colors.dim("Total:")} ${total}  ${colors.blue("Running:")} ${running}  ${colors.green("Done:")} ${done}  ${colors.red("Failed:")} ${failed}\n`,
	);
}
