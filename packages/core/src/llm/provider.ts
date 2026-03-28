import type { LLMRequest, LLMResponse, StreamChunk } from "./types.ts";

export interface LLMProvider {
	readonly name: string;

	/** Send a chat request and get the full response */
	chat(request: LLMRequest): Promise<LLMResponse>;

	/** Send a chat request and stream the response */
	stream(request: LLMRequest): AsyncIterable<StreamChunk>;
}
