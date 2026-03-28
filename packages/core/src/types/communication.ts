import type { ISOTimestamp } from "../utils/timestamp.ts";

export type NousMessageType =
	| "pattern.contribute"
	| "pattern.validate"
	| "pattern.retract"
	| "consult.request"
	| "consult.response"
	| "consult.feedback"
	| "insight.broadcast"
	| "presence.heartbeat"
	| "presence.offline"
	| "handshake.initiate"
	| "handshake.accept"
	| "handshake.reject";

export interface NousMessage {
	id: string;
	from: string;
	to: string;
	type: NousMessageType;
	payload: unknown;
	timestamp: ISOTimestamp;
	ttl: number;
	replyTo?: string;
}

export interface CommunicationPolicy {
	networkEnabled: boolean;

	sharing: {
		enabled: boolean;
		autoShare: boolean;
		excludeDomains: string[];
		excludeKeywords: string[];
		minLocalConfidence: number;
	};

	respondToQueries: {
		enabled: boolean;
		autoRespond: boolean;
		maxConsultationsPerDay: number;
		allowedDomains: string[];
		blockedInstances: string[];
	};

	queryOthers: {
		enabled: boolean;
		autoQuery: boolean;
		maxQueriesPerDay: number;
		preferredSpecialists: string[];
	};

	collectiveInsights: {
		enabled: boolean;
		autoApply: boolean;
		minConfidence: number;
	};
}

export const DEFAULT_COMMUNICATION_POLICY: CommunicationPolicy = {
	networkEnabled: false,
	sharing: {
		enabled: false,
		autoShare: false,
		excludeDomains: [],
		excludeKeywords: [],
		minLocalConfidence: 0.8,
	},
	respondToQueries: {
		enabled: false,
		autoRespond: false,
		maxConsultationsPerDay: 10,
		allowedDomains: [],
		blockedInstances: [],
	},
	queryOthers: {
		enabled: false,
		autoQuery: false,
		maxQueriesPerDay: 10,
		preferredSpecialists: [],
	},
	collectiveInsights: {
		enabled: true,
		autoApply: false,
		minConfidence: 0.9,
	},
};
