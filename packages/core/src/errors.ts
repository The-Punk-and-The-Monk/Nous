/** Base error class for all Nous errors */
export class NousError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "NousError";
	}
}

export class CapabilityDeniedError extends NousError {
	readonly capability: string;
	readonly detail?: string;
	constructor(capability: string, detail?: string) {
		super(`Capability denied: ${capability}${detail ? ` — ${detail}` : ""}`);
		this.name = "CapabilityDeniedError";
		this.capability = capability;
		this.detail = detail;
	}
}

export class TaskNotFoundError extends NousError {
	constructor(taskId: string) {
		super(`Task not found: ${taskId}`);
		this.name = "TaskNotFoundError";
	}
}

export class AgentNotFoundError extends NousError {
	constructor(agentId: string) {
		super(`Agent not found: ${agentId}`);
		this.name = "AgentNotFoundError";
	}
}

export class IntentNotFoundError extends NousError {
	constructor(intentId: string) {
		super(`Intent not found: ${intentId}`);
		this.name = "IntentNotFoundError";
	}
}

export class HeartbeatTimeoutError extends NousError {
	constructor(taskId: string, lastHeartbeat: string) {
		super(
			`Heartbeat timeout for task ${taskId}. Last heartbeat: ${lastHeartbeat}`,
		);
		this.name = "HeartbeatTimeoutError";
	}
}
