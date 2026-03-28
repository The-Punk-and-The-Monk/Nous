import type { ISOTimestamp } from "../utils/timestamp.ts";

export type EventEntityType =
	| "intent"
	| "task"
	| "agent"
	| "tool"
	| "sensor"
	| "communication";

export type EventType =
	// Intent events
	| "intent.created"
	| "intent.achieved"
	| "intent.abandoned"
	// Task events
	| "task.created"
	| "task.queued"
	| "task.assigned"
	| "task.started"
	| "task.heartbeat"
	| "task.completed"
	| "task.failed"
	| "task.timeout"
	| "task.escalated"
	| "task.abandoned"
	| "task.retried"
	// Agent events
	| "agent.registered"
	| "agent.assigned"
	| "agent.heartbeat"
	| "agent.idle"
	| "agent.suspended"
	| "agent.offline"
	// Tool events
	| "tool.called"
	| "tool.executed"
	| "tool.failed"
	| "tool.timeout"
	| "tool.capability_denied"
	// Sensor/perception events
	| "sensor.signal"
	| "sensor.dropped"
	| "attention.evaluated"
	| "attention.promoted"
	// Communication events
	| "comm.pattern_shared"
	| "comm.consultation_requested"
	| "comm.consultation_received"
	| "comm.consultation_responded"
	| "comm.insight_received"
	| "comm.policy_changed"
	| "comm.blocked"
	// Growth events
	| "growth.trust_updated"
	| "growth.stage_transition"
	| "growth.checkpoint_proposed"
	| "growth.capability_graduated";

export interface Event {
	id: string;
	timestamp: ISOTimestamp;
	type: EventType;
	entityType: EventEntityType;
	entityId: string;
	payload: unknown;
	causedByEventId?: string;
	agentId?: string;
}
