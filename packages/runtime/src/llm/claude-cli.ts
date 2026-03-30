import { spawn } from "node:child_process";
import type {
	ContentBlock,
	LLMMessage,
	LLMProvider,
	LLMProviderCapabilities,
	LLMRequest,
	LLMResponse,
	LLMResponseFormat,
	StreamChunk,
} from "@nous/core";
import { LLMError, createLogger } from "@nous/core";

const log = createLogger("claude-cli");

export interface ClaudeCliProviderOptions {
	/** Model alias: "sonnet", "opus", "haiku" (default: "sonnet") */
	model?: string;
	/** Working directory for CLI execution */
	cwd?: string;
	/** Subprocess timeout in ms (default: 300000 = 5 minutes) */
	timeout?: number;
	/** Path to claude binary (default: "claude") */
	claudePath?: string;
}

interface CliResult {
	type: "result";
	subtype: "success" | "error";
	is_error: boolean;
	result: string;
	structured_output?: unknown;
	stop_reason: string;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
	session_id: string;
	uuid: string;
}

export class ClaudeCliProvider implements LLMProvider {
	readonly name = "claude-cli";
	private model: string;
	private cwd: string;
	private timeout: number;
	private claudePath: string;

	constructor(options: ClaudeCliProviderOptions = {}) {
		this.model = options.model ?? "sonnet";
		this.cwd = options.cwd ?? process.cwd();
		this.timeout = options.timeout ?? 300000;
		this.claudePath = options.claudePath ?? "claude";
	}

	getCapabilities(): LLMProviderCapabilities {
		return {
			structuredOutputModes: ["json_schema", "prompt_only"],
		};
	}

	async chat(request: LLMRequest): Promise<LLMResponse> {
		const prompt = this.buildPrompt(request);
		const args = this.buildArgs(request, prompt);
		log.debug("Invoking CLI", {
			model: this.model,
			argCount: args.length,
			promptLen: prompt.length,
		});

		const result = await this.runCli(args);

		if (result.is_error || result.subtype === "error") {
			log.error("CLI returned error", { result: result.result?.slice(0, 200) });
			throw new LLMError(
				result.result || "CLI returned an error",
				"claude-cli",
			);
		}
		log.debug("CLI response received", {
			tokens: result.usage,
			stopReason: result.stop_reason,
		});

		// If structured_output is available (from --json-schema), use it as text
		let text: string;
		if (result.structured_output !== undefined) {
			text = JSON.stringify(result.structured_output);
		} else {
			text = result.result;
		}

		const content: ContentBlock[] = [{ type: "text" as const, text }];

		return {
			id: result.uuid ?? result.session_id ?? "cli-response",
			content,
			stopReason: mapStopReason(result.stop_reason),
			usage: {
				inputTokens: result.usage?.input_tokens ?? 0,
				outputTokens: result.usage?.output_tokens ?? 0,
			},
		};
	}

	async *stream(_request: LLMRequest): AsyncIterable<StreamChunk> {
		// For v1, use non-streaming: call chat() and emit the full response as chunks
		const response = await this.chat(_request);
		for (const block of response.content) {
			if (block.type === "text") {
				yield { type: "text_delta", text: block.text };
			}
		}
		yield { type: "message_end" };
	}

	private buildPrompt(request: LLMRequest): string {
		const parts: string[] = [];

		for (const msg of request.messages) {
			if (msg.role === "system") continue;

			const text =
				typeof msg.content === "string"
					? msg.content
					: msg.content
							.filter((b) => b.type === "text")
							.map((b) => (b as { text: string }).text)
							.join("\n");

			if (msg.role === "user") {
				parts.push(text);
			} else if (msg.role === "assistant") {
				parts.push(`<previous_response>${text}</previous_response>`);
			} else if (msg.role === "tool") {
				parts.push(`<tool_result>${text}</tool_result>`);
			}
		}

		return parts.join("\n\n");
	}

	private buildArgs(request: LLMRequest, prompt: string): string[] {
		const args = [
			"--print",
			"--output-format",
			"json",
			"--no-session-persistence",
			"--model",
			this.model,
		];

		if (request.system) {
			args.push("--system-prompt", request.system);
		}

		// If no tools requested and temperature is 0, this is a structured output call
		// (intent parsing, task planning). Use --json-schema to enforce JSON output.
		const jsonSchema = toClaudeJsonSchema(request.responseFormat);
		if (jsonSchema) {
			args.push("--json-schema", JSON.stringify(jsonSchema));
		} else if (
			(!request.tools || request.tools.length === 0) &&
			request.temperature === 0
		) {
			args.push(
				"--json-schema",
				JSON.stringify({
					type: "object",
					additionalProperties: true,
				}),
			);
		}

		args.push("--", prompt);
		return args;
	}

	private runCli(args: string[]): Promise<CliResult> {
		return new Promise((resolve, reject) => {
			const child = spawn(this.claudePath, args, {
				cwd: this.cwd,
				env: { ...process.env },
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			child.stdout?.on("data", (chunk: Buffer) => {
				stdout += chunk.toString();
			});

			child.stderr?.on("data", (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			// Close stdin immediately — prompt is passed as argument
			child.stdin?.end();

			const timer = setTimeout(() => {
				child.kill("SIGTERM");
				reject(
					new LLMError(
						`Claude CLI timed out after ${this.timeout}ms`,
						"claude-cli",
					),
				);
			}, this.timeout);

			child.on("error", (err) => {
				clearTimeout(timer);
				if ((err as NodeJS.ErrnoException).code === "ENOENT") {
					reject(
						new LLMError(
							`Claude CLI not found at "${this.claudePath}". Install it with: npm install -g @anthropic-ai/claude-code`,
							"claude-cli",
						),
					);
				} else {
					reject(
						new LLMError(`Claude CLI error: ${err.message}`, "claude-cli"),
					);
				}
			});

			child.on("close", (code) => {
				clearTimeout(timer);

				if (code !== 0 && !stdout.trim()) {
					reject(
						new LLMError(
							`Claude CLI exited with code ${code}: ${stderr.trim() || "unknown error"}`,
							"claude-cli",
						),
					);
					return;
				}

				try {
					// The CLI may output multiple JSON lines; take the last complete one
					const lines = stdout.trim().split("\n").filter(Boolean);
					let result: CliResult | undefined;
					for (let i = lines.length - 1; i >= 0; i--) {
						try {
							const parsed = JSON.parse(lines[i]);
							if (parsed.type === "result") {
								result = parsed;
								break;
							}
						} catch {
							// skip non-JSON lines
						}
					}

					if (!result) {
						// If no "result" type, try parsing the entire stdout as a single JSON
						result = JSON.parse(stdout.trim());
					}

					resolve(result as CliResult);
				} catch (err) {
					reject(
						new LLMError(
							`Failed to parse CLI output: ${(err as Error).message}\nstdout: ${stdout.slice(0, 500)}\nstderr: ${stderr.slice(0, 200)}`,
							"claude-cli",
						),
					);
				}
			});
		});
	}
}

function toClaudeJsonSchema(
	format?: LLMResponseFormat,
): Record<string, unknown> | undefined {
	if (!format || format.type === "text") return undefined;
	if (format.type === "json_object") {
		return {
			type: "object",
			additionalProperties: true,
		};
	}
	return format.schema;
}

function mapStopReason(reason: string | undefined): LLMResponse["stopReason"] {
	switch (reason) {
		case "end_turn":
			return "end_turn";
		case "tool_use":
			return "tool_use";
		case "max_tokens":
			return "max_tokens";
		case "stop_sequence":
			return "stop_sequence";
		default:
			return "end_turn";
	}
}
