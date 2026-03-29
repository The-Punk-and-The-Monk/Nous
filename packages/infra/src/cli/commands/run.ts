import type {
	IntentExecutionOptions,
	Orchestrator,
	ProgressEvent,
} from "@nous/orchestrator";
import { colors } from "../ui/colors.ts";
import { Spinner } from "../ui/spinner.ts";

export async function runCommand(
	orchestrator: Orchestrator,
	intentText: string,
	options?: IntentExecutionOptions,
): Promise<void> {
	const spinner = new Spinner();

	console.log(colors.bold("\n  νοῦς — Autonomous Agent Framework\n"));
	console.log(`  ${colors.dim("Intent:")} ${intentText}\n`);

	orchestrator.onProgress((event: ProgressEvent) => {
		switch (event.type) {
			case "intent.parsed":
				spinner.succeed(
					`Intent parsed: ${(event.data.goal as { summary: string }).summary}`,
				);
				break;
			case "tasks.planned":
				console.log(
					`  ${colors.cyan("⊞")} ${event.data.taskCount} tasks planned:`,
				);
				for (const task of event.data.tasks as {
					id: string;
					description: string;
				}[]) {
					console.log(`    ${colors.dim("→")} ${task.description}`);
				}
				console.log();
				break;
			case "task.started":
				spinner.start(
					`Running task ${colors.dim(String(event.data.taskId).slice(0, 12))}...`,
				);
				break;
			case "task.completed": {
				spinner.succeed("Task completed");
				const output = event.data.output as string | undefined;
				if (output) {
					console.log(`\n${colors.dim("─".repeat(60))}`);
					console.log(output);
					console.log(`${colors.dim("─".repeat(60))}\n`);
				}
				break;
			}
			case "task.failed":
				spinner.fail(`Task failed: ${event.data.error}`);
				break;
			case "intent.achieved":
				console.log(`  ${colors.green(colors.bold("✓ Intent achieved!"))}\n`);
				break;
			case "escalation":
				console.log(
					`\n  ${colors.yellow("⚠ Escalation:")} ${event.data.reason}\n`,
				);
				break;
		}
	});

	spinner.start("Parsing intent...");

	try {
		await orchestrator.submitIntent(intentText, options);
	} catch (err) {
		spinner.fail(`Failed: ${(err as Error).message}`);
		process.exit(1);
	}
}
