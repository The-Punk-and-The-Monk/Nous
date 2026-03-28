const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
	private frame = 0;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private text: string;

	constructor(text = "") {
		this.text = text;
	}

	start(text?: string): void {
		if (text) this.text = text;
		this.intervalId = setInterval(() => {
			process.stdout.write(
				`\r${FRAMES[this.frame % FRAMES.length]} ${this.text}`,
			);
			this.frame++;
		}, 80);
	}

	update(text: string): void {
		this.text = text;
	}

	stop(finalText?: string): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		process.stdout.write(`\r${finalText ?? this.text}\n`);
	}

	succeed(text: string): void {
		this.stop(`\x1b[32m✓\x1b[0m ${text}`);
	}

	fail(text: string): void {
		this.stop(`\x1b[31m✗\x1b[0m ${text}`);
	}
}
