import { NousError } from "../errors.ts";

export class LLMError extends NousError {
	constructor(
		message: string,
		public readonly provider: string,
		public readonly statusCode?: number,
	) {
		super(message);
		this.name = "LLMError";
	}
}

export class RateLimitError extends LLMError {
	constructor(
		provider: string,
		public readonly retryAfterMs?: number,
	) {
		super(`Rate limited by ${provider}`, provider, 429);
		this.name = "RateLimitError";
	}
}

export class ContextOverflowError extends LLMError {
	constructor(
		provider: string,
		public readonly maxTokens: number,
		public readonly requestedTokens: number,
	) {
		super(
			`Context overflow: ${requestedTokens} tokens exceeds max ${maxTokens}`,
			provider,
		);
		this.name = "ContextOverflowError";
	}
}
