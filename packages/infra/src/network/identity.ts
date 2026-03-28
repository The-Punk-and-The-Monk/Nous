import { prefixedId } from "@nous/core";

export interface NousIdentity {
	instanceId: string;
	publicKey: string;
	privateKey: string;
	createdAt: string;
}

/** Generate an anonymous identity for a Nous instance using Web Crypto */
export async function generateIdentity(): Promise<NousIdentity> {
	const keyPair = await crypto.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveBits"],
	);

	const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
	const privateKeyRaw = await crypto.subtle.exportKey(
		"pkcs8",
		keyPair.privateKey,
	);

	return {
		instanceId: prefixedId("nous"),
		publicKey: bufferToBase64(publicKeyRaw),
		privateKey: bufferToBase64(privateKeyRaw),
		createdAt: new Date().toISOString(),
	};
}

/** Derive a shared secret from our private key and their public key */
export async function deriveSharedSecret(
	ourPrivateKeyBase64: string,
	theirPublicKeyBase64: string,
): Promise<CryptoKey> {
	const privateKey = await crypto.subtle.importKey(
		"pkcs8",
		base64ToBuffer(ourPrivateKeyBase64),
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		["deriveBits"],
	);

	const publicKey = await crypto.subtle.importKey(
		"raw",
		base64ToBuffer(theirPublicKeyBase64),
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[],
	);

	const sharedBits = await crypto.subtle.deriveBits(
		{ name: "ECDH", public: publicKey },
		privateKey,
		256,
	);

	return crypto.subtle.importKey(
		"raw",
		sharedBits,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
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
