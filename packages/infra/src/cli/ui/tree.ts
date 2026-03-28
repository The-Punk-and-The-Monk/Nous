import type { Task } from "@nous/core";
import { colors } from "./colors.ts";

const STATUS_ICONS: Record<string, string> = {
	created: "○",
	queued: "◎",
	assigned: "◉",
	running: "▶",
	done: "✓",
	failed: "✗",
	timeout: "⏱",
	escalated: "⚠",
	abandoned: "−",
};

const STATUS_COLORS: Record<string, (s: string) => string> = {
	created: colors.gray,
	queued: colors.yellow,
	assigned: colors.cyan,
	running: colors.blue,
	done: colors.green,
	failed: colors.red,
	timeout: colors.red,
	escalated: colors.magenta,
	abandoned: colors.gray,
};

/** Render a task DAG as a tree */
export function renderTaskTree(tasks: Task[]): string {
	const lines: string[] = [];
	const taskMap = new Map(tasks.map((t) => [t.id, t]));

	// Find root tasks (no parent)
	const roots = tasks.filter((t) => !t.parentTaskId);

	for (let i = 0; i < roots.length; i++) {
		const isLast = i === roots.length - 1;
		renderNode(roots[i], "", isLast, lines, taskMap);
	}

	return lines.join("\n");
}

function renderNode(
	task: Task,
	prefix: string,
	isLast: boolean,
	lines: string[],
	taskMap: Map<string, Task>,
): void {
	const connector = isLast ? "└── " : "├── ";
	const icon = STATUS_ICONS[task.status] ?? "?";
	const colorFn = STATUS_COLORS[task.status] ?? colors.gray;
	const statusText = colorFn(`${icon} [${task.status}]`);
	const desc =
		task.description.length > 60
			? `${task.description.slice(0, 57)}...`
			: task.description;

	lines.push(`${prefix}${connector}${statusText} ${desc}`);

	// Find children
	const children = [...taskMap.values()].filter(
		(t) => t.parentTaskId === task.id,
	);
	const childPrefix = prefix + (isLast ? "    " : "│   ");

	for (let i = 0; i < children.length; i++) {
		renderNode(
			children[i],
			childPrefix,
			i === children.length - 1,
			lines,
			taskMap,
		);
	}
}

/** Render a simple task list */
export function renderTaskList(tasks: Task[]): string {
	return tasks
		.map((t) => {
			const icon = STATUS_ICONS[t.status] ?? "?";
			const colorFn = STATUS_COLORS[t.status] ?? colors.gray;
			return `  ${colorFn(icon)} ${colors.dim(t.id.slice(0, 12))} ${t.description} ${colorFn(`[${t.status}]`)}`;
		})
		.join("\n");
}
