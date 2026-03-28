import type { EventStore } from "@nous/persistence";
import { colors } from "../ui/colors.ts";

export function eventsCommand(
	eventStore: EventStore,
	options: { limit?: number; type?: string; entity?: string },
): void {
	console.log(colors.bold("\n  νοῦς — Event Log\n"));

	const events = eventStore.query({
		type: options.type as Parameters<typeof eventStore.query>[0]["type"],
		limit: options.limit ?? 50,
	});

	if (events.length === 0) {
		console.log("  No events found.\n");
		return;
	}

	const typeColors: Record<string, (s: string) => string> = {
		"task.completed": colors.green,
		"task.failed": colors.red,
		"task.timeout": colors.red,
		"task.started": colors.blue,
		"task.assigned": colors.blue,
		"task.created": colors.dim,
		"task.queued": colors.dim,
		"intent.created": colors.cyan,
		"intent.achieved": colors.green,
		"intent.abandoned": colors.yellow,
		"tool.called": colors.dim,
		"tool.executed": colors.dim,
		"task.escalated": colors.yellow,
	};

	for (const event of events) {
		const colorFn = typeColors[event.type] ?? colors.dim;
		const ts = event.timestamp.slice(11, 23); // HH:mm:ss.SSS
		const entity = `${event.entityType}:${event.entityId.slice(0, 12)}`;
		const payloadStr = event.payload
			? ` ${colors.dim(JSON.stringify(event.payload).slice(0, 80))}`
			: "";

		console.log(
			`  ${colors.dim(ts)} ${colorFn(event.type.padEnd(20))} ${colors.dim(entity)}${payloadStr}`,
		);
	}

	console.log(`\n  ${colors.dim(`Showing ${events.length} events`)}\n`);
}
