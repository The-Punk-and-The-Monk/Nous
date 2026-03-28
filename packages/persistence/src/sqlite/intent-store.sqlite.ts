import type { Database } from "bun:sqlite";
import type { Intent, IntentStatus } from "@nous/core";
import type { IntentStore } from "../interfaces/intent-store.ts";

export class SQLiteIntentStore implements IntentStore {
	constructor(private db: Database) {}

	create(intent: Intent): void {
		this.db
			.prepare(
				`INSERT INTO intents (id, raw, goal, constraints, priority, human_checkpoints, status, source, created_at, achieved_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				intent.id,
				intent.raw,
				JSON.stringify(intent.goal),
				JSON.stringify(intent.constraints),
				intent.priority,
				intent.humanCheckpoints,
				intent.status,
				intent.source,
				intent.createdAt,
				intent.achievedAt ?? null,
			);
	}

	getById(id: string): Intent | undefined {
		const row = this.db
			.prepare("SELECT * FROM intents WHERE id = ?")
			.get(id) as RawIntentRow | null;
		return row ? toIntent(row) : undefined;
	}

	update(id: string, fields: Partial<Intent>): void {
		const sets: string[] = [];
		const params: (string | number | null)[] = [];

		const fieldMap: Record<string, string> = {
			humanCheckpoints: "human_checkpoints",
			createdAt: "created_at",
			achievedAt: "achieved_at",
		};

		for (const [key, value] of Object.entries(fields)) {
			const col = fieldMap[key] ?? key;
			if (key === "goal" || key === "constraints") {
				sets.push(`${col} = ?`);
				params.push(JSON.stringify(value));
			} else {
				sets.push(`${col} = ?`);
				params.push((value as string | number | null) ?? null);
			}
		}

		if (sets.length === 0) return;
		params.push(id);
		this.db
			.prepare(`UPDATE intents SET ${sets.join(", ")} WHERE id = ?`)
			.run(...params);
	}

	getByStatus(status: IntentStatus): Intent[] {
		const rows = this.db
			.prepare("SELECT * FROM intents WHERE status = ? ORDER BY created_at ASC")
			.all(status) as RawIntentRow[];
		return rows.map(toIntent);
	}

	getActive(): Intent[] {
		return this.getByStatus("active");
	}
}

interface RawIntentRow {
	id: string;
	raw: string;
	goal: string;
	constraints: string;
	priority: number;
	human_checkpoints: string;
	status: string;
	source: string;
	created_at: string;
	achieved_at: string | null;
}

function toIntent(row: RawIntentRow): Intent {
	return {
		id: row.id,
		raw: row.raw,
		goal: JSON.parse(row.goal),
		constraints: JSON.parse(row.constraints),
		priority: row.priority,
		humanCheckpoints: row.human_checkpoints as Intent["humanCheckpoints"],
		status: row.status as IntentStatus,
		source: row.source as Intent["source"],
		createdAt: row.created_at,
		achievedAt: row.achieved_at ?? undefined,
	};
}
