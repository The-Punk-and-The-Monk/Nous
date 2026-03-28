import type { MemoryStore } from "@nous/persistence";
import { colors } from "../ui/colors.ts";

export function memoryCommand(
	memoryStore: MemoryStore,
	options: { tier?: string; search?: string; limit?: number },
): void {
	console.log(colors.bold("\n  νοῦς — Memory Store\n"));

	const memories = options.search
		? memoryStore.search("", options.search, options.limit ?? 20)
		: memoryStore.query({
				tier: options.tier as Parameters<typeof memoryStore.query>[0]["tier"],
				limit: options.limit ?? 20,
			});

	if (memories.length === 0) {
		console.log("  No memories found.\n");
		return;
	}

	const tierColors: Record<string, (s: string) => string> = {
		working: colors.blue,
		episodic: colors.cyan,
		semantic: colors.green,
		procedural: colors.yellow,
		prospective: colors.dim,
	};

	for (const mem of memories) {
		const colorFn = tierColors[mem.tier] ?? colors.dim;
		const ts = mem.createdAt.slice(0, 19).replace("T", " ");
		const content =
			mem.content.length > 100
				? `${mem.content.slice(0, 100)}...`
				: mem.content;

		console.log(
			`  ${colorFn(mem.tier.padEnd(12))} ${colors.dim(mem.id.slice(0, 12))}`,
		);
		console.log(
			`  ${colors.dim(ts)}  accesses=${mem.accessCount}  retention=${mem.retentionScore.toFixed(2)}`,
		);
		console.log(`  ${content}`);
		console.log();
	}

	console.log(`  ${colors.dim(`Showing ${memories.length} memories`)}\n`);
}
