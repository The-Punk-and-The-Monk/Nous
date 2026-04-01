import type { ContentBlock, LLMMessage } from "@nous/core";

/** Tracks token usage and manages context window compaction */
export class ContextManager {
	private tokenCount = 0;
	private readonly maxTokens: number;
	private readonly compactionThreshold: number;

	constructor(maxTokens = 180000, compactionThreshold = 0.75) {
		this.maxTokens = maxTokens;
		this.compactionThreshold = compactionThreshold;
	}

	/** Estimate token count for a message (rough: ~4 chars per token) */
	estimateTokens(messages: LLMMessage[]): number {
		let chars = 0;
		for (const msg of messages) {
			if (typeof msg.content === "string") {
				chars += msg.content.length;
			} else {
				for (const block of msg.content) {
					chars += blockLength(block);
				}
			}
		}
		return Math.ceil(chars / 4);
	}

	/** Update tracked token count from LLM response usage */
	updateUsage(inputTokens: number, outputTokens: number): void {
		this.tokenCount = inputTokens + outputTokens;
	}

	/** Whether the context needs compaction */
	needsCompaction(): boolean {
		return this.tokenCount > this.maxTokens * this.compactionThreshold;
	}

	/** Compact messages by summarizing older tool results */
	compact(messages: LLMMessage[]): LLMMessage[] {
		if (messages.length <= 4) return messages;

		// Keep first message (system context) and last 4 messages, summarize the middle
		const keep = 4;
		const head = messages.slice(0, 1);
		const tail = messages.slice(-keep);
		const middle = messages.slice(1, -keep);

		if (middle.length === 0) return messages;

		// Summarize middle messages (thinking blocks are stripped — too large for compacted context)
		const summaryParts: string[] = [];
		for (const msg of middle) {
			if (typeof msg.content === "string") {
				if (msg.content.length > 200) {
					summaryParts.push(`[${msg.role}]: ${msg.content.slice(0, 200)}...`);
				} else {
					summaryParts.push(`[${msg.role}]: ${msg.content}`);
				}
			} else {
				for (const block of msg.content) {
					if (block.type === "tool_result") {
						const truncated =
							block.content.length > 100
								? `${block.content.slice(0, 100)}...`
								: block.content;
						summaryParts.push(`[tool_result]: ${truncated}`);
					}
					// thinking blocks are intentionally omitted from compaction
				}
			}
		}

		const summaryMessage: LLMMessage = {
			role: "user",
			content: `[CONTEXT COMPACTION — ${middle.length} earlier messages summarized]\n${summaryParts.join("\n")}`,
		};

		this.tokenCount = 0; // Reset — will be updated by next LLM call
		return [...head, summaryMessage, ...tail];
	}

	getTokenCount(): number {
		return this.tokenCount;
	}
}

function blockLength(block: ContentBlock): number {
	switch (block.type) {
		case "text":
			return block.text.length;
		case "tool_use":
			return block.name.length + JSON.stringify(block.input).length;
		case "tool_result":
			return block.content.length;
		case "thinking":
			return block.thinking.length;
	}
}
