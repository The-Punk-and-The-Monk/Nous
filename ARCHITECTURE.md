# Nous — Architecture Design Document

> *Nous (νοῦς) — The active intellect that organizes chaos into order.*

## Design Philosophy

Five principles that govern every design decision:

1. **Failure is the norm, not the exception.**
   Every component assumes it will crash. Recovery paths are built in from the start, not bolted on.

2. **State is a first-class citizen.**
   Every entity (Task, Agent, Intent) has an explicit state machine. No implicit state allowed.

3. **Humans decide, machines execute.**
   The system minimizes human cognitive burden, not human control granularity.

4. **Observability is built-in, not a plugin.**
   Every operation is queryable, replayable, and auditable by design.

5. **Least capability.**
   Agents can only do what they are explicitly authorized to do. Default is deny.

---

## Core Vocabulary

The system's world is defined by seven abstractions. Getting these wrong means everything downstream is wrong.

| Concept | Owner | Description |
|---------|-------|-------------|
| **Intent** | Human | A goal expressed in natural language — fuzzy, high-level, may have constraints |
| **Plan** | Orchestrator | A decomposition of Intent into a Task DAG — revisable, not final |
| **Task** | Scheduler | An atomic unit of work with a full lifecycle (state machine, dependencies, retry policy) |
| **Agent** | Runtime | A persistent identity with memory, capabilities, and a behavioral profile |
| **Tool** | Runtime | An atomic capability (shell exec, file read, HTTP call, etc.) |
| **Event** | Persistence | An immutable record of what happened — the system's source of truth |
| **Memory** | Runtime | Layered persistent state (5 tiers, see Memory System below) |

### What OpenClaw and others lack

| Concept | OpenClaw | LangChain | AutoGPT | Nous |
|---------|----------|-----------|---------|------|
| Intent (separate from Task) | No | No | No | Yes |
| Plan (revisable DAG) | No | No | Partial | Yes |
| Task state machine | Partial | No | No | Yes |
| Agent persistence across sessions | File-based | No | No | Yes |
| Event sourcing | No | No | No | Yes |
| Procedural Memory | No | No | No | Yes |

---

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  L0 — Intent Plane                                          │
│  Natural language goal input · Constraints · Human Decision │
│  Queue (only truly blocking decisions reach the human)      │
├─────────────────────────────────────────────────────────────┤
│  L1 — Orchestration Plane                                   │
│  Intent Planner · Task Scheduler · Agent Router             │
├─────────────────────────────────────────────────────────────┤
│  L2 — Runtime Plane                                         │
│  Agent Runtime (ReAct loop) · Tool Sandbox · Memory Manager │
├─────────────────────────────────────────────────────────────┤
│  L3 — Persistence Plane                                     │
│  Event Store · Task Queue DB · Memory Store                 │
├─────────────────────────────────────────────────────────────┤
│  L4 — Infrastructure Plane                                  │
│  Channel Adapters · Process Supervisor · Observability ·    │
│  Security (capability tokens + audit)                       │
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** Dependencies flow downward only. L0 depends on L1, L1 on L2, etc. No upward dependencies.

### L0 — Intent Plane (`packages/orchestrator`)
- Receives natural language goals from humans
- Parses constraints and priorities
- Maintains the **Human Decision Queue**: only decisions that are irreversible, out-of-scope, or post-max-retry reach the human

### L1 — Orchestration Plane (`packages/orchestrator`)
- **Intent Planner**: Goal → structured Task DAG
- **Task Scheduler**: Manages task state machine, dependency resolution, retry with exponential backoff
- **Agent Router**: Matches task capability requirements to available agents

### L2 — Runtime Plane (`packages/runtime`)
- **Agent Runtime**: ReAct reasoning loop (Think → Act → Observe → repeat)
- **Tool Sandbox**: Isolated execution per tool, timeout enforcement, capability-scoped
- **Memory Manager**: Unified interface to 5-tier memory system

### L3 — Persistence Plane (`packages/persistence`)
- **Event Store**: Append-only log of all state transitions (event sourcing)
- **Task Queue DB**: SQLite-backed task state machine persistence
- **Memory Store**: Vector + full-text + graph index for semantic memory

### L4 — Infrastructure Plane (`packages/infra`)
- **Channel Adapters**: Plugin system for I/O channels (CLI, HTTP, WebSocket, etc.)
- **Process Supervisor**: Agent heartbeat monitoring, crash detection, restart
- **Observability**: Metrics, tracing, structured logging — all derived from Event Store
- **Security**: Capability token issuance and enforcement

---

## Core Data Models

### Task State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
Created ──► Queued ──► Assigned ──► Running ──► Done          │
                                      │                       │
                                      ├──► Failed ────────────┤
                                      │     (retries < max    │
                                      │      → re-queue)      │
                                      │                       │
                                      └──► Timeout ───────────┘
                                            (heartbeat gap
                                             > threshold)
                                              │
                                              ▼ (retries >= max)
                                          Escalated ──► Abandoned
                                          (human decides)
```

### Intent

```typescript
interface Intent {
  id: string;
  raw: string;                     // Original natural language
  goal: StructuredGoal;            // Parsed structured goal
  constraints: Constraint[];       // What NOT to do, resource limits
  priority: number;
  humanCheckpoints: CheckpointPolicy; // When must the system ask the human
  status: "active" | "achieved" | "abandoned";
}
```

### Task

```typescript
interface Task {
  id: string;
  intentId: string;
  parentTaskId?: string;           // Supports task trees
  dependsOn: string[];             // Task IDs this depends on

  description: string;
  assignedAgentId?: string;
  capabilitiesRequired: string[];  // Declares what capabilities are needed

  // State machine
  status: TaskStatus;              // created|queued|assigned|running|done|failed|timeout|escalated|abandoned
  retries: number;
  maxRetries: number;
  backoffSeconds: number;          // Exponential backoff base

  // Timestamps
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  lastHeartbeat?: string;
  completedAt?: string;

  result?: unknown;
  error?: string;
  escalationReason?: string;
}
```

### Agent

```typescript
interface Agent {
  id: string;
  name: string;
  role: "orchestrator" | "specialist" | "executor";
  capabilities: CapabilitySet;     // What this agent can do
  memoryId: string;                // Pointer to Memory Store
  currentTaskId?: string;
  status: "idle" | "working" | "suspended" | "offline";
  personality: AgentPersonality;   // Behavioral style, tool preferences
}
```

### Event

```typescript
interface Event {
  id: string;
  timestamp: string;
  type: EventType;
  entityType: "intent" | "task" | "agent" | "tool";
  entityId: string;
  payload: unknown;
  causedByEventId?: string;        // Causal chain
  agentId?: string;                // Who triggered this
}
```

---

## Capability Token System

Agents operate under the principle of least privilege. Capabilities are explicitly granted.

```typescript
interface CapabilitySet {
  "shell.exec": false | { allowlist: string[] };
  "fs.read": false | { paths: string[] };
  "fs.write": false | { paths: string[] };
  "browser.control": boolean;
  "network.http": false | { domains: string[] };
  "spawn_subagent": boolean;
  "memory.write": boolean;
  "escalate_to_human": boolean;
}
```

**Effective capability** at runtime = `AgentCapabilities ∩ TaskRequiredCapabilities ∩ IntentConstraints`

A task that requires `fs.write` assigned to an agent that only has `fs.read` will fail at assignment time, not at execution time.

---

## Memory System (5 Tiers)

```
┌──────────────────────────────────────────────────┐
│  Tier 5 — Prospective Memory                     │
│  Future commitments: scheduled tasks, pending     │
│  intents, promises made to the human              │
├──────────────────────────────────────────────────┤
│  Tier 4 — Procedural Memory  ← NEW vs OpenClaw   │
│  Successful task patterns: what worked before,    │
│  reusable execution paths, learned shortcuts      │
├──────────────────────────────────────────────────┤
│  Tier 3 — Semantic Memory                         │
│  Facts and knowledge: vector + graph indexed,     │
│  concept-based retrieval                          │
├──────────────────────────────────────────────────┤
│  Tier 2 — Episodic Memory                         │
│  Session transcripts: what happened, time-indexed │
├──────────────────────────────────────────────────┤
│  Tier 1 — Working Memory                          │
│  Context window: currently visible to the LLM,    │
│  compacted when full                              │
└──────────────────────────────────────────────────┘
```

**Tier 4 (Procedural Memory)** is the key differentiator. When an agent successfully completes a task like "add `tabs` permission to Chrome extension manifest.json", that execution path is stored. Next time a similar task appears, the agent retrieves the proven path instead of re-reasoning from scratch.

---

## Runtime Flow: From Intent to Execution

```
Human: "Add dark mode to this Chrome extension"
  │
  ▼
L0 Intent Plane
  │  Parse goal, identify constraints
  │  → Intent { goal: "add dark mode", constraints: [...] }
  │
  ▼
L1 Intent Planner
  │  Decompose into Task DAG:
  │  T1: Analyze current CSS structure
  │  T2: Create theme toggle component (depends on T1)
  │  T3: Add dark theme CSS variables (depends on T1)
  │  T4: Wire toggle into popup UI (depends on T2, T3)
  │  T5: Test in browser (depends on T4)
  │
  ▼
L1 Task Scheduler
  │  T1 has no dependencies → status: queued
  │
  ▼
L1 Agent Router
  │  T1 requires: [fs.read] → assign to Agent "code-analyst"
  │
  ▼
L2 Agent Runtime
  │  ReAct loop: Think → read files → Think → produce analysis
  │  Heartbeat every 3 minutes
  │  On completion: task_done(T1, result)
  │
  ▼
L1 Task Scheduler
  │  T1 done → T2, T3 unblocked → both queued
  │  ... continues until all tasks done
  │
  ▼
L0 Intent Plane
  │  All tasks complete → Intent status: achieved
  │  Result summary delivered to human
```

---

## Human Decision Queue (Minimal Interruption Design)

Not everything goes to the human. The system triages:

| Situation | Action |
|-----------|--------|
| Within capability, low risk | **Autonomous** — execute, log to Event Store, don't interrupt |
| Out of expected scope, but reversible | **Async notify** — execute, notify human, they can review later |
| Irreversible operation or exceeds authorization | **Block and wait** — enter Human Decision Queue, timeout → cancel |
| `maxRetries` exhausted | **Forced escalation** — full context attached, human decides next strategy |

---

## Scheduler Loop (Core Algorithm)

The Task Scheduler runs a tight loop (every 30 seconds):

```
for each task in DB:
  if status == "queued" AND all dependsOn are "done":
    → route to Agent Router → assign
  if status == "running" AND now - lastHeartbeat > HEARTBEAT_TIMEOUT:
    → mark timeout, retries++ < maxRetries ? re-queue with backoff : escalate
  if status == "failed" AND retries < maxRetries:
    → re-queue with exponential backoff (backoffSeconds * 2^retries)
```

---

## Open Questions (To Be Discussed)

These are design decisions that need resolution before implementation:

### 1. LLM Provider Strategy
- Single provider (e.g., Anthropic only) or multi-provider abstraction?
- How to handle provider-specific features (tool use format, context window sizes)?
- Should the framework be LLM-agnostic at the core level?

### 2. Persistence Backend
- SQLite for everything (simple, single-node) or pluggable (Postgres, etc.)?
- Event Store: append-only SQLite table vs dedicated event store (EventStoreDB)?
- Vector store for Semantic Memory: built-in (sqlite-vss) vs external (Qdrant, ChromaDB)?

### 3. Agent Identity and Lifecycle
- How are agents defined? Config files? Code? Runtime registration?
- Can agents be hot-reloaded without restarting the system?
- Should agents have versioning (roll back to a previous agent definition)?

### 4. Tool Sandbox Implementation
- Bun subprocess isolation vs Deno-style permission model vs Docker containers?
- How strict should sandboxing be? (Performance vs security tradeoff)
- Tool timeout and resource limit enforcement mechanism?

### 5. Inter-Agent Communication
- Direct message passing vs shared event bus vs both?
- Can an agent spawn sub-agents? If so, what's the supervision tree model?
- How to prevent infinite agent spawning loops?

### 6. Human Interface
- CLI-first? Web dashboard? Both?
- How does the Human Decision Queue surface to the user?
- Real-time streaming of agent reasoning (like Claude Code) or batch results only?

### 7. Deployment Model
- Single-process (all layers in one Bun process) for v1?
- When/how to split into separate services?
- How to handle state migration between deployment models?

### 8. Testing Strategy
- How to test agent behavior deterministically (LLM responses are non-deterministic)?
- Mock LLM layer for unit tests?
- Integration test strategy for the full pipeline?

### 9. Procedural Memory Details
- What constitutes a "reusable execution path"?
- How to match incoming tasks to stored procedures (semantic similarity? task type tagging?)?
- When should a stored procedure be invalidated (code changed, tool removed)?

### 10. Security Model
- Capability tokens: static config or dynamic (runtime request + approval)?
- Audit log requirements: who needs to see what?
- How to handle secrets (API keys, credentials) that tools need?
