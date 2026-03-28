/** Provider-agnostic LLM types */

export interface LLMMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | ContentBlock[];
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface TextBlock {
	type: "text";
	text: string;
}

export interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
}

export interface ToolResultBlock {
	type: "tool_result";
	toolUseId: string;
	content: string;
	isError?: boolean;
}

export interface LLMToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface LLMRequest {
	messages: LLMMessage[];
	system?: string;
	tools?: LLMToolDef[];
	maxTokens: number;
	temperature?: number;
	stopSequences?: string[];
}

export interface LLMResponse {
	id: string;
	content: ContentBlock[];
	stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
	usage: {
		inputTokens: number;
		outputTokens: number;
	};
}

export interface StreamChunk {
	type:
		| "text_delta"
		| "tool_use_start"
		| "tool_use_delta"
		| "tool_use_end"
		| "message_end";
	text?: string;
	toolUse?: Partial<ToolUseBlock>;
	usage?: LLMResponse["usage"];
}
