/** ISO 8601 timestamp string type for documentation purposes */
export type ISOTimestamp = string;

/** Current time as ISO 8601 string */
export function now(): ISOTimestamp {
	return new Date().toISOString();
}

/** Parse ISO timestamp to Date */
export function parse(ts: ISOTimestamp): Date {
	return new Date(ts);
}

/** Milliseconds between two timestamps */
export function diffMs(a: ISOTimestamp, b: ISOTimestamp): number {
	return parse(a).getTime() - parse(b).getTime();
}

/** Check if a timestamp is older than N milliseconds from now */
export function isOlderThan(ts: ISOTimestamp, ms: number): boolean {
	return Date.now() - parse(ts).getTime() > ms;
}
