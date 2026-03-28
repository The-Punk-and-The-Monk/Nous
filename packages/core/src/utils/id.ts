/**
 * ULID-based ID generation for time-ordered, sortable identifiers.
 * Using a simple implementation to avoid external dependencies.
 */

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(timestamp: number, len: number): string {
	let str = "";
	let remaining = timestamp;
	for (let i = len; i > 0; i--) {
		const mod = remaining % ENCODING_LEN;
		str = ENCODING[mod] + str;
		remaining = Math.floor(remaining / ENCODING_LEN);
	}
	return str;
}

function encodeRandom(len: number): string {
	let str = "";
	const bytes = crypto.getRandomValues(new Uint8Array(len));
	for (let i = 0; i < len; i++) {
		str += ENCODING[bytes[i] % ENCODING_LEN];
	}
	return str;
}

/** Generate a ULID (Universally Unique Lexicographically Sortable Identifier) */
export function ulid(): string {
	const now = Date.now();
	return encodeTime(now, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

/** Generate a prefixed ID for readability: "task_01ARZ3NDEKTSV4RRFFQ69G5FAV" */
export function prefixedId(prefix: string): string {
	return `${prefix}_${ulid()}`;
}
