import type { Agent, CapabilityName, CapabilitySet, Task } from "@nous/core";
import { hasCapability } from "@nous/core";

export class AgentRouter {
	private agents = new Map<string, Agent>();

	register(agent: Agent): void {
		this.agents.set(agent.id, agent);
	}

	unregister(agentId: string): void {
		this.agents.delete(agentId);
	}

	getAgent(id: string): Agent | undefined {
		return this.agents.get(id);
	}

	/** Find the best available agent for a task (first-fit strategy for v1) */
	findAgent(task: Task): Agent | undefined {
		for (const agent of this.agents.values()) {
			if (agent.status !== "idle") continue;
			if (this.hasRequiredCapabilities(agent, task)) {
				return agent;
			}
		}
		return undefined;
	}

	/** Check if an agent has all capabilities required by a task */
	private hasRequiredCapabilities(agent: Agent, task: Task): boolean {
		for (const cap of task.capabilitiesRequired) {
			if (!hasCapability(agent.capabilities, cap as CapabilityName)) {
				return false;
			}
		}
		return true;
	}

	/** Get all idle agents */
	getIdle(): Agent[] {
		return [...this.agents.values()].filter((a) => a.status === "idle");
	}

	/** Update agent status */
	updateStatus(agentId: string, status: Agent["status"]): void {
		const agent = this.agents.get(agentId);
		if (agent) {
			agent.status = status;
		}
	}

	list(): Agent[] {
		return [...this.agents.values()];
	}
}
