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
			case "intent.clarification_needed": {
				spinner.fail("Clarification required");
				const questions = Array.isArray(event.data.clarificationQuestions)
					? event.data.clarificationQuestions
							.map((item) => String(item).trim())
							.filter(Boolean)
					: [];
				if (questions.length > 0) {
					console.log(`  ${colors.yellow("Need clarification:")}`);
					for (const question of questions) {
						console.log(`    ${colors.dim("→")} ${question}`);
					}
					console.log();
				}
				break;
			}
			case "intent.parsed":
				spinner.succeed(
					`Intent parsed: ${(event.data.goal as { summary: string }).summary}`,
				);
				break;
			case "intent.resumed":
				console.log(
					`  ${colors.cyan("↻")} Resuming original intent after clarification.`,
				);
				break;
			case "intent.revision_queued":
				console.log(
					`  ${colors.cyan("↺")} Scope update queued for the next safe execution boundary.`,
				);
				break;
			case "intent.replanned":
				console.log(
					`  ${colors.cyan("↻")} Intent replanned after applying the latest scope update.`,
				);
				break;
			case "intent.cancel_requested":
				console.log(
					`  ${colors.yellow("⏹")} Cancellation requested for the intent.`,
				);
				break;
			case "intent.cancelled":
				console.log(`  ${colors.yellow("■")} Intent cancelled.`);
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
			case "task.cancelled":
				spinner.fail(`Task cancelled: ${event.data.reason}`);
				break;
			case "task.failed":
				spinner.fail(`Task failed: ${event.data.error}`);
				break;
			case "intent.achieved":
				console.log(`  ${colors.green(colors.bold("✓ Intent achieved!"))}`);
				renderDelivery(event);
				console.log();
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

function renderDelivery(event: ProgressEvent): void {
	const delivery = event.data.delivery as
		| {
				summary?: string;
				evidence?: unknown[];
				risks?: unknown[];
				nextSteps?: unknown[];
		  }
		| undefined;
	if (!delivery) {
		console.log();
		return;
	}

	const summary = String(delivery.summary ?? "").trim();
	const evidence = normalizeLines(delivery.evidence);
	const risks = normalizeLines(delivery.risks);
	const nextSteps = normalizeLines(delivery.nextSteps);

	if (summary) {
		console.log(`\n  ${colors.dim("Summary:")} ${summary}`);
	}
	if (evidence.length > 0) {
		console.log(`  ${colors.dim("Evidence:")}`);
		for (const item of evidence) {
			console.log(`    ${colors.dim("•")} ${item}`);
		}
	}
	if (risks.length > 0) {
		console.log(`  ${colors.dim("Risks:")}`);
		for (const item of risks) {
			console.log(`    ${colors.dim("•")} ${item}`);
		}
	}
	if (nextSteps.length > 0) {
		console.log(`  ${colors.dim("Next:")}`);
		for (const item of nextSteps) {
			console.log(`    ${colors.dim("•")} ${item}`);
		}
	}
}

function normalizeLines(value: unknown): string[] {
	return Array.isArray(value)
		? value.map((item) => String(item).trim()).filter(Boolean)
		: [];
}
