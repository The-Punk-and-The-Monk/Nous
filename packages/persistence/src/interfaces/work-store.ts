import type {
	Flow,
	FlowStatus,
	FlowThreadBinding,
	FlowThreadBindingRole,
	MergeCandidate,
	MergeCandidateStatus,
	PlanGraph,
	PlanGraphStatus,
	WorkRelation,
	WorkRelationKind,
} from "@nous/core";

export interface FlowQuery {
	statuses?: FlowStatus[];
	kinds?: Flow["kind"][];
	sources?: Flow["source"][];
	ownerThreadId?: string;
	limit?: number;
}

export interface PlanGraphQuery {
	flowId?: string;
	intentId?: string;
	statuses?: PlanGraphStatus[];
	limit?: number;
}

export interface WorkRelationQuery {
	flowId?: string;
	planGraphId?: string;
	fromId?: string;
	toId?: string;
	kinds?: WorkRelationKind[];
	limit?: number;
}

export interface MergeCandidateQuery {
	statuses?: MergeCandidateStatus[];
	leftId?: string;
	rightId?: string;
	limit?: number;
}

export interface FlowThreadBindingQuery {
	flowId?: string;
	threadId?: string;
	role?: FlowThreadBindingRole;
}

export interface WorkStore {
	createFlow(flow: Flow): void;
	getFlowById(id: string): Flow | undefined;
	updateFlow(id: string, fields: Partial<Flow>): void;
	listFlows(query?: FlowQuery): Flow[];

	createPlanGraph(planGraph: PlanGraph): void;
	getPlanGraphById(id: string): PlanGraph | undefined;
	updatePlanGraph(id: string, fields: Partial<PlanGraph>): void;
	listPlanGraphs(query?: PlanGraphQuery): PlanGraph[];

	createRelation(relation: WorkRelation): void;
	getRelationById(id: string): WorkRelation | undefined;
	listRelations(query?: WorkRelationQuery): WorkRelation[];

	createMergeCandidate(candidate: MergeCandidate): void;
	getMergeCandidateById(id: string): MergeCandidate | undefined;
	updateMergeCandidate(id: string, fields: Partial<MergeCandidate>): void;
	listMergeCandidates(query?: MergeCandidateQuery): MergeCandidate[];

	bindFlowThread(binding: FlowThreadBinding): void;
	listFlowThreadBindings(query?: FlowThreadBindingQuery): FlowThreadBinding[];
}
