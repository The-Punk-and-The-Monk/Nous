import type { EventStore } from "@nous/persistence";
import type { Event } from "@nous/core";
import { colors } from "../ui/colors.ts";

export async function eventsCommand(
	eventStore: EventStore,
	options: { limit?: number; type?: string; entity?: string; follow?: boolean },
): Promise<void> {
	console.log(colors.bold("\n  νοῦς — Event Log\n"));

	const events = eventStore.query({
		type: options.type as Parameters<typeof eventStore.query>[0]["type"],
		limit: options.limit ?? 50,
	});

	if (events.length === 0) {
		console.log("  No events found.\n");
		if (!options.follow) {
			return;
		}
	} else {
		printEvents(events);
		console.log(`\n  ${colors.dim(`Showing ${events.length} events`)}\n`);
	}

	if (!options.follow) {
		return;
	}

	console.log(`  ${colors.dim("Following new events. Press Ctrl+C to stop.")}\n`);
	let afterTimestamp = events.at(-1)?.timestamp;
	const seenIds = new Set(events.map((event) => event.id));
	while (true) {
		await sleep(1000);
		const next = eventStore.query({
			type: options.type as Parameters<typeof eventStore.query>[0]["type"],
			afterTimestamp,
			limit: options.limit ?? 50,
		});
		const fresh = next.filter((event) => !seenIds.has(event.id));
		if (fresh.length === 0) {
			continue;
		}
		printEvents(fresh);
		for (const event of fresh) {
			seenIds.add(event.id);
		}
		afterTimestamp = fresh.at(-1)?.timestamp ?? afterTimestamp;
	}
}

const TYPE_COLORS: Record<string, (s: string) => string> = {
	"task.completed": colors.green,
	"task.failed": colors.red,
	"task.timeout": colors.red,
	"task.started": colors.blue,
	"task.assigned": colors.blue,
	"task.created": colors.dim,
	"task.queued": colors.dim,
	"task.cancel_requested": colors.yellow,
	"task.cancelled": colors.yellow,
	"intent.created": colors.cyan,
	"intent.revision_requested": colors.cyan,
	"intent.replanned": colors.cyan,
	"intent.cancel_requested": colors.yellow,
	"intent.cancelled": colors.yellow,
	"intent.achieved": colors.green,
	"intent.abandoned": colors.yellow,
	"tool.called": colors.dim,
	"tool.executed": colors.dim,
	"task.escalated": colors.yellow,
};

function printEvents(events: Event[]): void {
	for (const event of events) {
		const colorFn = TYPE_COLORS[event.type] ?? colors.dim;
		const ts = event.timestamp.slice(11, 23);
		const entity = `${event.entityType}:${event.entityId.slice(0, 12)}`;
		const payloadStr = event.payload
			? ` ${colors.dim(JSON.stringify(event.payload).slice(0, 80))}`
			: "";

		console.log(
			`  ${colors.dim(ts)} ${colorFn(event.type.padEnd(20))} ${colors.dim(entity)}${payloadStr}`,
		);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
