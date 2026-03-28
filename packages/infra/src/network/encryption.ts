/** E2E encryption for inter-Nous communication using AES-GCM */

export async function encrypt(
	key: CryptoKey,
	plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);

	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);

	return {
		ciphertext: bufferToBase64(encrypted),
		iv: bufferToBase64(iv.buffer),
	};
}

export async function decrypt(
	key: CryptoKey,
	ciphertext: string,
	iv: string,
): Promise<string> {
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: base64ToBuffer(iv) },
		key,
		base64ToBuffer(ciphertext),
	);

	return new TextDecoder().decode(decrypted);
}

function bufferToBase64(buffer: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
