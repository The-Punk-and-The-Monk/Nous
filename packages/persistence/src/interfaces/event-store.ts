import type { Event, EventEntityType, EventType } from "@nous/core";

export interface EventQuery {
	entityType?: EventEntityType;
	entityId?: string;
	type?: EventType;
	afterTimestamp?: string;
	beforeTimestamp?: string;
	agentId?: string;
	limit?: number;
	offset?: number;
}

export interface EventStore {
	append(event: Event): void;
	getById(id: string): Event | undefined;
	query(q: EventQuery): Event[];
	getByEntity(entityType: EventEntityType, entityId: string): Event[];
	getCausalChain(eventId: string): Event[];
	count(q?: EventQuery): number;
}
