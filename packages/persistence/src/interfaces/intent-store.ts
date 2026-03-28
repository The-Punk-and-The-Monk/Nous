import type { Intent, IntentStatus } from "@nous/core";

export interface IntentStore {
	create(intent: Intent): void;
	getById(id: string): Intent | undefined;
	update(id: string, fields: Partial<Intent>): void;
	getByStatus(status: IntentStatus): Intent[];
	getActive(): Intent[];
}
