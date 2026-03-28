import type { Database } from "bun:sqlite";
import type { Event, EventEntityType } from "@nous/core";
import type { EventQuery, EventStore } from "../interfaces/event-store.ts";

export class SQLiteEventStore implements EventStore {
	constructor(private db: Database) {}

	append(event: Event): void {
		this.db
			.prepare(
				`INSERT INTO events (id, timestamp, type, entity_type, entity_id, payload, caused_by_event_id, agent_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				event.id,
				event.timestamp,
				event.type,
				event.entityType,
				event.entityId,
				JSON.stringify(event.payload),
				event.causedByEventId ?? null,
				event.agentId ?? null,
			);
	}

	getById(id: string): Event | undefined {
		const row = this.db
			.prepare("SELECT * FROM events WHERE id = ?")
			.get(id) as RawEventRow | null;
		return row ? toEvent(row) : undefined;
	}

	query(q: EventQuery): Event[] {
		const conditions: string[] = [];
		const params: (string | number | null)[] = [];

		if (q.entityType) {
			conditions.push("entity_type = ?");
			params.push(q.entityType);
		}
		if (q.entityId) {
			conditions.push("entity_id = ?");
			params.push(q.entityId);
		}
		if (q.type) {
			conditions.push("type = ?");
			params.push(q.type);
		}
		if (q.afterTimestamp) {
			conditions.push("timestamp > ?");
			params.push(q.afterTimestamp);
		}
		if (q.beforeTimestamp) {
			conditions.push("timestamp < ?");
			params.push(q.beforeTimestamp);
		}
		if (q.agentId) {
			conditions.push("agent_id = ?");
			params.push(q.agentId);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const limit = q.limit ? `LIMIT ${q.limit}` : "";
		const offset = q.offset ? `OFFSET ${q.offset}` : "";

		const rows = this.db
			.prepare(
				`SELECT * FROM events ${where} ORDER BY timestamp ASC ${limit} ${offset}`,
			)
			.all(...params) as RawEventRow[];
		return rows.map(toEvent);
	}

	getByEntity(entityType: EventEntityType, entityId: string): Event[] {
		return this.query({ entityType, entityId });
	}

	getCausalChain(eventId: string): Event[] {
		const chain: Event[] = [];
		let current = this.getById(eventId);
		while (current) {
			chain.unshift(current);
			if (!current.causedByEventId) break;
			current = this.getById(current.causedByEventId);
		}
		return chain;
	}

	count(q?: EventQuery): number {
		if (!q) {
			return (
				this.db.prepare("SELECT COUNT(*) as c FROM events").get() as {
					c: number;
				}
			).c;
		}
		const conditions: string[] = [];
		const params: (string | number | null)[] = [];
		if (q.entityType) {
			conditions.push("entity_type = ?");
			params.push(q.entityType);
		}
		if (q.type) {
			conditions.push("type = ?");
			params.push(q.type);
		}
		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		return (
			this.db
				.prepare(`SELECT COUNT(*) as c FROM events ${where}`)
				.get(...params) as { c: number }
		).c;
	}
}

interface RawEventRow {
	id: string;
	timestamp: string;
	type: string;
	entity_type: string;
	entity_id: string;
	payload: string;
	caused_by_event_id: string | null;
	agent_id: string | null;
}

function toEvent(row: RawEventRow): Event {
	return {
		id: row.id,
		timestamp: row.timestamp,
		type: row.type as Event["type"],
		entityType: row.entity_type as Event["entityType"],
		entityId: row.entity_id,
		payload: JSON.parse(row.payload),
		causedByEventId: row.caused_by_event_id ?? undefined,
		agentId: row.agent_id ?? undefined,
	};
}
