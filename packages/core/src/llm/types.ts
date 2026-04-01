/** Provider-agnostic LLM types */

export interface LLMMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | ContentBlock[];
}

export type ContentBlock =
	| TextBlock
	| ToolUseBlock
	| ToolResultBlock
	| ThinkingBlock;

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

export interface ThinkingBlock {
	type: "thinking";
	thinking: string;
	/** Provider-specific signature for multi-turn continuity (Anthropic) */
	signature?: string;
	/** Provider that generated this thinking */
	providerHint?: string;
}

export interface ThinkingConfig {
	enabled: boolean;
	/** Budget in tokens for thinking. Anthropic: budget_tokens; OpenAI: maps to effort tier */
	budgetTokens?: number;
}

export interface LLMToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export type LLMStructuredOutputMode =
	| "prompt_only"
	| "json_object"
	| "json_schema"
	| "tool_calling";

export type LLMResponseFormat =
	| { type: "text" }
	| { type: "json_object" }
	| {
			type: "json_schema";
			name: string;
			schema: Record<string, unknown>;
			strict?: boolean;
	  };

export interface LLMRequest {
	messages: LLMMessage[];
	system?: string;
	tools?: LLMToolDef[];
	maxTokens: number;
	temperature?: number;
	stopSequences?: string[];
	responseFormat?: LLMResponseFormat;
	thinking?: ThinkingConfig;
}

export interface LLMResponse {
	id: string;
	content: ContentBlock[];
	stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
	usage: {
		inputTokens: number;
		outputTokens: number;
		thinkingTokens?: number;
	};
}

export interface StreamChunk {
	type:
		| "text_delta"
		| "thinking_delta"
		| "tool_use_start"
		| "tool_use_delta"
		| "tool_use_end"
		| "message_end";
	text?: string;
	toolUse?: Partial<ToolUseBlock>;
	usage?: LLMResponse["usage"];
	/** Signature emitted at end of a thinking block (Anthropic) */
	thinkingSignature?: string;
}
