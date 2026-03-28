#!/usr/bin/env bun
import { main } from "@nous/infra";

main(process.argv.slice(2)).catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
