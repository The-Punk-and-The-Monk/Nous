import type { MemoryEntry, MemoryTier } from "@nous/core";

export interface MemoryQuery {
	agentId?: string;
	tier?: MemoryTier;
	search?: string;
	limit?: number;
	offset?: number;
}

export interface MemoryStore {
	store(entry: MemoryEntry): void;
	getById(id: string): MemoryEntry | undefined;
	update(id: string, fields: Partial<MemoryEntry>): void;
	delete(id: string): void;
	query(q: MemoryQuery): MemoryEntry[];
	search(agentId: string, text: string, limit?: number): MemoryEntry[];
	getByTier(agentId: string, tier: MemoryTier): MemoryEntry[];
	pruneOlderThan(tier: MemoryTier, beforeTimestamp: string): number;
}
