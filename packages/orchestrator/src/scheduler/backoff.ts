/** Calculate exponential backoff delay in milliseconds */
export function backoffDelay(
	retries: number,
	baseSeconds: number,
	maxSeconds = 300,
): number {
	const delaySeconds = Math.min(baseSeconds * 2 ** retries, maxSeconds);
	// Add jitter: ±25%
	const jitter = delaySeconds * 0.25 * (Math.random() * 2 - 1);
	return Math.max(0, (delaySeconds + jitter) * 1000);
}
