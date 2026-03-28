/** DAG utilities: cycle detection and topological sort */

export interface DAGNode {
	id: string;
	dependsOn: string[];
}

/** Check if a DAG has cycles. Returns the cycle path if found, null otherwise. */
export function detectCycle(nodes: DAGNode[]): string[] | null {
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const path: string[] = [];

	function dfs(nodeId: string): string[] | null {
		if (inStack.has(nodeId)) {
			const cycleStart = path.indexOf(nodeId);
			return [...path.slice(cycleStart), nodeId];
		}
		if (visited.has(nodeId)) return null;

		visited.add(nodeId);
		inStack.add(nodeId);
		path.push(nodeId);

		const node = nodeMap.get(nodeId);
		if (node) {
			for (const dep of node.dependsOn) {
				const cycle = dfs(dep);
				if (cycle) return cycle;
			}
		}

		inStack.delete(nodeId);
		path.pop();
		return null;
	}

	for (const node of nodes) {
		const cycle = dfs(node.id);
		if (cycle) return cycle;
	}

	return null;
}

/** Topological sort of DAG nodes. Throws if cycles exist. */
export function topologicalSort(nodes: DAGNode[]): string[] {
	const cycle = detectCycle(nodes);
	if (cycle) {
		throw new Error(`DAG contains a cycle: ${cycle.join(" → ")}`);
	}

	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const visited = new Set<string>();
	const result: string[] = [];

	function visit(nodeId: string): void {
		if (visited.has(nodeId)) return;
		visited.add(nodeId);

		const node = nodeMap.get(nodeId);
		if (node) {
			for (const dep of node.dependsOn) {
				visit(dep);
			}
		}
		result.push(nodeId);
	}

	for (const node of nodes) {
		visit(node.id);
	}

	return result;
}

/** Get nodes that have no dependencies (roots of the DAG) */
export function getRoots(nodes: DAGNode[]): string[] {
	return nodes.filter((n) => n.dependsOn.length === 0).map((n) => n.id);
}
