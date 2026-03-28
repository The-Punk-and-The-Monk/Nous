import type { LLMMessage } from "@nous/core";

/** Tier 1: Working memory — manages the active context window */
export class WorkingMemory {
	private messages: LLMMessage[] = [];
	private systemContext = "";
	private readonly maxMessages: number;

	constructor(maxMessages = 50) {
		this.maxMessages = maxMessages;
	}

	setSystemContext(context: string): void {
		this.systemContext = context;
	}

	getSystemContext(): string {
		return this.systemContext;
	}

	addMessage(message: LLMMessage): void {
		this.messages.push(message);
		// Auto-trim if over capacity
		if (this.messages.length > this.maxMessages) {
			this.messages = this.messages.slice(-this.maxMessages);
		}
	}

	getMessages(): LLMMessage[] {
		return [...this.messages];
	}

	clear(): void {
		this.messages = [];
	}

	size(): number {
		return this.messages.length;
	}
}
