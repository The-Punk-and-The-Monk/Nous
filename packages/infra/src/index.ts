// CLI
export { main } from "./cli/app.ts";
export { createLLMProviderFromEnv } from "./cli/provider.ts";
export { daemonCommand, isDaemonRunning } from "./cli/commands/daemon.ts";
export { attachCommand } from "./cli/commands/attach.ts";
export {
	ensureNousHome,
	getNousPaths,
	loadNousConfig,
} from "./config/home.ts";
export type { NousConfig, NousPaths } from "./config/home.ts";

// Agents
export { createGeneralAgent } from "./agents/general.ts";
export { createAnalystAgent } from "./agents/analyst.ts";

// Daemon / dialogue foundation
export { DialogueService } from "./daemon/dialogue-service.ts";
export type {
	OutboundDelivery,
	DialogueServiceConfig,
	OutboundMessageRecord,
} from "./daemon/dialogue-service.ts";
export { DaemonClientSession, sendDaemonRequest } from "./daemon/client.ts";
export {
	StaticIntentConflictManager,
	deriveResourceClaims,
} from "./daemon/conflict-manager.ts";
export { DaemonController } from "./daemon/controller.ts";
export { NousDaemon } from "./daemon/server.ts";
export {
	PerceptionService,
	FileSystemSensor,
	GitSensor,
	HeuristicAttentionFilter,
} from "./daemon/perception.ts";

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
