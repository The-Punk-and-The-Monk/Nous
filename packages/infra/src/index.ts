// CLI
export { main } from "./cli/app.ts";

// Agents
export { createGeneralAgent } from "./agents/general.ts";
export { createAnalystAgent } from "./agents/analyst.ts";

// Supervisor
export { ProcessSupervisor } from "./supervisor/supervisor.ts";
export type { SupervisorConfig } from "./supervisor/supervisor.ts";

// UI utilities
export { colors } from "./cli/ui/colors.ts";
export { Spinner } from "./cli/ui/spinner.ts";
export { renderTaskTree, renderTaskList } from "./cli/ui/tree.ts";

// Network
export { RelayClient } from "./network/relay-client.ts";
export type { RelayClientConfig } from "./network/relay-client.ts";
export { generateIdentity, deriveSharedSecret } from "./network/identity.ts";
export type { NousIdentity } from "./network/identity.ts";
export { encrypt, decrypt } from "./network/encryption.ts";
export { HttpDiscoveryClient } from "./network/discovery.ts";
export type { DiscoveryEntry, DiscoveryClient } from "./network/discovery.ts";
export { PolicyEnforcer } from "./network/policy.ts";
