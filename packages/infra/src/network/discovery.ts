/** Discovery service client — finds Nous instances by specialty */

export interface DiscoveryEntry {
	instanceId: string;
	publicKey: string;
	specialties: string[];
	registeredAt: string;
	lastSeen: string;
}

export interface DiscoveryClient {
	/** Register this instance with the discovery service */
	register(
		instanceId: string,
		publicKey: string,
		specialties: string[],
	): Promise<void>;
	/** Find instances by specialty domain */
	discover(domain: string, limit?: number): Promise<DiscoveryEntry[]>;
	/** Send a heartbeat to stay visible */
	heartbeat(instanceId: string): Promise<void>;
}

/** HTTP-based discovery client that talks to the relay server */
export class HttpDiscoveryClient implements DiscoveryClient {
	constructor(private relayUrl: string) {}

	async register(
		instanceId: string,
		publicKey: string,
		specialties: string[],
	): Promise<void> {
		await fetch(`${this.relayUrl}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ instanceId, publicKey, specialties }),
		});
	}

	async discover(domain: string, limit = 10): Promise<DiscoveryEntry[]> {
		const res = await fetch(
			`${this.relayUrl}/discover?domain=${encodeURIComponent(domain)}&limit=${limit}`,
		);
		if (!res.ok) return [];
		return (await res.json()) as DiscoveryEntry[];
	}

	async heartbeat(instanceId: string): Promise<void> {
		await fetch(`${this.relayUrl}/heartbeat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ instanceId }),
		});
	}
}
