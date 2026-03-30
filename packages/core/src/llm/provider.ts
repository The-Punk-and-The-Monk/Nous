import type {
	LLMRequest,
	LLMResponse,
	LLMStructuredOutputMode,
	StreamChunk,
} from "./types.ts";

export interface LLMProviderCapabilities {
	structuredOutputModes: LLMStructuredOutputMode[];
}

export interface LLMProvider {
	readonly name: string;
	getCapabilities(): LLMProviderCapabilities;

	/** Send a chat request and get the full response */
	chat(request: LLMRequest): Promise<LLMResponse>;

	/** Send a chat request and stream the response */
	stream(request: LLMRequest): AsyncIterable<StreamChunk>;
}
