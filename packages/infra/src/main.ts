import { main } from "./cli/app.ts";

main(process.argv.slice(2)).catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
