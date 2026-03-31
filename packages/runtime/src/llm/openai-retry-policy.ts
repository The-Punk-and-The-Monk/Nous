import { LLMError, RateLimitError } from "@nous/core";
import { APIError } from "openai";

export async function executeOpenAIRetryPolicy<T>(params: {
	providerName: string;
	maxRetries: number;
	operation: (attempt: number) => Promise<T>;
}): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= params.maxRetries; attempt++) {
		try {
			return await params.operation(attempt);
		} catch (error) {
			lastError = error as Error;
			if (isOpenAIRateLimitError(error)) {
				const retryAfter = getOpenAIRetryAfterMs(error);
				if (attempt < params.maxRetries) {
					await sleep(retryAfter ?? 1000 * 2 ** attempt);
					continue;
				}
				throw new RateLimitError(params.providerName, retryAfter);
			}
			throw toOpenAILLMError(params.providerName, error);
		}
	}

	throw new LLMError(
		lastError?.message ?? "Max retries exceeded",
		params.providerName,
	);
}

export function summarizeOpenAIError(err: unknown): Record<string, unknown> {
	if (err instanceof APIError) {
		return {
			errorName: err.name,
			status: err.status,
			code: err.code,
			errorType: err.type,
			param: err.param,
			requestId: err.requestID,
			message: clip(err.message, 500),
			upstreamError: err.error
				? clip(JSON.stringify(err.error), 2000)
				: undefined,
		};
	}
	if (err instanceof Error) {
		return {
			errorName: err.name,
			status: (err as { status?: number }).status,
			message: clip(err.message, 500),
		};
	}
	return { errorName: typeof err, message: clip(String(err), 500) };
}

function toOpenAILLMError(providerName: string, err: unknown): LLMError {
	if (err instanceof LLMError) {
		return err;
	}
	if (err instanceof Error) {
		return new LLMError(
			err.message,
			providerName,
			(err as { status?: number }).status,
		);
	}
	return new LLMError(String(err), providerName);
}

function isOpenAIRateLimitError(err: unknown): boolean {
	return (err as { status?: number }).status === 429;
}

function getOpenAIRetryAfterMs(err: unknown): number | undefined {
	const headers = (err as { headers?: Record<string, string> }).headers;
	const retryAfter = headers?.["retry-after"];
	if (retryAfter) {
		return Number.parseFloat(retryAfter) * 1000;
	}
	return undefined;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function clip(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}…`;
}
