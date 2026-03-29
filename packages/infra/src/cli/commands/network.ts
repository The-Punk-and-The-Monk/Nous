import type { EventStore } from "@nous/persistence";
import {
	ensureNousIdentity,
	loadCommunicationPolicy,
	setNetworkEnabled,
} from "../../config/network.ts";
import { InterNousSeedExchange } from "../../network/exchange.ts";
import { colors } from "../ui/colors.ts";

export async function networkCommand(
	args: string[],
	deps: { eventStore: EventStore },
): Promise<void> {
	const action = args[0] ?? "status";
	const exchange = new InterNousSeedExchange({
		eventStore: deps.eventStore,
	});

	if (action === "status") {
		const status = await exchange.getStatus();
		console.log(colors.bold("\n  νοῦς — Inter-Nous Seed Status\n"));
		console.log(`  ${colors.dim("Instance:")} ${status.instanceId}`);
		console.log(
			`  ${colors.dim("Network:")} ${status.networkEnabled ? colors.green("enabled") : colors.yellow("paused")}`,
		);
		console.log(
			`  ${colors.dim("Validated procedures:")} ${status.validatedProcedures}`,
		);
		console.log(
			`  ${colors.dim("Imported procedures:")} ${status.importedProcedures}`,
		);
		console.log(`  ${colors.dim("Export bundles:")} ${status.exportBundles}`);
		console.log(`  ${colors.dim("Import bundles:")} ${status.importBundles}`);
		return;
	}

	if (action === "enable") {
		const policy = setNetworkEnabled(true);
		const identity = await ensureNousIdentity();
		console.log(
			`\n  ${colors.green("Inter-Nous exchange enabled.")} ${colors.dim(identity.instanceId)}\n`,
		);
		console.log(
			`  ${colors.dim("sharing.enabled:")} ${String(policy.sharing.enabled)}`,
		);
		return;
	}

	if (action === "pause" || action === "disable") {
		setNetworkEnabled(false);
		console.log(`\n  ${colors.yellow("Inter-Nous exchange paused.")}\n`);
		return;
	}

	if (action === "policy") {
		const policy = loadCommunicationPolicy();
		console.log(
			`\n${JSON.stringify(policy, null, 2)
				.split("\n")
				.map((line) => `  ${line}`)
				.join("\n")}\n`,
		);
		return;
	}

	if (action === "procedures") {
		const procedures = exchange.listLocalValidatedProcedures();
		console.log(colors.bold("\n  Exportable Procedures\n"));
		if (procedures.length === 0) {
			console.log(`  ${colors.dim("No validated local procedures yet.")}\n`);
			return;
		}
		for (const procedure of procedures) {
			console.log(`  ${colors.cyan(procedure.fingerprint)}`);
			console.log(`    ${procedure.title}`);
			console.log(`    success=${procedure.successCount}`);
		}
		console.log();
		return;
	}

	if (action === "export") {
		const fingerprint = args[1];
		if (!fingerprint) {
			console.log(
				`\n  ${colors.yellow("Usage: nous network export <fingerprint> [--out <path>]")}\n`,
			);
			return;
		}
		const outIndex = args.indexOf("--out");
		const outputPath = outIndex >= 0 ? args[outIndex + 1] : undefined;
		const result = await exchange.exportProcedureSummary({
			fingerprint,
			outputPath,
		});
		console.log(colors.bold("\n  Procedure Summary Exported\n"));
		console.log(
			`  ${colors.dim("Fingerprint:")} ${result.bundle.procedure.fingerprint}`,
		);
		console.log(`  ${colors.dim("Bundle:")} ${result.bundlePath}\n`);
		return;
	}

	if (action === "import") {
		const bundlePath = args[1];
		if (!bundlePath) {
			console.log(
				`\n  ${colors.yellow("Usage: nous network import <bundlePath>")}\n`,
			);
			return;
		}
		const result = await exchange.importProcedureSummary(bundlePath);
		console.log(colors.bold("\n  Procedure Summary Imported\n"));
		console.log(`  ${colors.dim("From:")} ${result.bundle.from.instanceId}`);
		console.log(
			`  ${colors.dim("Fingerprint:")} ${result.bundle.procedure.fingerprint}`,
		);
		console.log(`  ${colors.dim("Stored bundle:")} ${result.storedBundlePath}`);
		console.log(
			`  ${colors.dim("Materialized:")} ${result.materializedPath}\n`,
		);
		return;
	}

	if (action === "log") {
		const limit = Number(args[1]) || 20;
		const events = exchange.listCommunicationEvents(limit);
		console.log(colors.bold("\n  Inter-Nous Communication Log\n"));
		if (events.length === 0) {
			console.log(`  ${colors.dim("No communication events yet.")}\n`);
			return;
		}
		for (const event of events) {
			console.log(`  ${event.timestamp}  ${colors.cyan(event.type)}`);
			console.log(`    ${JSON.stringify(event.payload)}`);
		}
		console.log();
		return;
	}

	console.log(
		`\n  ${colors.yellow("Usage: nous network <status|enable|pause|policy|procedures|export|import|log>")}\n`,
	);
}
