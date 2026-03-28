import type { AgentRouter } from "@nous/orchestrator";
import { colors } from "../ui/colors.ts";

export function agentsCommand(router: AgentRouter): void {
	console.log(colors.bold("\n  νοῦς — Agents\n"));

	const agents = router.list();
	if (agents.length === 0) {
		console.log("  No agents registered.\n");
		return;
	}

	for (const agent of agents) {
		const statusColor =
			agent.status === "idle"
				? colors.green
				: agent.status === "working"
					? colors.blue
					: colors.gray;

		console.log(
			`  ${statusColor("●")} ${colors.bold(agent.name)} ${colors.dim(`(${agent.id.slice(0, 12)})`)}`,
		);
		console.log(
			`    Role: ${agent.role}  Status: ${statusColor(agent.status)}`,
		);
		console.log();
	}
}
