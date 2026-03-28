import type { Database } from "bun:sqlite";
import type { MemoryEntry, MemoryTier } from "@nous/core";
import type { MemoryQuery, MemoryStore } from "../interfaces/memory-store.ts";

export class SQLiteMemoryStore implements MemoryStore {
	constructor(private db: Database) {}

	store(entry: MemoryEntry): void {
		this.db
			.prepare(
				`INSERT INTO memory (id, tier, agent_id, content, metadata, embedding,
			 created_at, last_accessed_at, access_count, retention_score, digested_from)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				entry.id,
				entry.tier,
				entry.agentId,
				entry.content,
				JSON.stringify(entry.metadata),
				entry.embedding
					? new Uint8Array(new Float64Array(entry.embedding).buffer)
					: null,
				entry.createdAt,
				entry.lastAccessedAt,
				entry.accessCount,
				entry.retentionScore,
				entry.digestedFrom ? JSON.stringify(entry.digestedFrom) : null,
			);
	}

	getById(id: string): MemoryEntry | undefined {
		const row = this.db
			.prepare("SELECT * FROM memory WHERE id = ?")
			.get(id) as RawMemoryRow | null;
		return row ? toMemoryEntry(row) : undefined;
	}

	update(id: string, fields: Partial<MemoryEntry>): void {
		const sets: string[] = [];
		const params: (string | number | Uint8Array | null)[] = [];

		const fieldMap: Record<string, string> = {
			agentId: "agent_id",
			createdAt: "created_at",
			lastAccessedAt: "last_accessed_at",
			accessCount: "access_count",
			retentionScore: "retention_score",
			digestedFrom: "digested_from",
		};

		for (const [key, value] of Object.entries(fields)) {
			const col = fieldMap[key] ?? key;
			if (key === "metadata") {
				sets.push(`${col} = ?`);
				params.push(JSON.stringify(value));
			} else if (key === "embedding") {
				sets.push(`${col} = ?`);
				const arr = value as number[] | undefined;
				params.push(arr ? new Uint8Array(new Float64Array(arr).buffer) : null);
			} else if (key === "digestedFrom") {
				sets.push(`${col} = ?`);
				params.push(value ? JSON.stringify(value) : null);
			} else {
				sets.push(`${col} = ?`);
				params.push((value as string | number | null) ?? null);
			}
		}

		if (sets.length === 0) return;

		// Also update content in FTS if content changed
		params.push(id);
		this.db
			.prepare(`UPDATE memory SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	delete(id: string): void {
		this.db.prepare("DELETE FROM memory WHERE id = ?").run(id);
	}

	query(q: MemoryQuery): MemoryEntry[] {
		const conditions: string[] = [];
		const params: (string | number | null)[] = [];

		if (q.agentId) {
			conditions.push("agent_id = ?");
			params.push(q.agentId);
		}
		if (q.tier) {
			conditions.push("tier = ?");
			params.push(q.tier);
		}
		if (q.search) {
			conditions.push(
				"id IN (SELECT id FROM memory_fts WHERE memory_fts MATCH ?)",
			);
			params.push(q.search);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const limit = q.limit ? `LIMIT ${q.limit}` : "";
		const offset = q.offset ? `OFFSET ${q.offset}` : "";

		const rows = this.db
			.prepare(
				`SELECT * FROM memory ${where} ORDER BY last_accessed_at DESC ${limit} ${offset}`,
			)
			.all(...params) as RawMemoryRow[];
		return rows.map(toMemoryEntry);
	}

	search(agentId: string, text: string, limit = 10): MemoryEntry[] {
		const rows = this.db
			.prepare(
				`SELECT m.* FROM memory m
			 JOIN memory_fts f ON m.id = f.id
			 WHERE f.memory_fts MATCH ? AND m.agent_id = ?
			 ORDER BY rank
			 LIMIT ?`,
			)
			.all(text, agentId, limit) as RawMemoryRow[];
		return rows.map(toMemoryEntry);
	}

	getByTier(agentId: string, tier: MemoryTier): MemoryEntry[] {
		const rows = this.db
			.prepare(
				"SELECT * FROM memory WHERE agent_id = ? AND tier = ? ORDER BY last_accessed_at DESC",
			)
			.all(agentId, tier) as RawMemoryRow[];
		return rows.map(toMemoryEntry);
	}

	pruneOlderThan(tier: MemoryTier, beforeTimestamp: string): number {
		const result = this.db
			.prepare("DELETE FROM memory WHERE tier = ? AND last_accessed_at < ?")
			.run(tier, beforeTimestamp);
		return result.changes;
	}
}

interface RawMemoryRow {
	id: string;
	tier: string;
	agent_id: string;
	content: string;
	metadata: string;
	embedding: Uint8Array | null;
	created_at: string;
	last_accessed_at: string;
	access_count: number;
	retention_score: number;
	digested_from: string | null;
}

function toMemoryEntry(row: RawMemoryRow): MemoryEntry {
	return {
		id: row.id,
		tier: row.tier as MemoryTier,
		agentId: row.agent_id,
		content: row.content,
		metadata: JSON.parse(row.metadata),
		embedding: row.embedding
			? Array.from(new Float64Array(row.embedding.buffer))
			: undefined,
		createdAt: row.created_at,
		lastAccessedAt: row.last_accessed_at,
		accessCount: row.access_count,
		retentionScore: row.retention_score,
		digestedFrom: row.digested_from ? JSON.parse(row.digested_from) : undefined,
	};
}
