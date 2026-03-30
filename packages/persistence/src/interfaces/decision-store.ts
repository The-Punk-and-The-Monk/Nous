import type { Decision, DecisionStatus } from "@nous/core";

export interface DecisionStore {
	create(decision: Decision): void;
	getById(id: string): Decision | undefined;
	update(id: string, fields: Partial<Decision>): void;
	getByStatus(status: DecisionStatus): Decision[];
	getPendingByThread(threadId: string): Decision[];
	getQueuedByThread(threadId: string): Decision[];
	getPendingByIntent(intentId: string): Decision[];
}
