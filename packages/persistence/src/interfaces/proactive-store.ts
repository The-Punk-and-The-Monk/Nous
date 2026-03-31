import type {
	ProactiveCandidate,
	ProactiveCandidateStatus,
	ReflectionAgendaItem,
	ReflectionAgendaStatus,
	ReflectionRun,
	ReflectionRunOutcome,
} from "@nous/core";

export interface ReflectionAgendaQuery {
	statuses?: ReflectionAgendaStatus[];
	dedupeKey?: string;
	dueBefore?: string;
	projectRoot?: string;
	limit?: number;
}

export interface ProactiveCandidateQuery {
	statuses?: ProactiveCandidateStatus[];
	cooldownKey?: string;
	createdAfter?: string;
	createdBefore?: string;
	limit?: number;
}

export interface ReflectionRunQuery {
	outcome?: ReflectionRunOutcome;
	startedAfter?: string;
	limit?: number;
}

export interface ProactiveStore {
	createAgendaItem(item: ReflectionAgendaItem): void;
	getAgendaItemById(id: string): ReflectionAgendaItem | undefined;
	updateAgendaItem(id: string, fields: Partial<ReflectionAgendaItem>): void;
	listAgendaItems(query?: ReflectionAgendaQuery): ReflectionAgendaItem[];

	createRun(run: ReflectionRun): void;
	getRunById(id: string): ReflectionRun | undefined;
	listRuns(query?: ReflectionRunQuery): ReflectionRun[];

	createCandidate(candidate: ProactiveCandidate): void;
	getCandidateById(id: string): ProactiveCandidate | undefined;
	updateCandidate(id: string, fields: Partial<ProactiveCandidate>): void;
	listCandidates(query?: ProactiveCandidateQuery): ProactiveCandidate[];
}
