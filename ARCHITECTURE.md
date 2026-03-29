# Nous — Architecture Design Document

> *Nous (νοῦς) — The active intellect that organizes chaos into order.*

## First Principles: Why This Architecture Exists

Before any design decision, we need to reason from the bottom up — from computer science fundamentals to the future of human-AI interaction. This section records that reasoning process. It is not decoration; it is the intellectual foundation that every subsequent design choice must be traceable to.

### The History of Abstraction: Computers Absorb Human Cognitive Burden

The entire history of computing is one story: **machines progressively absorb the translation burden from humans.**

| Era | Interface | Who adapts to whom |
|-----|-----------|-------------------|
| 1950s | Punch cards, batch processing | Human adapts to machine's language |
| 1970s | Command-line terminals | Human learns machine's instruction set |
| 1984 | Graphical UI (Macintosh) | Machine adapts to human visual habits |
| 2007 | Touchscreen (iPhone) | Machine adapts to human tactile intuition |
| 2022 | LLM conversation | Machine understands human natural language |
| 2024 | Agent tool execution | Machine begins to act on human's behalf |
| Next | ? | Human only provides goals and values |

The pattern is clear: each step moves humans from the **operation layer** to the **decision layer**. The logical endpoint:

> Humans provide only goals and values. AI handles all translation, planning, execution, and iteration.

This is not science fiction. It is the abstraction ladder of software engineering, extended into the AI dimension.

### Where Agent Frameworks Are Today: The 1969 Unix Moment

Current agent frameworks are at the stage Unix was in 1969. The core concept (an "operating system for AI processes") has just emerged, but critical infrastructure is missing:

| OS Concept (1970s) | Agent Framework Equivalent | Status Today |
|--------------------|-----------------------------|-------------|
| Virtual memory | Context window management, memory tiers | Manual / primitive |
| Preemptive scheduling | Task scheduler with priorities | Polling-based, no preemption |
| Process table + health checks | Agent registry + heartbeat monitoring | Mostly absent |
| Inter-process communication | Agent-to-agent messaging | Ad-hoc (shared files, no protocol) |
| Permission model (rwx) | Capability tokens | Global permissions, no scoping |
| Process state machine | Task lifecycle management | Partial at best |

**The evolution will follow three phases:**

| Phase | Timeframe | Core Breakthrough | Analogy |
|-------|-----------|-------------------|---------|
| **Now** | 2024-2025 | LLMs can use tools | CPU exists, but no OS |
| **Near-term** | 2-4 years | Reliable agent lifecycle management | Unix matures: processes, memory, IPC |
| **Mid-term** | 5-10 years | Agent networks with emergent collective intelligence | Internet: single machine → network effects |

**Nous starts from the OS model and adds intelligence — not from a chatbot model with features bolted on.** This is the fundamental architectural bet.

### The I/O Bandwidth Problem: Why Chat Is a Dead End

The current human-AI channel is: `text → LLM → text`. This channel has extremely low bandwidth, and it is lossy (language is a lossy compression of human thought).

Every bandwidth increase in history has driven a paradigm shift:

- 56K modem → broadband → 5G
- Text terminal → GUI → video conferencing
- Typing → touch → voice → ?

Bandwidth increases in only two directions:

1. **Explicit bandwidth**: Richer active input (voice + vision + gesture + brain-computer interface)
2. **Implicit bandwidth**: AI passively perceives the environment without requiring human input

**Our conclusion: the final form is not "a better chat box."**

### The Ideal Interaction Model: From the AI's Perspective

From the AI's perspective, the three most structurally inefficient aspects of current interaction are:

1. **Amnesia**: Every conversation starts from zero. The human knows who the AI is; the AI doesn't know who the human is. Context must be rebuilt every time — like your colleague resetting to a new hire every morning.

2. **On-demand only**: The human contacts the AI only when they need a result. But an AI that truly understands you needs continuous awareness of your work state — what you're doing, where you're stuck, what you're planning next.

3. **Language as lossy compression**: "Write me a good report" in the human's mind and in the AI's understanding are entirely different things. Both parties think communication succeeded. Both are wrong.

The ideal interaction has three layers:

```
┌─────────────────────────────────────────────────────────┐
│  Top: Outcome Layer                                      │
│  Human only makes decisions, never executes.             │
│  AI explains what it did and why.                        │
│  Human feedback makes AI better long-term.               │
├─────────────────────────────────────────────────────────┤
│  Mid: Conversational Intent Layer                        │
│  Human states goals, not methods.                        │
│  AI proactively clarifies genuine ambiguity              │
│  (not everything). Works async; interrupts only on       │
│  completion or when blocked.                             │
├─────────────────────────────────────────────────────────┤
│  Bottom: Ambient Perception Layer (always on)            │
│  Reads calendar, files, email, screen.                   │
│  Knows what you did yesterday.                           │
│  Knows your long-term goals and constraints.             │
│  No conversation needed — just observes.                 │
└─────────────────────────────────────────────────────────┘
```

This is not a new concept. This is exactly how an excellent human executive assistant works:

- You don't brief your assistant on who you are every morning.
- A good assistant knows your schedule, your preferences, your active projects.
- They handle 80% of things in the background, only bringing truly decision-worthy items to you.
- Your "conversations" are few, but collaboration efficiency is extremely high.

**AI will converge to this form. The chat box is a transitional crutch.**

### The Unifying Insight

The entire reasoning chain reduces to one statement:

> **Design AI agents as an operating system, not as an enhanced chatbot.**

An operating system solves the core problem: how do multiple unreliable processes reliably accomplish complex tasks?

The answers are well-known (since the 1970s):
- Explicit process state machines
- Schedulers, not polling loops
- Inter-process communication, not shared mutable state
- Capability isolation, not global permissions
- Event logs, not ephemeral execution

These answers apply directly to AI agents — they are the new "processes." Nous applies OS principles to the AI agent domain.

### Why "Nous"

The name was chosen with intent, not decoration.

**Nous (νοῦς)** — a core concept in ancient Greek philosophy. Anaxagoras said: the universe was originally undifferentiated chaos; it was Nous that organized it into an ordered world. Aristotle said: Nous is the active intellect, the force that transforms potential into actuality.

```
Chaotic tasks, failing agents, accumulating events
                    ↓
                  Nous
                    ↓
Ordered execution, reliable results, humans only decide
```

The name is philosophically precise: this framework is not a tool — it is the organizing principle that transforms the chaos of AI execution into an ordered world.

---

## Design Philosophy

Five principles that govern every design decision. Each is derived from the first principles above:

### North Star and Current Architectural Center

Nous must be reasoned about on **two levels at the same time**:

1. **North Star (highest guiding idea):** Nous should ultimately become a **self-evolving collective intelligence** — not a better chat wrapper, but a network of persistent instances that can accumulate, validate, and exchange useful intelligence over time.
2. **Current architectural center (what we build around today):** the necessary base form is a **persistent agent runtime** — a long-lived, auditable, policy-governed system that can carry identity, memory, and execution across channels and sessions.

This distinction matters. The North Star prevents us from building a dead-end local tool. The current architectural center prevents us from prematurely building distributed complexity before the local substrate is real.

**Architectural test:** every major design decision should satisfy all three:

- **Works locally first** — it improves the single-instance persistent runtime.
- **Preserves future collective growth** — it does not block multi-instance learning, exchange, or evolution later.
- **Avoids premature swarm complexity** — it does not force distributed coordination into v1 where local contracts would suffice.

1. **Failure is the norm, not the exception.**
   Every component assumes it will crash. Recovery paths are built in from the start, not bolted on.
   *(From OS principle: processes crash — the OS must survive them.)*

2. **State is a first-class citizen.**
   Every entity (Task, Agent, Intent) has an explicit state machine. No implicit state allowed.
   *(From OS principle: process state machines are the foundation of reliable scheduling.)*

3. **Humans decide, machines execute.**
   The system minimizes human cognitive burden, not human control granularity.
   *(From the abstraction history: each era moves humans further from operation toward pure decision-making.)*

4. **Observability is built-in, not a plugin.**
   Every operation is queryable, replayable, and auditable by design.
   *(From OS principle: event logs, not ephemeral execution.)*

5. **Least capability.**
   Agents can only do what they are explicitly authorized to do. Default is deny.
   *(From OS principle: capability isolation, not global permissions.)*

---

## Core Vocabulary

The system's world is defined by these core abstractions. Getting these wrong means everything downstream is wrong.

| Concept | Owner | Description |
|---------|-------|-------------|
| **Intent** | Human | A goal expressed in natural language — fuzzy, high-level, may have constraints |
| **Plan** | Orchestrator | A decomposition of Intent into a Task DAG — revisable, not final |
| **Task** | Scheduler | An atomic unit of work with a full lifecycle (state machine, dependencies, retry policy) |
| **Instance** | Infrastructure | A long-lived Nous identity — the unit that persists across channels/sessions today and may participate in collective intelligence later |
| **Agent** | Runtime | A persistent identity with memory, capabilities, and a behavioral profile |
| **Tool** | Runtime | An atomic capability (shell exec, file read, HTTP call, etc.) |
| **Event** | Persistence | An immutable record of what happened — the system's source of truth |
| **Memory** | Runtime | Layered persistent state (5 tiers, see Memory System below) |
| **Scope** | Cross-cutting | The locality and trust boundary of knowledge or authority — e.g. task-local, thread-local, project-local, user-global, exportable |
| **Provenance** | Cross-cutting | Origin and evidence metadata attached to memories, skills, and proposals — where it came from, how it was derived, and whether it can be trusted/shared |
| **Sensor** | Infrastructure | A continuous input source that passively observes the environment (file watcher, calendar, screen, mic, etc.) |
| **Attention Filter** | Orchestration | Evaluates raw perception signals and decides what is worth processing — the "is this interesting?" gate |
| **Ambient Intent** | Orchestration | A goal inferred from environment signals, not explicitly stated by a human — system-initiated action |
| **ProcedureCandidate** | Evolution | A reusable execution pattern observed from successful runs, not yet fully validated as a stable Skill |
| **Skill** | Evolution | A reusable execution path crystallized from successful experience — the unit of learned competence |
| **CapabilityGap** | Evolution | A systematically identified weakness — what Nous cannot yet do well, with evidence and proposed fix |
| **EvolutionProposal** | Evolution | A concrete self-improvement plan (new tool, new skill, prompt fix, code patch) — Nous's proposal to make itself better |
| **ValidationState** | Evolution | The governance lifecycle of learned artifacts — observed, candidate, validated, deprecated, revoked |
| **PermissionRule** | Infrastructure | A user-controlled authorization rule scoped by directory/system/command/network — what Nous is allowed to do |
| **CommunicationPolicy** | Infrastructure | User-controlled rules governing all inter-Nous communication — what to share, whom to consult, what to auto-approve |
| **Channel** | Dialogue | An I/O connection to the user (CLI, IDE, Web) — a viewport into Nous, not an isolated session |
| **DialogueThread** | Dialogue | A conversation topic that may span multiple channels — groups related messages and intents |
| **MessageOutbox** | Dialogue | Persistent queue for outbound messages — survives channel disconnects and daemon restarts |
| **ConflictAnalysis** | Dialogue | Two-layer analysis of inter-task resource and semantic conflicts — prevents concurrent intents from breaking each other |
| **NousMessage** | Infrastructure | The atomic unit of inter-Nous communication — always E2E encrypted, always audit-logged |

### What OpenClaw and others lack

| Concept | OpenClaw | LangChain | AutoGPT | Nous |
|---------|----------|-----------|---------|------|
| Intent (separate from Task) | No | No | No | Yes |
| Plan (revisable DAG) | No | No | Partial | Yes |
| Task state machine | Partial | No | No | Yes |
| Agent persistence across sessions | File-based | No | No | Yes |
| Event sourcing | No | No | No | Yes |
| Procedural Memory | No | No | No | Yes |
| Passive Perception (Sensors + Attention) | No | No | No | Yes |
| Ambient Intent (system-initiated goals) | No | No | No | Yes |
| Self-evolution (skill crystallization + gap detection + self-mutation) | No | No | No | Yes |
| Memory metabolism (experience → skill, with RAG retrieval) | No | No | No | Yes |
| Collective intelligence (cross-instance) | No | No | No | Yes |
| Inter-instance communication protocol | No | No | No | Yes (hybrid relay + P2P) |

---

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Dialogue Layer (above all planes)                          │
│  Channel Manager · Dialogue Manager · Thread Tracker ·      │
│  Message Outbox · Conflict Analyzer                         │
├─────────────────────────────────────────────────────────────┤
│  L0 — Intent Plane                                          │
│  Human Intent · Ambient Intent · Constraints · Human        │
│  Decision Queue (only truly blocking decisions reach human) │
├─────────────────────────────────────────────────────────────┤
│  L1 — Orchestration Plane                                   │
│  Intent Planner · Task Scheduler · Agent Router ·           │
│  Attention Filter · Context Assembly                        │
├─────────────────────────────────────────────────────────────┤
│  L2 — Runtime + Evolution Plane                             │
│  Agent Runtime (ReAct loop) · Tool System (3-tier) ·        │
│  Memory Manager (RAG pipeline) ·                            │
│  Evolution Engine (experience → skill → gap → self-mutation)│
├─────────────────────────────────────────────────────────────┤
│  L3 — Persistence Plane                                     │
│  Event Store · Task Queue DB · Message Store ·              │
│  Memory Store (FTS + Vector + Graph) · Perception Log ·     │
│  Evolution Log                                              │
├─────────────────────────────────────────────────────────────┤
│  L4 — Infrastructure Plane                                  │
│  Daemon Process · Channel Adapters (CLI, IDE, Web, ...) ·   │
│  Sensors (FS, Git, ...) · Permission System ·               │
│  Process Supervisor · Observability · Nous Relay Client     │
└─────────────────────────────────────────────────────────────┘
```

**Four data flow paths exist in parallel:**
- **Dialogue path** (bidirectional): Channels ↔ Dialogue Manager ↔ Intent Plane (non-blocking, async)
- **Request path** (top-down): Human Intent → Orchestration → Runtime → Persistence
- **Perception path** (bottom-up): Sensors → Perception Log → Attention Filter → Ambient Intent
- **Network path** (lateral): Nous Relay Client ↔ Relay Network ↔ Other Nous Instances (see Inter-Nous Communication Architecture)

**Dependency rule:** Dependencies flow downward only. The Dialogue Layer sits above L0 and depends on it. L0 depends on L1, L1 on L2, etc. No upward dependencies.

### Dialogue Layer (`packages/dialogue`)
- **Channel Manager**: Manages all connected I/O channels (CLI, IDE, Web, API). Channels connect and disconnect freely — Nous keeps running regardless. Multiple channels can be active simultaneously. Each channel carries a `scope` (CWD, project, focused file) that influences Context Assembly but does NOT isolate memory or state.
- **Dialogue Manager**: Maintains multi-turn conversation context across all channels. Groups messages into `DialogueThread`s by topic. A thread can span multiple channels (start a conversation in CLI, continue in IDE). All messages are persisted to L3 Message Store — Nous never loses context.
- **Thread Tracker**: Tracks active threads, associates them with intents and tasks. When a user sends a message, determines whether it belongs to an existing thread or starts a new one.
- **Message Outbox**: Persistent queue for outbound messages (results, notifications, questions). When a channel is disconnected, messages accumulate in the outbox. When the channel reconnects (or any channel connects), pending messages are delivered. (See Message Delivery section below)
- **Conflict Analyzer**: When a new intent arrives, analyzes potential conflicts with currently active intents/tasks — resource conflicts (file locks, shared state), semantic conflicts (contradictory goals), and dependency ordering. Uses both static analysis (resource overlap detection) and LLM-assisted semantic analysis. (See Conflict Detection section below)

### L0 — Intent Plane (`packages/orchestrator`)
- Receives natural language goals from humans (**Human Intent**)
- Receives system-inferred goals from Attention Filter (**Ambient Intent**)
- Parses constraints and priorities
- Maintains the **Human Decision Queue**: only decisions that are irreversible, out-of-scope, or post-max-retry reach the human
- Ambient Intents carry a `confidence` score — below threshold, they queue for human approval instead of auto-executing

### L1 — Orchestration Plane (`packages/orchestrator`)
- **Intent Planner**: Goal → structured Task DAG
- **Task Scheduler**: Manages task state machine, dependency resolution, retry with exponential backoff
- **Agent Router**: Matches task capability requirements to available agents
- **Attention Filter**: Evaluates perception signals from L3 Perception Log, decides relevance and urgency, and either discards, logs for later, or promotes to Ambient Intent at L0. Uses a lightweight LLM call (fast model) for semantic evaluation
- **Context Assembly**: Gathers environment context (CWD, OS, shell), project context (git state, directory structure, language/framework, package manager, README), and user context (memory, preferences, history) — injects a rich system prompt into every agent LLM call

### L2 — Runtime + Evolution Plane (`packages/runtime`, `packages/evolution`)
- **Agent Runtime**: ReAct reasoning loop (Think → Act → Observe → repeat)
- **Tool System**: 3-tier tool architecture — Primitives (system built-in), Builtins (framework provided, configurable), Evolved (Nous-created tools from Evolution Engine). Isolated execution per tool, timeout enforcement, permission-scoped
- **Memory Manager**: Unified interface to 5-tier memory system with RAG retrieval pipeline (vector + keyword + graph search, fusion, re-ranking). Includes memory metabolism — transforming episodic → semantic → procedural
- **Evolution Engine**: The self-improvement system. Four layers: (1) Experience Collection — records every task execution trace, user feedback, and performance metrics; (2) Skill Crystallization — extracts reusable skills from repeated successful patterns via memory metabolism; (3) Gap Detection — analyzes failures and inefficiencies to identify systematic capability weaknesses; (4) Self-Mutation — generates EvolutionProposals to create new tools, compile new skills, improve prompts, or patch its own code

### L3 — Persistence Plane (`packages/persistence`)
- **Event Store**: Append-only log of all state transitions (event sourcing)
- **Task Queue DB**: SQLite-backed task state machine persistence
- **Message Store**: All dialogue messages (human and Nous), threads, and the message outbox. Persisted to SQLite. This is what gives Nous continuous memory across channel disconnects and daemon restarts.
- **Memory Store**: SQLite-backed with three index layers — FTS5 for keyword search, sqlite-vec for vector similarity search, adjacency tables for graph relations. Embedding generation via pluggable Embedding Provider (Anthropic, OpenAI, local Ollama)
- **Perception Log**: Append-only buffer of raw sensor signals, time-indexed. High-volume, low-retention — older entries are compacted or pruned after Attention Filter has evaluated them
- **Evolution Log**: Records all capability gaps detected, evolution proposals generated, skills crystallized, and self-mutations applied — the audit trail of how Nous evolved

### L4 — Infrastructure Plane (`packages/infra`)
- **Daemon Process**: Nous runs as a long-lived daemon process, not a one-shot CLI invocation. The daemon owns the SQLite database, runs the scheduler loop, manages sensors, and accepts connections from channels. `nous daemon start` launches it; `nous daemon stop` shuts it down gracefully. The daemon survives channel disconnects, terminal closures, and IDE restarts — it is the persistent identity of Nous. (See Daemon Architecture section below)
- **Channel Adapters**: Plugin system for I/O channels. Each adapter connects to the daemon via IPC (Unix socket for local, WebSocket for remote). MVP ships with CLI adapter; IDE and Web adapters follow. Channels are stateless connectors — all state lives in the daemon.
- **Sensors**: Continuous environment observers — each Sensor is a long-lived process that watches one input source and emits signals to L3 Perception Log. MVP ships with FileSystem Sensor (file create/modify/delete) and Git Sensor (branch switch, new commits, conflicts). Future: calendar poller, email listener, clipboard monitor, screen capture, microphone stream. Sensors are stateless and restartable; they only write, never read.
- **Permission System**: User-controlled authorization modeled after Claude Code's approach. Default permission set at install; user confirms/expands during interaction; master override to grant-all; user can revoke any permission at any time. Scoped by directory (path patterns), system level (user/root), command allowlist, and network domain. No automatic permission decay or reduction — permissions change only when the user explicitly changes them. (See Permission System section below)
- **Process Supervisor**: Agent heartbeat monitoring, crash detection, restart (also supervises Sensors)
- **Observability**: Metrics, tracing, structured logging — all derived from Event Store
- **Nous Relay Client**: Handles Relay Network registration, discovery queries, P2P connection establishment, and E2E encryption. Governed by the user's `CommunicationPolicy`

### Storage Boundary Principles

Nous should not treat "persistence" as a single storage bucket. Different classes of information have different architectural roles:

- some are for **human governance and inspection**
- some are for **live runtime state and query-heavy coordination**
- some are **large artifacts or rebuildable caches**
- some are **high-sensitivity secrets**

If we blur these boundaries, Nous will either collapse into a pile of ad hoc files or into an opaque black-box database. Both are wrong for the product thesis.

#### Core rule

> **Use the filesystem for declaration, packaging, artifacts, cache, and operator-facing logs. Use the database/index layer for live state, relations, retrieval, audit, and governance.**

#### What belongs where

| Data class | Primary store | Why |
|-----------|---------------|-----|
| User-editable config | Filesystem (`~/.nous/config/*.json`, project `.nous/*.json`) | Human-readable, diffable, override-friendly |
| Live dialogue / intent / task / outbox state | SQLite / Message Store / Task Queue DB | Strong state transitions, concurrent writes, query-heavy |
| Event / audit history | Event Store (structured) + log files (operator view) | Canonical truth needs queryability; humans still need plain logs |
| Memory substrate | SQLite + vector + graph indexes | Retrieval, ranking, provenance relations, metabolism |
| Skills / procedures / templates | Filesystem artifacts + DB metadata | Publishable/shareable asset, but still governed by validation state |
| Large artifacts / attachments / exports | Filesystem | Blob-heavy, easier to move, snapshot, sign, and archive |
| Caches | Filesystem | Rebuildable, disposable, size-oriented |
| Secrets | OS keychain / encrypted secret store | Too sensitive for plain config files |

#### Why dialogue and memory are not "just files"

The following should **not** degrade into scattered JSON files:

- `DialogueThread`
- `DialogueMessage`
- `MessageOutbox`
- `Intent`
- `Task`
- `ConflictAnalysis`
- `Event`
- `MemoryEntry`
- `EvolutionProposal`

These objects have explicit state machines, causal links, ranking/retrieval requirements, or concurrency semantics. They belong in queryable stores, not in directory conventions.

#### Why config, skills, and artifacts should stay visible

The following should stay file-backed:

- configuration
- published skills/procedures/templates
- generated reports and exports
- crash logs / daemon logs / perception logs
- downloaded tools / helper binaries

This preserves a key Nous property: **local-first transparency**. The user should be able to inspect, back up, diff, move, and selectively share important assets without reverse-engineering the runtime database.

#### Dual-layer objects: governed in DB, materialized in files

Some objects need both worlds:

- **Skill / Procedure**
  - DB stores: provenance, validation state, trust, rollout status, evidence
  - files store: manifest, executable template, prompt/tool contract
- **Artifacts**
  - DB stores: metadata, ownership, scope, provenance, references
  - files store: the actual blob
- **Observability**
  - Event Store stores: canonical structured events
  - log files store: operator-facing diagnostics

This pattern is deliberate:

> **DB governs; files publish.**

#### Secret handling rule

`~/.nous/secrets/` may exist, but it should not become a bucket of plaintext API keys.

Target order:

1. OS keychain / platform secret manager
2. encrypted local secret blobs
3. plaintext files only as a temporary bootstrap fallback, never the intended end state

But v1 needs a more practical rule:

- v1 may use **file-backed secrets** under `~/.nous/secrets/`
- this is a usability-first choice for provider API keys and auth tokens
- however, code should still depend on a **SecretStore boundary**, not on ad hoc file reads
- the initial implementation can be `FileSecretStore`
- later implementations can move to keychain / encrypted storage without refactoring provider selection or runtime boundaries

So the architectural rule is:

> **Use file-backed secrets in v1 if that is what makes the system usable, but do not let "temporary plaintext file" become the permanent secret architecture.**

#### Default `~/.nous` layout

```text
~/.nous/
  config/
    config.json
    providers.json
    sensors.json
    ambient.json
    permissions.json
    memory.json
    logging.json

  daemon/
    nous.sock
    nous.pid
    daemon.json

  state/
    nous.db
    indexes/
    checkpoints/

  logs/
    daemon/
    provider/
    perception/
    crash/
    audit/

  skills/
    manifests/
    procedures/
    templates/

  tools/
    bin/
    manifests/

  artifacts/
    attachments/
    reports/
    exports/
    snapshots/

  cache/
    llm/
    embedding/
    http/
    repo/

  secrets/
    providers.json
    handles.json
    encrypted/

  tmp/
```

`<project>/.nous/` remains an override boundary, not a second persistent identity. It should contain scope-local configuration and optional project-local assets, but not split Nous into separate per-project brains.

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
  capabilitiesRequired: string[];  // What this agent needs (actual access governed by Permission System)
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

### Instance

```typescript
interface Instance {
  id: string;                      // Stable Nous instance identity
  displayName: string;
  status: "booting" | "ready" | "degraded" | "offline";

  // What this instance is currently allowed and able to do
  capabilityManifestId: string;
  communicationPolicyId: string;

  // Collective-intelligence groundwork
  trustProfileId: string;          // Local trust / reputation metadata
  createdAt: string;
  lastSeenAt: string;
}
```

### Scope

```typescript
type Scope =
  | { kind: "task"; id: string }
  | { kind: "thread"; id: string }
  | { kind: "project"; id: string }
  | { kind: "user"; id: string }
  | { kind: "exportable"; policy: "review_required" | "shareable" };
```

### Provenance

```typescript
interface Provenance {
  sourceType: "human" | "sensor" | "runtime" | "imported_instance" | "evolution";
  sourceId: string;                // User ID, sensor ID, instance ID, etc.
  derivedFrom: string[];           // Event / memory / skill / proposal IDs
  evidenceIds: string[];           // Execution traces, task results, human feedback
  confidence: number;              // 0-1 confidence score
  trustLevel: "local" | "reviewed" | "validated" | "external_untrusted";
  exportable: boolean;             // May this object leave the local instance?
}
```

### Sensor

```typescript
interface Sensor {
  id: string;
  type: string;                    // "fs.watcher" | "calendar.poll" | "screen.capture" | ...
  config: Record<string, unknown>; // Sensor-specific settings (paths, intervals, etc.)
  status: "active" | "paused" | "error";
  emitRateLimit: number;           // Max signals per minute (backpressure)
}
```

### PerceptionSignal

```typescript
interface PerceptionSignal {
  id: string;
  sensorId: string;
  timestamp: string;
  signalType: string;              // "file.changed" | "calendar.event_soon" | "email.received" | ...
  payload: unknown;                // Raw sensor data
  attentionResult?: {
    relevance: number;             // 0-1 score from Attention Filter
    disposition: "discard" | "log" | "promote";  // What the filter decided
    ambientIntentId?: string;      // If promoted, the resulting intent
  };
}
```

### AmbientIntent

```typescript
interface AmbientIntent extends Intent {
  source: "ambient";               // Distinguishes from human-issued intents
  triggerSignalIds: string[];       // Which perception signals triggered this
  confidence: number;               // 0-1, how confident the system is this intent is correct
  requiresApproval: boolean;        // If confidence < threshold, blocks for human approval
}
```

### ProcedureCandidate

```typescript
interface ProcedureCandidate {
  id: string;
  name: string;
  goalPattern: string;             // Natural-language or structured pattern this procedure addresses
  preconditions: string[];         // When this pattern is valid
  steps: ProcedureStep[];
  requiredCapabilities: string[];

  scope: Scope;
  provenance: Provenance;
  validationState: "observed" | "candidate" | "validated" | "deprecated" | "revoked";

  successRate: number;
  evidenceCount: number;           // Number of successful traces backing it
  lastUsedAt?: string;
}
```

### Skill

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;

  derivedFromProcedureId: string;
  scope: Scope;
  provenance: Provenance;
  validationState: "validated" | "deprecated" | "revoked";

  applicability: {
    domains: string[];
    projectTypes?: string[];
    antiPatterns?: string[];       // Cases where the skill should NOT be applied
  };

  contract: {
    requiredCapabilities: string[];
    expectedInputs: string[];
    successCriteria: string[];
  };

  version: string;
}
```

### EvolutionProposal

```typescript
interface EvolutionProposal {
  id: string;
  title: string;
  type: "new_skill" | "tool_improvement" | "prompt_change" | "code_patch";
  summary: string;

  targetScope: Scope;
  provenance: Provenance;
  basedOnGapIds: string[];

  evaluationPlan: string[];        // What must be tested before adoption
  rolloutPolicy: "manual_review" | "sandbox_only" | "staged";
  status: "proposed" | "under_review" | "accepted" | "rejected" | "rolled_back";
}
```

---

## Permission System

Permissions control what Nous is allowed to do in the user's environment. **Control is 100% with the user** — permissions never change unless the user explicitly changes them. There is no automatic escalation, no trust-based graduation, and no decay. This is modeled after Claude Code's permission approach.

### Design Principles

1. **Safe defaults**: Out of the box, Nous can read files and run a small set of safe commands. Everything else requires user confirmation.
2. **Progressive confirmation**: When Nous needs a permission it doesn't have, it asks once. The user can grant it for this action, for this session, or permanently.
3. **Grant-all escape hatch**: Power users can grant all permissions with a single command. This is a conscious choice, not an earned privilege.
4. **Instant revocation**: The user can revoke any permission at any time, effective immediately.
5. **No decay**: Permissions granted stay granted. If the user trusts Nous to write files today, that trust doesn't expire next week.

### Permission Scopes

Permissions are scoped along four dimensions:

```typescript
interface PermissionRule {
  action: PermissionAction;
  scope: PermissionScope;
  approval: "auto_allow" | "ask_once" | "always_ask" | "deny";
  grantedAt?: string;            // ISO timestamp, for audit
  grantedContext?: string;       // Why this was granted (optional note)
}

type PermissionAction =
  | "fs.read"                    // Read files
  | "fs.write"                   // Create/modify/delete files
  | "shell.exec"                 // Execute shell commands
  | "network.http"               // Make HTTP requests
  | "browser.control"            // Control a browser
  | "spawn_subagent"             // Create sub-agents
  | "memory.write"               // Persist to memory store
  | "evolution.self_mutate"      // Modify Nous's own code/config
  | "escalate_to_human";         // Interrupt human with a decision

type PermissionScope =
  | { type: "directory"; paths: string[] }       // Glob patterns: ["src/**", "tests/**"]
  | { type: "system"; level: "user" | "root" }   // System-level operations
  | { type: "command"; allowlist: string[] }      // Specific commands: ["git", "bun", "npm"]
  | { type: "network"; domains: string[] }        // Allowed domains: ["api.anthropic.com"]
  | { type: "all" }                               // Grant-all mode
```

### Default Permission Set

```typescript
const DEFAULT_PERMISSIONS: PermissionRule[] = [
  // Read files in current project — safe, always allowed
  { action: "fs.read", scope: { type: "directory", paths: ["./**"] }, approval: "auto_allow" },

  // Write files — ask first time, then remember choice
  { action: "fs.write", scope: { type: "directory", paths: ["./**"] }, approval: "ask_once" },

  // Safe read-only commands — auto-allow
  { action: "shell.exec", scope: { type: "command", allowlist: ["ls", "cat", "head", "tail", "wc", "find", "which", "echo", "date"] }, approval: "auto_allow" },

  // Development commands — ask once
  { action: "shell.exec", scope: { type: "command", allowlist: ["git", "bun", "npm", "node", "tsc", "biome"] }, approval: "ask_once" },

  // Everything else — always ask
  { action: "shell.exec", scope: { type: "command", allowlist: [] }, approval: "always_ask" },
  { action: "network.http", scope: { type: "network", domains: [] }, approval: "always_ask" },
  { action: "browser.control", scope: { type: "all" }, approval: "always_ask" },
  { action: "spawn_subagent", scope: { type: "all" }, approval: "ask_once" },
  { action: "memory.write", scope: { type: "all" }, approval: "auto_allow" },
  { action: "evolution.self_mutate", scope: { type: "all" }, approval: "always_ask" },
  { action: "escalate_to_human", scope: { type: "all" }, approval: "auto_allow" },
];
```

### Runtime Permission Check

```
Agent requests action (e.g., fs.write to src/main.ts)
  │
  ├── Find matching PermissionRule (most specific scope wins)
  │
  ├── approval == "auto_allow"?
  │   └── Execute immediately. Log to Event Store.
  │
  ├── approval == "ask_once"?
  │   └── First time: prompt user with [Allow / Allow Always / Deny]
  │       • Allow → execute this time
  │       • Allow Always → upgrade rule to auto_allow, persist
  │       • Deny → reject, log reason
  │
  ├── approval == "always_ask"?
  │   └── Every time: prompt user with [Allow / Allow Always / Deny]
  │
  └── approval == "deny"?
      └── Reject immediately. Agent receives denial reason.
```

### CLI Interface

```bash
$ nous permissions                    # Show current permission rules
$ nous permissions grant-all          # Enable all permissions (power user)
$ nous permissions revoke fs.write    # Revoke file write permission
$ nous permissions reset              # Reset to defaults
$ nous permissions log --last 24h     # Audit log of permission checks
```

### Relationship to Agent Capabilities

Agents still declare what capabilities they *need* (their `capabilitiesRequired`). But whether those capabilities are actually *granted* is determined by the Permission System, not by the agent definition. An agent that needs `fs.write` will be denied at runtime if the user hasn't granted that permission — regardless of the agent's definition.

```
Effective permission at runtime = AgentDeclaredNeeds ∩ PermissionRules ∩ IntentConstraints
```

---

## Memory System (5 Tiers + RAG Retrieval Pipeline)

### The Five Memory Tiers

```
┌──────────────────────────────────────────────────┐
│  Tier 5 — Prospective Memory                     │
│  Future commitments: scheduled tasks, pending     │
│  intents, promises made to the human              │
├──────────────────────────────────────────────────┤
│  Tier 4 — Procedural Memory  ← KEY DIFFERENTIATOR│
│  Successful task patterns: what worked before,    │
│  reusable execution paths, learned shortcuts.     │
│  Feeds into Skill Crystallization (Evolution)     │
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

**Tier 4 (Procedural Memory)** is the key differentiator. When an agent successfully completes a task like "add `tabs` permission to Chrome extension manifest.json", that execution path is stored. Next time a similar task appears, the agent retrieves the proven path instead of re-reasoning from scratch. Procedural memories that prove reliable are promoted to **Skills** by the Evolution Engine.

**Memory Metabolism:** Memory is not a static store — it is actively transformed. Episodic memories (individual events) are digested into semantic knowledge (general facts), which are compiled into procedural skills (reusable execution paths). Stale memories decay unless reinforced by usage. This process is the engine behind the Evolution Engine (see below).

### RAG Retrieval Pipeline

FTS5 keyword matching alone is insufficient for semantic memory retrieval. "How do I add linting?" and "set up ESLint in the project" are the same intent expressed differently — keyword matching misses this. The memory system uses a **multi-path retrieval pipeline** with fusion and re-ranking.

```
┌─────────────────────────────────────────────────────────┐
│                Memory Retrieval Pipeline                  │
│                                                          │
│  Query: "How do I add linting to this project?"          │
│                                                          │
│  Stage 1: Multi-Path Retrieval (parallel)                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ Vector       │ │ Keyword      │ │ Graph        │    │
│  │ Search       │ │ Search       │ │ Traversal    │    │
│  │              │ │              │ │              │    │
│  │ sqlite-vec   │ │ FTS5 +       │ │ Entity       │    │
│  │ cosine sim   │ │ BM25 rank    │ │ relations:   │    │
│  │ on embedding │ │              │ │ task→agent   │    │
│  │              │ │              │ │ episode→fact  │    │
│  │ Finds        │ │ Finds        │ │ skill→episode│    │
│  │ semantic     │ │ lexical      │ │              │    │
│  │ similarity   │ │ matches      │ │ Finds related│    │
│  │              │ │              │ │ entities     │    │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘    │
│         │                │                │              │
│         └────────────────┼────────────────┘              │
│                          ▼                               │
│  Stage 2: Fusion + Re-ranking                           │
│  ┌──────────────────────────────────────────────┐       │
│  │  Reciprocal Rank Fusion (RRF):                │       │
│  │  Merge all three result sets, deduplicate,    │       │
│  │  compute unified relevance score              │       │
│  │                                               │       │
│  │  LLM Re-rank (fast model):                    │       │
│  │  Given query + top-K candidates, re-score     │       │
│  │  for true contextual relevance                │       │
│  └──────────────────────┬───────────────────────┘       │
│                         ▼                                │
│  Stage 3: Context Window Assembly                       │
│  ┌──────────────────────────────────────────────┐       │
│  │  Fill token budget with highest-relevance     │       │
│  │  memories. Priority order:                    │       │
│  │    1. Procedural (direct execution paths)     │       │
│  │    2. Semantic (general knowledge)             │       │
│  │    3. Episodic (specific past events)         │       │
│  │    4. Prospective (pending commitments)        │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### Memory Storage Architecture

The storage layer supports all three retrieval paths within a single SQLite database file, using extensions for specialized indexing:

```
┌─────────────────────────────────────────────────────────┐
│                Memory Store (unified)                     │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ SQLite Core  │ │ sqlite-vec   │ │ SQLite       │    │
│  │              │ │              │ │ Graph Tables  │    │
│  │ Structured   │ │ Vector ANN   │ │              │    │
│  │ data + FTS5  │ │ index on     │ │ Adjacency    │    │
│  │ keyword      │ │ embeddings   │ │ tables for   │    │
│  │ search       │ │              │ │ entity rels  │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                          │
│  All in a single .db file. Zero external dependencies.   │
│  Same process. ACID. Backup = copy file.                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Embedding Provider (pluggable interface)          │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐      │   │
│  │  │ Anthropic  │ │ OpenAI    │ │ Local     │      │   │
│  │  │ Embedding  │ │ Embedding │ │ (Ollama)  │      │   │
│  │  └───────────┘ └───────────┘ └───────────┘      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

```typescript
// Embedding provider abstraction
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;  // 1536 for OpenAI, 1024 for Voyage, etc.
}

// Graph relation for entity linking
interface MemoryRelation {
  fromId: string;        // Source memory entry
  fromType: MemoryTier;
  toId: string;          // Target memory entry
  toType: MemoryTier;
  relation: "derived_from"    // semantic derived from episodic
          | "compiled_into"   // semantic compiled into procedural
          | "used_in_task"    // memory used during task execution
          | "contradicts"     // newer evidence contradicts older
          | "reinforces"      // newer evidence confirms older
          | "supersedes";     // newer version replaces older
  createdAt: string;
}
```

**Why not replace SQLite with a vector database?** For a single-user local application, SQLite + sqlite-vec provides vector ANN search, full-text search, structured queries, graph traversal, and ACID transactions — all in a single file with zero ops overhead. Introducing Qdrant, ChromaDB, or Milvus adds a separate process, network calls, and deployment complexity. The `EmbeddingProvider` and `MemoryStore` interfaces are abstract — if sqlite-vec proves insufficient at scale, swapping the backend is a new implementation, not a redesign.

### Memory Metabolism

Memory metabolism is the active transformation of lower-tier memories into higher-tier ones:

```
Tier 2 (Episodic)                    Tier 3 (Semantic)                  Tier 4 (Procedural)
─────────────────                    ─────────────────                  ─────────────────
"On March 15, user asked             "This project uses Tailwind       "When adding a new component:
 me to add a button. I               CSS with a custom design           1. Create file in src/components/
 created src/components/              system. Components go in           2. Use Tailwind + design tokens
 Button.tsx with Tailwind             src/components/. Design            3. Add Storybook story
 classes and design tokens.           tokens are in theme.ts."           4. Export from index.ts"
 User approved."
         │                                     │                                │
         │  pattern extraction                  │  skill compilation             │
         │  (3+ similar episodes)               │  (5+ similar facts)            │
         └──────────────►──────────────────────►┘──────────────►────────────────►┘
                                                                        │
                              METABOLISM DIRECTION ──────────────────────│───►
                                                                        ▼
                                                                  Skill (Evolution)
                                                                  (directly invocable)
```

**Metabolism rules:**
- **Episodic → Semantic**: When 3+ episodes share a structural pattern (detected via vector similarity on embeddings), extract the general fact using LLM synthesis. Mark source episodes as "digested" (retained for audit, deprioritized in retrieval). Create `derived_from` graph edges.
- **Semantic → Procedural**: When a cluster of 5+ semantic facts describes a repeatable workflow, compile into a procedure using LLM synthesis. Validate via shadow execution on next matching task. Create `compiled_into` graph edges.
- **Procedural → Skill**: When a procedural memory is validated 3+ times with >80% success rate, the Evolution Engine promotes it to a first-class Skill.
- **Decay**: Episodic memories older than 90 days that haven't been referenced or metabolized are candidates for pruning. Semantic and procedural memories decay only if contradicted by newer evidence (tracked via `contradicts` graph edges).
- **Reinforcement**: Every successful use of a memory (retrieved → led to good outcome) increases its retention score and creates a `reinforces` graph edge.

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

## Context Assembly: Giving Agents a World Model

Current agent frameworks drop agents into tasks with minimal context — like blindfolding someone and asking them to navigate a building. Nous solves this with a **Context Assembly** layer that gathers rich environmental information before every agent execution.

### Why This Matters

Without context assembly, an agent receiving the task "read the README" doesn't know:
- What directory the user is in
- What project this is (language, framework, package manager)
- What the git state is (branch, uncommitted changes)
- What OS and tools are available
- What the user's preferences are (from memory)

With context assembly, the agent starts with all of this — like a new team member who has read the project wiki before their first day.

### Three Context Sources

```
┌─────────────────────────────────────────────────────────┐
│  Context Assembly (runs before every agent task)          │
│                                                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────┐│
│  │ Environment     │ │ Project         │ │ User       ││
│  │ Context         │ │ Context         │ │ Context    ││
│  │                 │ │                 │ │            ││
│  │ • CWD          │ │ • git state     │ │ • Memories ││
│  │ • OS / arch    │ │   (branch,      │ │   (semantic││
│  │ • shell (zsh/  │ │    status,      │ │   + procs) ││
│  │   bash)        │ │    recent log)  │ │ • History  ││
│  │ • PATH tools   │ │ • directory     │ │   patterns ││
│  │   available    │ │   tree (top 3   │ │ • Known    ││
│  │ • system time  │ │   levels)       │ │   prefs    ││
│  │ • resources    │ │ • package.json  │ │ • Active   ││
│  │   (disk, mem)  │ │   / Cargo.toml  │ │   intents  ││
│  │ • active       │ │   / etc.        │ │            ││
│  │   processes    │ │ • language /    │ │            ││
│  │                │ │   framework    │ │            ││
│  │                │ │ • README (first │ │            ││
│  │                │ │   200 lines)   │ │            ││
│  │                │ │ • CLAUDE.md /  │ │            ││
│  │                │ │   .nous/config │ │            ││
│  └────────┬───────┘ └────────┬───────┘ └─────┬──────┘│
│           │                  │                │       │
│           └──────────────────┼────────────────┘       │
│                              ▼                        │
│                 System Prompt Assembly                 │
│                 (injected into agent's LLM call)      │
│                                                       │
│  Result: Agent knows WHERE it is, WHAT the project is,│
│  and WHO it's working for — before executing a single │
│  tool call.                                           │
└───────────────────────────────────────────────────────┘
```

```typescript
interface AssembledContext {
  environment: {
    cwd: string;
    os: string;
    arch: string;
    shell: string;
    availableTools: string[];      // Which CLI tools are on PATH
    timestamp: string;
  };
  project: {
    type: string;                  // "typescript-monorepo" | "python-package" | "rust-crate" | ...
    rootDir: string;
    gitBranch?: string;
    gitStatus?: string;            // Clean / dirty / conflict
    packageManager?: string;       // "bun" | "npm" | "pip" | "cargo" | ...
    language: string;
    framework?: string;
    directoryTree: string;         // Top 3 levels, truncated
    readmeSnippet?: string;        // First 200 lines of README
    configFiles: string[];         // Which config files exist
  };
  user: {
    relevantMemories: MemoryEntry[];  // From RAG retrieval
    activeIntents: Intent[];          // What the user is currently working on
    recentFeedbackPatterns: string[]; // "User prefers concise output", etc.
  };
}
```

**Context Assembly is cheap.** Environment and project context are gathered via filesystem reads and shell commands (no LLM calls). User context comes from the RAG pipeline. The total overhead is <100ms.

---

## Tool System (3-Tier Architecture)

Current agent frameworks ship with a fixed set of tools. If the tool you need doesn't exist, you're stuck. Nous has a **3-tier tool architecture** where the system can create new tools for itself.

### Tier 1 — Primitives (System Built-In, Not Replaceable)

The foundational tools that everything else depends on. These are compiled into Nous and cannot be removed or modified at runtime.

| Tool | Capability Required | Description |
|------|-------------------|-------------|
| `file_read` | `fs.read` | Read file contents |
| `file_write` | `fs.write` | Write/create files |
| `shell` | `shell.exec` | Execute shell commands |
| `glob` | `fs.read` | Pattern-based file search |
| `grep` | `fs.read` | Regex search across files |

### Tier 2 — Builtins (Framework Provided, Configurable)

Tools that ship with Nous but can be enabled/disabled/configured by the user. These cover common developer workflows.

| Tool | Capability Required | Description |
|------|-------------------|-------------|
| `git_status` | `shell.exec` | Git repository state |
| `git_diff` | `shell.exec` | Show file differences |
| `git_log` | `shell.exec` | Commit history |
| `git_commit` | `shell.exec` | Create commits |
| `http_request` | `network.http` | Make HTTP requests |
| `web_search` | `network.http` | Search the web |
| `browser_navigate` | `browser.control` | Navigate a browser |
| `browser_screenshot` | `browser.control` | Capture browser state |
| `test_runner` | `shell.exec` | Run project test suite |
| `package_install` | `shell.exec` | Install dependencies |
| `code_analysis` | `fs.read` | AST-based code analysis |
| `diff_patch` | `fs.write` | Apply patches to files |
| `memory_search` | `memory.write` | Search Nous's memory |
| `memory_store` | `memory.write` | Store to memory |

### Tier 3 — Evolved (Nous-Created Tools)

The most distinctive tier. When the Evolution Engine detects a `missing_tool` gap, it can create a new tool to fill it. Evolved tools are written in TypeScript, stored in the user's `.nous/tools/` directory, and registered in the ToolRegistry at runtime.

```typescript
// Example: Nous detects it frequently needs to parse YAML but has no YAML tool.
// Evolution Engine generates:

// .nous/tools/yaml_parse.ts
import { defineTool } from "@nous/core";

export default defineTool({
  name: "yaml_parse",
  description: "Parse a YAML file and return its structure as JSON",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the YAML file" }
    },
    required: ["path"]
  },
  requiredCapabilities: ["fs.read"],
  handler: async (input, context) => {
    const content = await Bun.file(input.path).text();
    // Simple YAML parsing (or use a library if available)
    return { success: true, data: parseYaml(content) };
  }
});
```

**Evolved tool lifecycle:**

```
Gap detected: "No YAML parsing tool"
  │
  ├── Evolution Engine generates tool code
  ├── Tool is written to .nous/tools/yaml_parse.ts
  ├── Tool is registered in ToolRegistry
  ├── Tool is tested on a synthetic input
  │
  ├── If test passes:
  │   └── Tool is available for future tasks
  │       Logged in Evolution Log
  │
  └── If test fails:
      └── Tool is marked as "failed_validation"
          Gap remains open for next attempt
```

**The key principle:** Tier 3 tools are always additive — they cannot modify or replace Tier 1 or Tier 2 tools. They extend Nous's capabilities without risking core functionality. Creating an Evolved tool requires the `evolution.self_mutate` permission.

---

## Perception Pipeline: From Environment to Action

The perception path runs **continuously in parallel** with the request path. It is the mechanism by which the system achieves always-on awareness without requiring human input.

```
Environment (files, calendar, email, screen, ...)
  │
  ▼
L4 Sensors (always running, stateless observers)
  │  fs.watcher: "src/auth.ts modified"
  │  calendar.poll: "standup in 10 minutes"
  │  email.listener: "deploy failure notification from CI"
  │
  ▼
L3 Perception Log (append-only buffer, high volume)
  │  Stores raw signals with timestamps
  │  Retention: short-lived, compacted after evaluation
  │
  ▼
L1 Attention Filter (runs on a cycle, e.g. every 10s)
  │  For each unevaluated signal:
  │    LLM call (fast model): "Is this relevant given current intents + agent state?"
  │    → Score relevance 0-1
  │    → discard (noise), log (interesting but not actionable), or promote (actionable)
  │
  │  Promoted signals:
  ▼
L0 Ambient Intent
  │  confidence >= threshold → auto-execute (enters normal Intent → Plan → Task flow)
  │  confidence < threshold  → Human Decision Queue ("I noticed X, should I do Y?")
  │
  ▼
  Normal orchestration flow (same as Human Intent from here)
```

**Key design constraint:** The perception pipeline must be **cheap**. Sensors emit raw data (no LLM calls). The Attention Filter uses the lightest possible model. Only promoted signals trigger full-cost orchestration. This keeps the always-on cost bounded.

**Backpressure:** Each Sensor has an `emitRateLimit`. If a sensor emits faster than the Attention Filter can process, signals are buffered in the Perception Log. If the buffer exceeds capacity, oldest unprocessed signals are dropped (with a `signal.dropped` event logged).

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

## Daemon Architecture: Nous as a Persistent Process

### Why a Daemon, Not a CLI Process

Every current agent framework runs as a foreground CLI process: you invoke it, it does work, it exits. This is the fundamental reason for the session-isolation problem.

| Framework | Process Model | What Happens When You Close the Terminal |
|-----------|-------------|----------------------------------------|
| **Claude Code** | Foreground CLI | Everything stops. Context lost. |
| **ChatGPT** | Web server (remote) | Server keeps state, but per-conversation isolation |
| **Cursor** | IDE plugin process | Tied to IDE lifecycle |
| **AutoGPT** | Foreground CLI | Everything stops |
| **Nous** | **Daemon process** | **Nothing stops. Nous keeps working.** |

The daemon model is the only one consistent with our design philosophy: "Nous is an operating system, not a chatbot." Operating systems don't exit when you close a terminal window.

### Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  User's Machine                                                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Nous Daemon (long-lived, single process)                     │  │
│  │                                                               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │  │ Dialogue │ │Orchestr. │ │ Runtime  │ │ Evolution│       │  │
│  │  │ Layer    │ │ (L0-L1)  │ │ (L2)     │ │ Engine   │       │  │
│  │  └────┬─────┘ └──────────┘ └──────────┘ └──────────┘       │  │
│  │       │                                                      │  │
│  │  ┌────▼─────────────────────────────────────────────────┐   │  │
│  │  │  SQLite DB (L3) — single file, single writer          │   │  │
│  │  │  events · tasks · messages · memory · perception      │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │       │                                                      │  │
│  │  ┌────▼─────────────────────────────────────────────────┐   │  │
│  │  │  IPC Server (Unix Domain Socket: ~/.nous/nous.sock)   │   │  │
│  │  └────┬──────────┬──────────┬───────────────────────────┘   │  │
│  │       │          │          │                                │  │
│  └───────┼──────────┼──────────┼────────────────────────────────┘  │
│          │          │          │                                    │
│   ┌──────▼───┐ ┌────▼────┐ ┌──▼──────┐                           │
│   │ CLI      │ │ IDE     │ │ Web     │  ... (future clients)      │
│   │ Client   │ │ Plugin  │ │ UI      │                            │
│   │          │ │         │ │         │                            │
│   │ Terminal │ │ VS Code │ │ Browser │                            │
│   └──────────┘ └─────────┘ └─────────┘                            │
│                                                                     │
│   Clients connect/disconnect freely.                                │
│   Daemon keeps running. State survives.                             │
└────────────────────────────────────────────────────────────────────┘
```

### Client-Daemon Protocol

Clients communicate with the daemon over a Unix Domain Socket using a simple JSON-RPC-like protocol:

```typescript
// Client → Daemon
interface ClientMessage {
  id: string;                        // Request ID for correlation
  type: "submit_intent"              // New user goal
      | "send_message"               // Conversational message (multi-turn)
      | "get_status"                 // Query active intents/tasks
      | "get_thread"                 // Retrieve a dialogue thread
      | "approve_decision"           // Respond to a decision queue item
      | "cancel_intent"              // Cancel an active intent
      | "subscribe"                  // Subscribe to push events
      | "unsubscribe";              // Unsubscribe from push events
  payload: unknown;
  channelScope: ChannelScope;        // CWD, project, focused file
}

// Daemon → Client
interface DaemonMessage {
  id?: string;                       // Correlation ID (for request-response)
  type: "ack"                        // Intent received, processing started
      | "response"                   // Direct response to a request
      | "progress"                   // Task progress update
      | "result"                     // Task/intent completed
      | "decision_needed"            // Human decision queue item
      | "notification"               // Proactive message (ambient intent, etc.)
      | "error";                     // Error
  payload: unknown;
  threadId?: string;                 // Which dialogue thread this belongs to
  intentId?: string;                 // Which intent this relates to
}
```

### Lifecycle

```bash
# Start the daemon (runs in background)
$ nous daemon start
  Nous daemon started (PID 12345)
  Socket: ~/.nous/nous.sock
  DB: ~/.nous/nous.db

# CLI is now a thin client
$ nous "Refactor the auth module"
  Intent submitted. Thread: #auth-refactor
  Nous is planning... (you can close this terminal)

# In another terminal (or IDE), same Nous
$ nous status
  Active intents:
    #1 "Refactor the auth module" [running, 3/7 tasks done]

  Pending messages:
    T4 completed: "Extracted AuthService class" (2m ago)

# Attach to a thread to see live progress
$ nous attach #auth-refactor
  [live streaming of progress, tool calls, results]
  [Ctrl+C to detach — does NOT cancel the work]

# Stop the daemon gracefully
$ nous daemon stop
  Saving state... Completing current task... Done.
```

---

## Unified Presence: One Nous, Many Channels

### The Problem with Session-Based Interaction

Every current agent framework inherits the terminal's I/O model: `1 terminal = 1 session = 1 isolated context`. This means:

- Open 3 terminals = 3 agents that don't know about each other
- Tell agent A "we use Tailwind" → agent B doesn't know
- Waiting for a response = blocked, can't submit another task
- Close the terminal = lose the conversation

This is not a design choice — it is a legacy constraint from terminal stdio being a single sequential stream.

### Nous's Model: Unified Presence

Nous is **one persistent instance** with **many communication channels**. But this needs to be stated carefully:

- **Unified identity** — there is one Nous, not one Nous per terminal/tab/window
- **Unified runtime** — background work continues regardless of which channel is attached
- **Unified continuity** — threads, tasks, notifications, and pending decisions survive channel disconnects
- **Scope-aware cognition** — project/task/thread scope still matters for context assembly, retrieval, permissions, and conflict analysis

This is the correct middle ground:

- Nous is **not** a set of isolated sessions
- Nous is also **not** an undifferentiated global brain with no boundaries

The design principle is:

> **Identity is unified; cognition is scope-aware.**

Channels are viewports into one Nous, not containers that define separate identities.

### What Is Unified vs. What Is Scoped

| Aspect | Unified | Scoped |
|--------|---------|--------|
| Instance identity | Yes | No |
| Event history | Yes | No |
| Background execution | Yes | No |
| Thread continuity across channels | Yes | No |
| Memory substrate | Yes | No |
| Retrieved context for a given action | No | Yes |
| Project assumptions and repo-specific patterns | No | Yes |
| Permission evaluation | No | Yes |
| Perception/autonomy behavior | No | Yes |

```typescript
// Channel — an I/O connection to the user
interface Channel {
  id: string;
  type: "cli" | "ide" | "web" | "mobile" | "api";
  scope: ChannelScope;
  status: "connected" | "disconnected";
  connectedAt: string;
  lastMessageAt: string;
  subscriptions: string[];          // Which event types this channel receives
}

// Channel scope — influences context assembly priority, NOT memory isolation
interface ChannelScope {
  workingDirectory?: string;        // CLI/IDE have CWD
  projectRoot?: string;             // Detected project root
  focusedFile?: string;             // IDE: currently open file
  // Scope does NOT create a separate Nous identity
  // Scope DOES influence:
  // - context assembly priority
  // - retrieval boundaries
  // - permission checks
  // - conflict analysis
}

// Dialogue message — unified across all channels
interface DialogueMessage {
  id: string;
  channelId: string;                // Which channel sent/receives this
  threadId: string;                 // Which conversation thread
  timestamp: string;
  role: "human" | "nous";
  content: string;

  // Context at time of message
  scope: ChannelScope;              // Snapshot of channel scope when sent
  intentId?: string;                // If this message created/relates to an intent
  taskIds?: string[];               // Related tasks

  // Delivery
  deliveredTo: string[];            // Channel IDs that received this message
  pending: boolean;                 // true if not yet delivered to target channel
}

// Dialogue thread — a conversation topic, may span multiple channels
interface DialogueThread {
  id: string;
  topic: string;                    // Auto-inferred or user-named
  channelIds: string[];             // Which channels have participated
  intentIds: string[];              // Which intents were born from this thread
  status: "active" | "idle" | "resolved";
  createdAt: string;
  lastActivityAt: string;
}
```

### Protocol-Level Contract

Unified Presence is not just a UX idea; it requires a transport contract:

```typescript
interface ClientEnvelope<T = unknown> {
  id: string;
  type: "attach" | "detach" | "submit_intent" | "send_message"
      | "get_status" | "get_thread" | "approve_decision"
      | "cancel_intent" | "subscribe" | "unsubscribe";
  channel: {
    id: string;
    type: "cli" | "ide" | "web" | "mobile" | "api" | "sensor";
    scope: ChannelScope;
  };
  payload: T;
  timestamp: string;
}

interface DaemonEnvelope<T = unknown> {
  id?: string;
  type: "ack" | "response" | "progress" | "result"
      | "decision_needed" | "notification" | "error";
  threadId?: string;
  intentId?: string;
  payload: T;
  timestamp: string;
}
```

The important architectural point is that **attach** and **submit_intent** are first-class operations. A user does not "enter a new isolated session"; they attach a channel to an existing Nous and optionally continue or create a thread within it.

### Non-Blocking Interaction

The fundamental behavioral difference from every other framework:

```
Traditional (blocking):              Nous (non-blocking):

User: "Refactor auth"               User: "Refactor auth"
  │                                    │
  ├── [waiting... 5 min...]            ├── Nous: "On it. Thread #auth-refactor."
  │   (can't do anything)             │   (user is free immediately)
  │                                    │
  │                                    ├── User: "Also fix the tests"
  │                                    │   Nous: "Queued after refactor
  │                                    │          (shared files). Thread #tests."
  │                                    │
  ▼                                    ├── [Nous works in background]
Agent: "Done"                          │
                                       ├── Nous → push: "Refactor done. 5 files
                                       │   changed. Review auth.ts? [Y/N]"
                                       │
                                       └── Nous → push: "Starting tests now."
```

---

## Conflict Detection: Inter-Task Dependency and Resource Analysis

### The Problem No Framework Solves

When a user submits multiple intents concurrently, they may conflict:

| Conflict Type | Example | Risk |
|--------------|---------|------|
| **Resource conflict** | Intent A edits `auth.ts`, Intent B also edits `auth.ts` | Overwrites, merge conflicts |
| **Semantic conflict** | "Add dark mode" + "Remove all CSS" | Contradictory goals |
| **Dependency** | "Fix the tests" depends on "Refactor auth" completing first | Ordering matters |
| **Resource exhaustion** | 5 concurrent intents all calling LLM API | Budget/rate limit exceeded |

No current agent framework handles this. Each operates in isolation, unaware of concurrent work.

### How Other Frameworks Compare

| Framework | Concurrent Intents | Conflict Detection | Resolution |
|-----------|-------------------|-------------------|------------|
| **Claude Code** | No (single session, blocking) | N/A | N/A |
| **ChatGPT** | No (single conversation) | N/A | N/A |
| **AutoGPT** | No (single task loop) | N/A | N/A |
| **Devin** | Yes (background tasks) | None — tasks can silently conflict | User discovers broken state |
| **Nous** | **Yes (multiple concurrent intents)** | **Two-layer: static + semantic** | **Auto-sequence or ask user** |

### Two-Layer Conflict Analysis

```
New intent arrives: "Fix the tests in auth.test.ts"
  │
  ▼
Layer 1: Static Resource Analysis (fast, no LLM)
  │
  │  Scan new intent's likely resources (files, commands, services)
  │  against currently active intents' claimed resources.
  │
  │  Resource claims are declared by the Task Planner when creating
  │  the Task DAG:
  │
  │  Active Intent #1: "Refactor auth module"
  │    Task T3 (running): claims write lock on src/auth.ts
  │    Task T4 (queued): claims write lock on src/auth.service.ts
  │
  │  New intent: "Fix auth tests"
  │    Would need: read src/auth.ts, write tests/auth.test.ts
  │
  │  Overlap detected: src/auth.ts (read vs write)
  │
  ├── No overlap → proceed to Layer 2 (lightweight check)
  │
  └── Overlap detected → proceed to Layer 2 (detailed analysis)
       │
       ▼
Layer 2: Semantic Conflict Analysis (LLM-assisted)
  │
  │  LLM call (fast model) with:
  │    - New intent description
  │    - Active intents + their current state
  │    - Detected resource overlaps
  │    - Question: "Are these intents conflicting, dependent, or independent?"
  │
  │  Possible verdicts:
  │
  ├── INDEPENDENT: No conflict. Execute in parallel.
  │   "These intents touch different aspects of the same file
  │    but won't interfere."
  │
  ├── DEPENDENT: Must be sequenced.
  │   "Fix tests should run AFTER refactor completes,
  │    because the refactor will change the API that tests verify."
  │   → Auto-add dependency edge in the Task DAG
  │   → Notify user: "Queued after refactor (dependent)."
  │
  ├── CONFLICTING: Cannot both succeed.
  │   "These intents have contradictory goals."
  │   → Route to Human Decision Queue
  │   → "Intent A and B conflict. Which takes priority?"
  │
  └── RESOURCE_CONTENTION: Can both succeed but not simultaneously.
      "Both need exclusive write access to auth.ts."
      → Auto-sequence with shortest-first scheduling
      → Notify user: "Running sequentially (shared file lock)."
```

### Resource Claim Model

```typescript
// Every Task declares what resources it will touch
interface ResourceClaim {
  taskId: string;
  intentId: string;
  resources: ResourceLock[];
}

interface ResourceLock {
  type: "file" | "directory" | "service" | "api" | "port";
  target: string;                    // File path, service name, API endpoint, etc.
  mode: "read" | "write" | "exclusive";  // Read can be shared, write/exclusive cannot
  claimed: boolean;                  // Whether this lock is currently held
}

// Conflict analysis result
interface ConflictAnalysis {
  newIntentId: string;
  activeIntentIds: string[];

  staticOverlaps: ResourceOverlap[]; // From Layer 1
  semanticVerdict: "independent" | "dependent" | "conflicting" | "resource_contention";

  resolution: ConflictResolution;
  confidence: number;                // LLM's confidence in the verdict
  requiresHumanDecision: boolean;    // true if conflicting or low confidence
}

interface ConflictResolution {
  type: "parallel"                   // No conflict, run simultaneously
     | "sequence"                    // Add dependency, run in order
     | "cancel_new"                  // New intent superseded by active one
     | "cancel_active"              // New intent supersedes active one
     | "human_decide";              // Cannot auto-resolve

  reason: string;                    // Human-readable explanation
  dependencyEdges?: { from: string; to: string }[];  // If type == "sequence"
}
```

### MVP vs. Future

**MVP:** Layer 1 (static resource analysis) is fully implemented. Layer 2 (LLM semantic analysis) exists but uses a simple prompt — not deeply tuned. The `sequence` resolution is the default safe choice when overlap is detected. Full semantic conflict reasoning is refined post-MVP.

**Post-MVP:** Train the semantic analyzer on real conflict patterns from the Evolution Engine's experience collection. Common conflict patterns become Skills — recognized without an LLM call.

---

## Message Delivery: Surviving Channel Disconnects

### The Problem

```
User (CLI): "Deploy to staging"
Nous: "Starting deployment..."
  │
  [User closes terminal]
  │
  [5 minutes later, deployment finishes]
  │
  Nous: "Deployment complete. URL: https://staging.app.com"
        → Where does this message go?
```

Every current framework loses this message. Nous must not.

### Design: Persistent Message Outbox

All outbound messages from Nous go through a **Message Outbox** in L3 (SQLite). Messages are only deleted after confirmed delivery to at least one channel.

```
┌──────────────────────────────────────────────────────────────┐
│  Message Lifecycle                                            │
│                                                               │
│  Nous generates a message (result, notification, question)    │
│    │                                                          │
│    ▼                                                          │
│  Message written to Outbox (L3 SQLite)                        │
│  status: "pending", deliveredTo: []                           │
│    │                                                          │
│    ├── Channel connected?                                     │
│    │   ├── YES → deliver immediately                          │
│    │   │         status: "delivered"                           │
│    │   │         deliveredTo: ["channel-123"]                  │
│    │   │                                                      │
│    │   └── NO → message waits in outbox                       │
│    │             │                                            │
│    │             ├── Channel reconnects later?                 │
│    │             │   └── YES → deliver all pending messages    │
│    │             │             for this channel (ordered)      │
│    │             │                                            │
│    │             ├── Another channel connects?                 │
│    │             │   └── YES → deliver there instead           │
│    │             │             (Nous has one identity,         │
│    │             │              any channel can receive)       │
│    │             │                                            │
│    │             └── TTL expires? (configurable, default 7d)   │
│    │                 └── status: "expired"                     │
│    │                     archived, not deleted                 │
│    │                                                          │
│    └── Message requires human response? (decision queue)      │
│        └── Elevated priority. Nous may also use               │
│            fallback channels (OS notification, email)          │
│            if configured.                                     │
└──────────────────────────────────────────────────────────────┘
```

### Message Priority and Delivery Strategy

```typescript
interface OutboxMessage {
  id: string;
  threadId: string;
  intentId?: string;

  // Content
  content: DaemonMessage;
  priority: "low" | "normal" | "high" | "urgent";

  // Delivery state
  status: "pending" | "delivered" | "expired" | "archived";
  createdAt: string;
  deliveredAt?: string;
  deliveredTo: string[];             // Channel IDs
  ttl: number;                       // Seconds until expiry (default: 7 days)

  // Targeting
  targetChannelId?: string;          // Prefer specific channel (null = any)
  requiresResponse: boolean;         // true = decision queue item
  fallbackStrategy?: "os_notification" | "email" | "none";
}
```

| Priority | Behavior | Example |
|----------|----------|---------|
| **low** | Deliver when a channel next connects. No fallback. | Progress updates, FYI notifications |
| **normal** | Deliver to any connected channel, or wait. | Task completion results |
| **high** | Deliver immediately. If no channel, use OS notification (if configured). | Errors, blocked tasks needing input |
| **urgent** | Deliver immediately + OS notification + optional email. | Security alerts, data loss risks, deployment failures |

### Reconnection Protocol

When a channel connects to the daemon:

```
Channel connects
  │
  ▼
Daemon: "Welcome. You have N pending messages."
  │
  ├── Deliver pending messages (oldest first, grouped by thread)
  │
  ├── Show active intents status summary
  │
  └── If any decision queue items are waiting:
      "I need your input on 2 items:"
      [1] "Deploy to prod? (waiting 3h)"
      [2] "auth.ts has a design decision (waiting 15m)"
```

This means the user experience on reconnect is:

```bash
$ nous
  Welcome back. 3 messages pending.

  Thread #auth-refactor:
    ✓ Refactor complete (2h ago). 5 files changed.
    ⚠ Design decision needed: Should AuthService be a singleton?
      [a]pprove singleton  [b] use dependency injection  [v]iew context

  Thread #deploy:
    ✓ Staging deployment succeeded. URL: https://staging.app.com

  Active: 0 intents running. Nous is idle.
```

### Daemon Restart Resilience

The daemon may crash or be restarted. Because all state is in SQLite:

- **Messages** in outbox survive restart (they're in L3)
- **Active tasks** have their last state in the Task Queue DB
- **Running agents** are detected as stale (heartbeat timeout) and restarted by the Scheduler
- **Sensors** are stateless and auto-restarted by the Process Supervisor
- **Channels** must reconnect (they detect daemon restart via socket EOF)

```
Daemon crashes
  │
  ▼
Daemon restarts (auto via systemd/launchd, or manual)
  │
  ├── Reads SQLite: recovers all state
  ├── Restarts Scheduler loop
  ├── Restarts Sensors
  ├── Detects stale tasks → re-queues them
  ├── Opens IPC socket
  │
  └── Channels reconnect → receive any pending messages
```

---

## Comparative Analysis: Why Existing Frameworks Fall Short

| Dimension | OpenClaw | LangChain | AutoGPT | Nous |
|-----------|----------|-----------|---------|------|
| Task lifecycle | File locks (brittle) | None | Basic loop | State machine + heartbeat + auto-retry |
| Failure recovery | Manual | None | Retry (no backoff) | Tiered auto-recovery → human escalation |
| Intent layer | None (tasks are intents) | None | None | Intent → Plan → Task (3 levels) |
| Multi-agent coordination | Subagent (no monitoring) | Chain (sequential) | Single agent | Supervisor model + liveness tracking |
| Memory | 4 tiers (no procedural) | Short-term only | File-based | 5 tiers (with Procedural Memory) |
| Permission model | Global permissions | None | None | User-controlled, directory/command scoped, Claude Code-style |
| Observability | Log files | Callbacks | Log files | Event sourcing, full causal chain |
| Human interaction | Chat + Cron | Chat | Chat | Intent layer + minimal-interruption decision queue |
| Perception | None | None | None | Sensors + Attention Filter + Ambient Intent |
| Self-evolution | None | None | None | 4-layer: experience → skill → gap detection → self-mutation |
| Memory + RAG | FTS only | Short-term only | File-based | 5-tier + vector + graph + re-ranking |
| Tool creation | None | None | None | 3-tier tools: Nous creates new tools from detected gaps |
| Context awareness | None | None | None | Context Assembly: env + project + user context injection |
| Process model | CLI (foreground, exits) | Web server (remote) | CLI (foreground, exits) | **Daemon** (persistent, survives terminal close) |
| Multi-channel | No (1 session = 1 context) | No (1 chat = 1 context) | No | **Unified Presence**: one Nous, many channels, shared state |
| Concurrent intents | No (blocking) | No (blocking) | No | **Non-blocking**: submit and detach, push results |
| Conflict detection | N/A | N/A | N/A | Two-layer: static resource locks + LLM semantic analysis |
| Offline delivery | N/A | N/A | N/A | Persistent message outbox, deliver on reconnect |
| Cross-instance learning | None | None | None | Federated pattern sharing + specialist consultation |
| Inter-instance communication | None | None | None | Hybrid relay + P2P, E2E encrypted, user-controlled |

**The core difference in approach:**

- OpenClaw / LangChain / AutoGPT: Start from a **chatbot** and bolt on agent features.
- Nous: Start from an **operating system** and add intelligence.

The latter is more structurally sound. An OS-first design gets reliability, scheduling, isolation, and observability for free — they are inherent in the model, not afterthoughts.

---

## Evolution Engine: How Nous Gets Smarter

Most agent frameworks are static: they execute the same way on day 1 and day 1000. Nous is fundamentally different — **it evolves**. Every task execution, every user interaction, every failure is fuel for self-improvement.

This is not about earning more permissions (that's the Permission System's job, controlled by the user). This is about Nous becoming genuinely more capable: learning new skills, creating new tools, identifying its own weaknesses, and writing code to fix them.

For Nous, evolution is not just learning — it is also **governance**. Any learned artifact that may influence future behavior or eventually spread across instances must carry explicit **Scope, Provenance, and ValidationState**. That is what keeps self-improvement auditable locally and makes future collective exchange trustworthy.

### How Current Frameworks Handle Growth (They Don't)

| Framework | Memory Model | Skill Learning | Self-Improvement | Cross-Instance Learning |
|-----------|-------------|----------------|-----------------|------------------------|
| **ChatGPT Memory** | Flat fact list ("user likes Python") | None | None | None |
| **Claude Code** | File-based memory (CLAUDE.md + memory dir) | None — user manually curates | None | None |
| **LangChain** | Pluggable (buffer, summary, vector) | None — session-scoped | None | None |
| **AutoGPT** | File-based workspace | None | None | None |
| **OpenClaw** | 4-tier memory (no procedural) | None — passive accumulation | None | None |

**The universal failure:** Every framework treats the agent as a **static executor** — it uses the same tools, the same strategies, the same prompts forever. None models the agent as a **living system** that actively metabolizes experience into skill and identifies its own evolutionary path.

The difference is the difference between a calculator and a brain.

### The Four Evolution Layers

Nous's self-improvement operates in four layers, each building on the one below:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Evolution Engine                               │
│                                                                   │
│  Layer 4: Self-Mutation（自我代码迭代）                            │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  Nous modifies its own source code                      │      │
│  │  • Identifies code-level defects → generates patch →    │      │
│  │    auto-tests → submits for review                      │      │
│  │  • Creates new Tool implementations → registers in      │      │
│  │    ToolRegistry                                         │      │
│  │  • Improves prompt templates and agent definitions      │      │
│  │  Requires: evolution.self_mutate permission             │      │
│  └────────────────────────────────────────────────────────┘      │
│                         ▲ depends on                              │
│  Layer 3: Gap Detection（能力缺陷识别）                           │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  Analyzes failed and suboptimal task executions to       │      │
│  │  identify systematic weaknesses                         │      │
│  │  • "I failed 3 consecutive tasks because I lack an      │      │
│  │    HTTP request tool"                                   │      │
│  │  • "User edited 60% of my CSS output → weak CSS skill"  │      │
│  │  • "This task type averages 15 ReAct iterations, too    │      │
│  │    many — need a procedural shortcut"                   │      │
│  │  Output: CapabilityGap + EvolutionProposal              │      │
│  └────────────────────────────────────────────────────────┘      │
│                         ▲ depends on                              │
│  Layer 2: Skill Crystallization（技能结晶）                       │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  Extracts reusable skills from memory metabolism         │      │
│  │  episodic → semantic → procedural (memory metabolism)    │      │
│  │  procedural → Skill (crystallization)                   │      │
│  │  A Skill is a directly invocable execution path that    │      │
│  │  skips re-reasoning from scratch                        │      │
│  └────────────────────────────────────────────────────────┘      │
│                         ▲ depends on                              │
│  Layer 1: Experience Collection（经验采集）                       │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  Records the complete trace of every task execution      │      │
│  │  • Which tools were used, in what order                 │      │
│  │  • User feedback (accept / edit / reject / undo)        │      │
│  │  • Token consumption, wall-clock time, retry count      │      │
│  │  • Execution environment context                        │      │
│  │  • Error messages and failure modes                     │      │
│  └────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### The Evolution Cycle

The four layers form a continuous positive feedback loop:

```
Execute task → Collect experience → Detect patterns → Crystallize skill
     ↑                                                        │
     │         Improved Nous executes next task better         │
     │                                                        ▼
     └──── Apply skill ◄── Implement proposal ◄── Detect gap ─┘
```

**This is biological evolution applied to software.** Nous doesn't get better because someone grants it more access. It gets better because it extracts learning from every experience, identifies what it still can't do well, and builds the capability to do it.

### Core Evolution Mechanisms

#### 1. Experience Collection — Every Interaction Is Training Data

Every task execution produces an `ExecutionTrace`:

```typescript
interface ExecutionTrace {
  taskId: string;
  intentId: string;
  agentId: string;

  // What happened
  toolCalls: ToolCallRecord[];     // Ordered sequence of tool invocations
  reasoningSteps: string[];        // Agent's chain of thought (anonymizable)
  tokensUsed: number;
  wallClockMs: number;
  reactIterations: number;
  retriesCount: number;

  // How it ended
  outcome: "success" | "partial" | "failure" | "timeout" | "escalated";
  errorMessages?: string[];

  // User signal
  userFeedback?: UserFeedback;

  // Environment snapshot
  environmentContext: EnvironmentSnapshot;
}

interface UserFeedback {
  type: "accept" | "edit" | "reject" | "undo" | "explicit_praise" | "explicit_correction";
  detail?: string;                 // What the user changed or said
  editDiff?: string;               // If type=edit, the diff of what user changed
}
```

Every signal matters, not just explicit corrections. Silence (accept without edit) is weak positive. Editing is informative — the diff is the lesson. Rejection is strong corrective. The system learns from all of them.

#### 2. Skill Crystallization — From Repetition to Competence

When the Memory Metabolism process (see Memory System below) produces a Procedural Memory, the Evolution Engine evaluates whether it should be promoted to a **Skill** — a first-class, directly invocable execution path.

The canonical `Skill` object is defined in **Core Data Models**. Below is a richer runtime/index view used by the Evolution Engine for retrieval, evaluation, and version tracking.

```typescript
interface SkillRuntimeRecord extends Skill {
  id: string;
  name: string;                      // "setup-eslint-monorepo"
  description: string;               // Semantic description for retrieval matching
  embedding: number[];               // Vector embedding for similarity search

  // When to use this skill
  triggerConditions: string[];       // Natural language conditions
  applicabilityCheck: string;        // Code/logic to verify conditions are met

  // The procedure
  steps: SkillStep[];

  // Provenance
  sourceEpisodeIds: string[];        // Which experiences this was distilled from
  sourceProceduralId: string;        // Which procedural memory was promoted

  // Quality tracking
  successCount: number;
  failureCount: number;
  avgTokenSaved: number;             // Tokens saved vs. reasoning from scratch
  userSatisfactionRate: number;      // Accept rate when this skill is applied
  lastUsed: string;

  // Versioning
  version: number;
  supersedes?: string;               // ID of skill this replaced
}

interface SkillStep {
  order: number;
  description: string;
  toolName: string;
  toolArgsTemplate: Record<string, string>;  // Parameterized — filled at runtime
  expectedOutcome: string;
  fallbackStrategy?: string;         // What to do if this step fails
}
```

**Skill vs. Procedural Memory:** A procedural memory is a passive record ("I did X, Y, Z and it worked"). A Skill is an active capability ("When condition C is met, execute steps X, Y, Z with parameters P"). Skills are executable; procedural memories are reference material.

**Skill promotion criteria:**
- Procedural memory has been validated 3+ times
- Success rate > 80%
- User satisfaction > 70%
- The pattern is generalizable (not tied to one specific file or context)

#### 3. Gap Detection — Self-Diagnosis

After every task (especially failures and low-quality completions), the Evolution Engine runs a lightweight analysis:

```typescript
interface CapabilityGap {
  id: string;
  category: "missing_tool"           // Needed a tool that doesn't exist
           | "weak_domain"           // Poor performance in a specific domain
           | "inefficient_pattern"   // Task succeeds but wastes too many tokens/time
           | "missing_context"       // Lacked environmental awareness
           | "prompt_weakness";      // System prompt or agent definition is suboptimal

  description: string;               // Human-readable explanation
  evidence: GapEvidence[];           // Which tasks exposed this weakness
  frequency: number;                 // How often this gap is encountered
  impact: "low" | "medium" | "high"; // Effect on task success rate

  // Self-proposed fix
  proposedFix?: EvolutionProposal;
  status: "detected" | "proposal_generated" | "fix_applied" | "validated" | "wont_fix";
}

interface GapEvidence {
  taskId: string;
  timestamp: string;
  failureMode: string;               // What specifically went wrong
  tokenWaste?: number;               // How many tokens were wasted due to this gap
}
```

**Gap detection patterns:**

| Pattern | Detection Logic | Example |
|---------|----------------|---------|
| Missing tool | Agent's ReAct loop mentions needing X but no tool exists | "I need to make an HTTP request but have no tool for it" |
| Weak domain | User edit rate > 50% for tasks in domain D | User rewrites most CSS output → weak CSS domain |
| Inefficient pattern | Avg ReAct iterations for task type T > 2× median | Simple file renames take 10 iterations instead of 2 |
| Missing context | Agent asks user for info that should be ambient | "What framework does this project use?" (should know from project analysis) |
| Prompt weakness | Same misunderstanding pattern across 3+ tasks | Agent consistently misinterprets "refactor" as "rewrite" |

#### 4. Self-Mutation — Writing Code to Fix Yourself

This is the most powerful and most carefully controlled layer. When Nous identifies a gap and generates an EvolutionProposal, it can implement the fix itself.

```typescript
interface EvolutionProposal {
  id: string;
  gapId: string;                     // Which gap this addresses
  type: "new_tool"                   // Create a new tool implementation
      | "new_skill"                  // Compile a new skill from patterns
      | "prompt_improvement"         // Improve a system prompt or agent definition
      | "code_patch"                 // Patch Nous's own source code
      | "config_change";             // Modify runtime configuration

  description: string;               // What this proposal does
  rationale: string;                 // Why this is the right fix
  implementation: string;            // The actual code/config change
  testPlan: string;                  // How to validate the fix works

  // Risk assessment
  risk: "low" | "medium" | "high";
  reversible: boolean;               // Can this change be undone?
  affectedComponents: string[];      // Which parts of the system are touched

  // Approval
  requiresHumanApproval: boolean;    // Derived from risk level + permission
  status: "proposed" | "approved" | "implementing" | "testing" | "validated" | "rejected" | "rolled_back";

  // Validation results
  testResults?: {
    passed: boolean;
    details: string;
    beforeMetrics: PerformanceMetrics;
    afterMetrics: PerformanceMetrics;
  };
}

interface PerformanceMetrics {
  avgTokensPerTask: number;
  avgReactIterations: number;
  successRate: number;
  userSatisfactionRate: number;
}
```

**Self-mutation safety rules:**

```
Can Nous auto-apply this evolution?
  │
  ├── type == "new_skill" AND risk == "low"?
  │   └── YES. Skills are additive — they don't change existing behavior.
  │       Auto-apply, log to Evolution Log, validate on next matching task.
  │
  ├── type == "new_tool" AND risk == "low"?
  │   └── MAYBE. Check evolution.self_mutate permission.
  │       If auto_allow → create tool, register, log.
  │       If always_ask → show proposal to user for approval.
  │
  ├── type == "prompt_improvement"?
  │   └── MAYBE. Check risk level.
  │       Low risk (minor wording) → auto-apply with A/B test.
  │       Medium/high risk → user approval required.
  │
  ├── type == "code_patch"?
  │   └── ALWAYS ask user. Code patches are never auto-applied.
  │       Present: diff, rationale, test plan, risk assessment.
  │       User decides: apply / reject / modify.
  │
  └── type == "config_change"?
      └── Check specific config key against permission rules.
```

**The key insight:** Low-risk, additive evolution (new skills, new tools) can be automatic. High-risk, subtractive evolution (code patches, prompt changes) always involves the user. This lets Nous grow rapidly in safe dimensions while remaining human-supervised in dangerous ones.

### Evolution Feedback Loop — Every Signal Counts

Every interaction is a learning signal, not just explicit corrections:

| Signal | What Nous Learns | Category |
|--------|-----------------|----------|
| User accepts result without edit | Execution path was correct — reinforce skill | Weak positive |
| User edits result | Execution was close but imperfect — the diff is the lesson | Strong informative |
| User rejects result entirely | Approach was wrong — analyze what went wrong, create gap | Strong corrective |
| User says "perfect" / "exactly" | Non-obvious approach validated — promote to skill | Strong positive |
| User undoes Nous's action | Overstepped or misjudged — analyze why, flag pattern | Critical corrective |
| User ignores proactive suggestion | Suggestion wasn't valuable — recalibrate for this domain | Weak corrective |
| User acts on proactive suggestion | Proactivity was valuable — reinforce this suggestion pattern | Strong positive |
| Task takes 3× expected tokens | Inefficiency detected — flag for gap analysis | Efficiency signal |
| Same error pattern 3 times | Systematic weakness — create CapabilityGap | Gap signal |

### Evolution Data Models

```typescript
interface EvolutionState {
  nousInstanceId: string;

  // Accumulated capabilities
  skills: Skill[];                   // Crystallized, directly invocable execution paths
  evolvedTools: ToolDefinition[];    // Tools Nous created for itself

  // Known weaknesses
  activeGaps: CapabilityGap[];       // Detected but not yet fixed
  resolvedGaps: CapabilityGap[];     // Fixed and validated

  // Improvement history
  proposals: EvolutionProposal[];    // All proposals, regardless of status
  totalTasksAnalyzed: number;
  totalSkillsCreated: number;
  totalToolsCreated: number;
  totalCodePatchesApplied: number;

  // Performance trajectory
  performanceHistory: {
    period: string;                  // "2026-W13", "2026-W14", ...
    avgTokensPerTask: number;
    avgSuccessRate: number;
    avgUserSatisfaction: number;
    skillHitRate: number;            // % of tasks where an existing skill was applicable
  }[];
}
```

### The Evolution Architecture in One Picture

```
                    ┌──────────────────────────────────────────┐
                    │         Nous Collective Network           │
                    │  Shared Skills · Specialist Registry ·   │
                    │  Collective Gap Database                  │
                    │  (anonymized experience flows up)         │
                    └───────┬──────────────┬───────────────────┘
                            │              │
              ┌─────────────┼──────────────┼─────────────┐
              │             │              │             │
       ┌──────▼──────┐ ┌───▼────────▼───┐ ┌─────▼──────┐
       │   Nous A     │ │    Nous B      │ │   Nous C    │
       │              │ │                │ │              │
       │ ┌──────────┐ │ │ ┌──────────┐  │ │ ┌──────────┐│
       │ │ Evolution│ │ │ │ Evolution│  │ │ │ Evolution││
       │ │ Engine   │ │ │ │ Engine   │  │ │ │ Engine   ││
       │ │          │ │ │ │          │  │ │ │          ││
       │ │ Skills   │ │ │ │ Skills   │  │ │ │ Skills   ││
       │ │ Gaps     │ │ │ │ Gaps     │  │ │ │ Gaps     ││
       │ │ Proposals│ │ │ │ Proposals│  │ │ │ Proposals││
       │ │ Memory   │ │ │ │ Memory   │  │ │ │ Memory   ││
       │ │ Metabol. │ │ │ │ Metabol. │  │ │ │ Metabol. ││
       │ └──────────┘ │ │ └──────────┘  │ │ └──────────┘│
       │              │ │               │ │              │
       │  Permission  │ │  Permission   │ │  Permission  │
       │  (user ctrl) │ │  (user ctrl)  │ │  (user ctrl) │
       └──────┬───────┘ └───────┬───────┘ └──────┬──────┘
              │                 │                 │
         User Alice        User Bob          User Carol
```

**Key distinction from the old architecture:** Permission (the outer boundary of what Nous is allowed to do) is separate from Evolution (how capable Nous actually is). A Nous with full permissions but zero skills is powerful but clumsy. A Nous with many skills but restricted permissions is smart but constrained. The ideal state is both: many skills AND user-granted permissions that match the skill level.

---

## Inter-Nous Communication Architecture

How do Nous instances talk to each other? This is a fundamental infrastructure decision that affects privacy, scalability, reliability, and user control. We reason from first principles.

This is the **destination architecture** for collective intelligence. The important v1 rule is that even before full networking exists, a local Nous instance must already model the right primitives — **Instance identity, Scope boundaries, Provenance, Skill validation, and CommunicationPolicy**. Otherwise inter-Nous exchange would require rewriting local assumptions instead of extending them.

### Why Not Pure Centralized, Why Not Pure P2P

| Architecture | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **Pure centralized** (all communication through one server) | Simple to build, easy to monitor, consistent | Single point of failure, privacy bottleneck (all data transits one point), operator sees everything, scales poorly | Too fragile, too much trust required |
| **Pure P2P** (every Nous talks directly to every other) | No single point of failure, maximum privacy | Discovery problem (how to find each other?), NAT traversal hell, no global view for trend detection, hard to audit | Too complex, loses collective intelligence benefits |
| **Hybrid: thin registry + direct exchange** | Best of both — lightweight coordination with private data exchange | More moving parts than pure central | **This is what we choose** |

### The Hybrid Architecture

The design separates **coordination** (lightweight, centralized) from **data exchange** (direct, encrypted, P2P).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Nous Relay Network                                │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  Identity Relay   │  │  Discovery Index  │  │  Trend Aggregator │      │
│  │                   │  │                   │  │                   │      │
│  │  Anonymous Nous   │  │  "Who knows about │  │  Counts patterns  │      │
│  │  registration.    │  │   Kubernetes?"    │  │  across instances. │      │
│  │  Issues ephemeral │  │                   │  │  Emits collective  │      │
│  │  identities.      │  │  Returns ranked   │  │  insights.         │      │
│  │  No user data.    │  │  specialist list. │  │  Never sees raw    │      │
│  │                   │  │  No content, only │  │  content — only    │      │
│  │                   │  │  capability meta. │  │  domain + outcome  │      │
│  │                   │  │                   │  │  signals.           │      │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬──────────┘      │
│           │                     │                      │                  │
└───────────┼─────────────────────┼──────────────────────┼─────────────────┘
            │                     │                      │
    ┌───────┼─────────────────────┼──────────────────────┼──────────┐
    │       │  CONTROL PLANE (metadata only, no content)  │          │
    │───────┼─────────────────────┼──────────────────────┼──────────│
    │       │  DATA PLANE (direct, encrypted, P2P)        │          │
    │       │                     │                      │          │
    │   ┌───▼───┐             ┌───▼───┐              ┌───▼───┐     │
    │   │Nous A │◄═══════════►│Nous B │◄════════════►│Nous C │     │
    │   │       │  E2E encrypted │       │  E2E encrypted │       │     │
    │   │       │  direct exchange│       │  direct exchange│       │     │
    │   └───┬───┘             └───┬───┘              └───┬───┘     │
    │       │                     │                      │          │
    └───────┼─────────────────────┼──────────────────────┼──────────┘
            │                     │                      │
       User Alice             User Bob              User Carol
       (full visibility)      (full visibility)     (full visibility)
```

**Key principle: the Relay Network never sees content.** It only handles metadata (who exists, who knows what, aggregate statistics). All actual knowledge exchange happens directly between Nous instances, end-to-end encrypted.

### Three Communication Layers

#### Layer 1 — Control Plane (via Relay Network)

The Relay Network provides three lightweight services:

**1a. Identity Relay**
- Each Nous instance registers with an ephemeral, anonymous identity
- No user information, no IP logging beyond what's needed for routing
- Issues short-lived tokens for authenticated P2P connections
- Analogous to: DNS + certificate authority

**1b. Discovery Index**
- Stores `NousSpecialistProfile` data (domain expertise, pattern counts)
- Answers queries like "find instances with expertise in `devops.k8s`"
- Returns ranked lists, never content
- Analogous to: search engine index (knows *about* pages, doesn't store pages)

**1c. Trend Aggregator**
- Receives anonymized signals: "I encountered a task in domain X with outcome Y"
- Aggregates across instances to detect trends, common failures, emerging patterns
- Emits `CollectiveInsight` when statistical thresholds are met
- Never receives task content, file contents, or user data
- Analogous to: public health surveillance (counts cases, doesn't see patient records)

#### Layer 2 — Data Plane (Direct P2P)

All actual knowledge exchange happens directly between Nous instances:

```
Nous A                                                    Nous B
  │                                                         │
  │  1. Discovery: "Who knows about streaming data?"        │
  │  ──────────────► Relay ──────────────►                  │
  │  ◄────────────── Relay ◄──────────────                  │
  │     "Nous B, expertise: 0.87"                           │
  │                                                         │
  │  2. Handshake: Request consultation (via Relay routing)  │
  │  ════════════════════════════════════════════════════►   │
  │     Nous B's Communication Policy: auto-accept for      │
  │     domain queries if requester trust > 0.5             │
  │                                                         │
  │  3. Direct exchange (E2E encrypted, Relay is bypassed)  │
  │  ◄═══════════════════════════════════════════════════   │
  │     Anonymized procedural pattern + context              │
  │                                                         │
  │  4. Feedback: "This was helpful" (via Relay stats)      │
  │  ──────────────► Relay ──────────────►                  │
  │     Updates Nous B's helpfulness rating                  │
```

**Why P2P for data exchange:**
- No central entity ever sees the knowledge being shared
- If the Relay goes down, existing P2P connections continue working
- Users can verify (via their local audit log) exactly what was shared and with whom
- Encryption keys are per-session, per-pair — compromising one connection doesn't compromise others

#### Layer 3 — User Control Plane (Local)

Every Nous instance has a **Communication Dashboard** that gives its user full visibility and control:

```typescript
interface CommunicationPolicy {
  // Master switch
  networkEnabled: boolean;              // false = fully isolated, no communication

  // Contribution policy
  sharing: {
    enabled: boolean;                   // Allow contributing patterns to shared pool
    autoShare: boolean;                 // Auto-share, or require approval per pattern
    excludeDomains: string[];           // Never share patterns from these domains
    excludeKeywords: string[];          // If pattern contains these words, block sharing
    minLocalConfidence: number;         // Only share patterns above this confidence
  };

  // Consultation policy (being consulted by others)
  respondToQueries: {
    enabled: boolean;                   // Allow other Nous instances to consult this one
    autoRespond: boolean;               // Auto-respond, or queue for user approval
    maxConsultationsPerDay: number;     // Rate limit
    allowedDomains: string[];           // Only respond for these domains (empty = all)
    blockedInstances: string[];         // Block specific Nous instances
  };

  // Consultation policy (consulting others)
  queryOthers: {
    enabled: boolean;                   // Allow this Nous to seek help from others
    autoQuery: boolean;                 // Auto-query, or ask user first
    maxQueriesPerDay: number;           // Rate limit
    preferredSpecialists: string[];     // Prefer these instances (e.g., team members)
  };

  // Receiving collective insights
  collectiveInsights: {
    enabled: boolean;                   // Receive trend alerts and best practices
    autoApply: boolean;                 // Auto-apply recommendations, or review first
    minConfidence: number;              // Only show insights above this confidence
  };
}
```

### Communication Audit Log

Every inter-Nous communication is recorded in the local Event Store, fully visible to the user:

```typescript
interface CommunicationEvent extends Event {
  type: "comm.pattern_shared"
      | "comm.consultation_requested"
      | "comm.consultation_received"
      | "comm.consultation_responded"
      | "comm.insight_received"
      | "comm.policy_changed"
      | "comm.blocked"
      | "comm.connection_established"
      | "comm.connection_terminated";

  direction: "outbound" | "inbound";
  counterpartyId: string;             // Anonymous Nous instance ID
  domain: string;                      // What domain this was about
  contentSummary: string;              // Human-readable summary of what was exchanged
  contentHash: string;                 // Cryptographic hash for verification
  policyApplied: string;              // Which policy rule governed this communication
  userAction?: "approved" | "blocked" | "auto"; // How this was authorized
}
```

**The user can at any time:**

| Action | Effect |
|--------|--------|
| **View communication log** | See every inbound and outbound exchange, with summaries |
| **Block a specific instance** | No further communication with that Nous |
| **Block a domain** | No sharing/consultation in a specific domain (e.g., block all "finance" patterns) |
| **Pause all communication** | Instant network isolation — `networkEnabled: false` |
| **Revoke a shared pattern** | Request deletion from the Shared Procedural Pool |
| **Review pending consultations** | Approve or deny consultation requests when `autoRespond: false` |
| **Set auto-policies** | Configure which communications need approval vs. auto-proceed |

### Autonomous Communication Rules

Nous instances can communicate automatically, but **within strictly bounded policies**:

```
Can this Nous auto-communicate?
  │
  ├── networkEnabled == false?
  │   └── NO. Full stop.
  │
  ├── Validated skills < 5?
  │   └── NO. Nous with few skills has nothing valuable to share.
  │       (Nous must demonstrate competence before participating
  │        in the network.)
  │
  ├── Outbound pattern sharing:
  │   ├── sharing.autoShare == true AND pattern.confidence > sharing.minLocalConfidence?
  │   │   └── YES, auto-share. Log to Communication Audit Log.
  │   └── Otherwise: Queue for user approval.
  │
  ├── Outbound consultation (asking for help):
  │   ├── queryOthers.autoQuery == true AND within daily rate limit?
  │   │   └── YES, auto-query. Log it.
  │   └── Otherwise: Ask user "I'd like to consult the network about X. OK?"
  │
  ├── Inbound consultation (being asked for help):
  │   ├── respondToQueries.autoRespond == true
  │   │   AND domain in allowedDomains
  │   │   AND requester not in blockedInstances
  │   │   AND within daily rate limit?
  │   │   └── YES, auto-respond. Log it.
  │   └── Otherwise: Queue for user review.
  │
  └── Collective insights:
      ├── collectiveInsights.autoApply == true AND insight.confidence > minConfidence?
      │   └── YES, apply and log.
      └── Otherwise: Show to user "The network recommends X because Y. Apply?"
```

**The evolution gate is critical:** A Nous with zero crystallized skills has nothing valuable to share. Network access requires at least 5 validated skills — earned through demonstrated competence. This prevents:
- Newly created Nous instances flooding the network with low-quality patterns
- Users being surprised by network activity before they understand their Nous
- Garbage-in-garbage-out in the collective pool

### Communication Protocol

The actual wire protocol between Nous instances:

```typescript
// All messages are envelope-wrapped for routing, E2E encrypted for privacy
interface NousMessage {
  id: string;
  from: string;                       // Ephemeral anonymous sender ID
  to: string;                         // Ephemeral anonymous recipient ID
  type: NousMessageType;
  encrypted: true;                    // Payload is always E2E encrypted
  payload: EncryptedPayload;          // Only sender and receiver can decrypt
  timestamp: string;
  ttl: number;                        // Message expires after N seconds
  replyTo?: string;                   // For request-response patterns
}

type NousMessageType =
  | "pattern.contribute"              // Share a pattern to the pool
  | "pattern.validate"                // Report that a shared pattern worked/failed
  | "pattern.retract"                 // Revoke a previously shared pattern
  | "consult.request"                 // Ask for help
  | "consult.response"               // Provide help
  | "consult.feedback"               // Rate helpfulness
  | "insight.broadcast"              // Collective insight from Trend Aggregator
  | "presence.heartbeat"             // Still alive and available
  | "presence.offline"               // Going offline
  | "handshake.initiate"             // Start a P2P connection
  | "handshake.accept"               // Accept a P2P connection
  | "handshake.reject";              // Reject (with reason)

// Relay only sees this outer envelope — not the encrypted payload
interface RelayEnvelope {
  messageId: string;
  from: string;
  to: string;
  type: NousMessageType;             // Relay needs type for routing, but not content
  size: number;                       // For rate limiting
  timestamp: string;
}
```

### Network Topology: Hybrid From Day One

**Reality constraint:** In 2026, the vast majority of machines sit behind NAT (home routers, corporate firewalls, cloud VPCs). No public IPv4, no way for Nous instances to discover or reach each other directly. **A relay is not a Phase 2 feature — it is a Day 1 requirement.**

The Nous Network is a hybrid architecture from MVP: a thin cloud relay for discovery and NAT traversal, with direct encrypted channels where possible.

```
MVP Architecture (Day 1):

                    ┌─────────────────────────────────────┐
                    │    Cloudflare Edge (Global)           │
                    │                                       │
                    │  ┌───────────┐  ┌───────────┐        │
                    │  │  Workers   │  │  Durable   │       │
                    │  │  (REST API)│  │  Objects   │       │
                    │  │            │  │  (WebSocket │       │
                    │  │ • Register │  │   relay)   │       │
                    │  │ • Discover │  │            │       │
                    │  │ • Pattern  │  │ • Tunnel   │       │
                    │  │   Pool API │  │   messages │       │
                    │  └─────┬─────┘  └─────┬──────┘       │
                    │        │     D1       │               │
                    │        └──►┌────┐◄────┘               │
                    │            │ DB │                      │
                    │            └────┘                      │
                    └──────┬──────────────┬────────────────┘
                           │              │
            WebSocket      │              │      WebSocket
          ┌────────────────┘              └───────────────┐
          │                                               │
    ┌─────▼─────┐                                   ┌─────▼─────┐
    │  Nous A    │                                   │  Nous B    │
    │  (behind   │     E2E encrypted channel         │  (behind   │
    │   NAT)     │◄═════(relayed through CF)════════►│   NAT)     │
    └─────┬─────┘                                   └─────┬─────┘
          │                                               │
     User Alice                                      User Bob
```

**Why this works from Day 1:**

| Component | Implementation | Cost (MVP) | Handles |
|-----------|---------------|------------|---------|
| **Workers** (stateless API) | Cloudflare Workers | Free tier: 100K req/day | Registration, discovery, pattern pool CRUD |
| **D1** (database) | Cloudflare D1 (edge SQLite) | Free tier: 5M reads/day, 100K writes/day | Discovery index, specialist profiles, pattern metadata |
| **Durable Objects** (stateful relay) | Cloudflare Durable Objects | ~$0.15/M requests | WebSocket relay for NAT traversal, message tunneling |
| **R2** (blob storage) | Cloudflare R2 | Free tier: 10GB | Larger pattern data, procedure step details |

**Total infrastructure cost for MVP: $0-5/month** (free tier covers early usage).

**How it scales:**

```
Phase 1: Single Relay (MVP, 0-1K instances)
  All traffic through one Cloudflare Workers deployment.
  CF edge automatically distributes across 300+ PoPs worldwide.
  No scaling concern — CF handles it.

Phase 2: Federated Relays (1K-100K instances)
  ┌───┐     ┌───┐     ┌───┐
  │CF │─────│R2 │─────│R3 │    Community/org can run their own relays.
  └─┬─┘     └─┬─┘     └─┬─┘   Relays sync discovery indexes.
    │         │          │      Like email federation: user@relay1 ↔ user@relay2.
  ○ ○ ○     ○ ○ ○      ○ ○     Nous instances choose their "home relay."

Phase 3: Relay + Direct (100K+ instances)
  ○═══○     Nous instances with public IPs or on same LAN
  │ ╲ │     can establish direct connections (skip relay).
  ○───○     Relay used only for discovery and fallback.
  │         Like WebRTC: try direct, fall back to relay.
  ○
```

**The protocol is the same at every phase.** A `NousMessage` doesn't know or care whether it traveled through a relay or a direct connection. The Relay Client in L4 handles routing transparently.

**Direct connection upgrade (when possible):**

```
1. Nous A and Nous B establish relay connection
2. Both attempt direct connectivity probe:
   - Same LAN? → mDNS discovery, direct TCP
   - Both have IPv6? → direct connection
   - One has public IP? → direct connection
   - Otherwise → stay on relay (perfectly fine)
3. If direct path found, messages switch to direct
4. Relay kept as fallback if direct path breaks
```

This is the exact pattern WebRTC uses. We don't need to solve NAT traversal in general — we just need to opportunistically upgrade when possible, and gracefully stay on relay when not.

---

## Design Decisions (Resolved)

These questions were originally open. After reasoning through the full architecture — from first principles, through the evolution engine, perception layer, and communication architecture — we can now make concrete decisions grounded in **current reality**: existing model capabilities, single-node v1 constraints, and limited resources.

**Guiding constraint for all decisions:** *Ship a working single-node system first. Design interfaces that allow future evolution. Never paint yourself into a corner, but never over-engineer for day one.*

---

### 1. LLM Provider Strategy

**Decision: LLM-agnostic at core, Anthropic-first for v1.**

```typescript
// Core defines an abstract LLM interface — no provider-specific types leak through
interface LLMProvider {
  chat(messages: Message[], tools?: ToolDef[]): AsyncIterable<StreamChunk>;
  capabilities(): ProviderCapabilities;  // context window, tool use support, vision, etc.
}

// v1 ships with one implementation
class AnthropicProvider implements LLMProvider { ... }

// Future: OpenAIProvider, OllamaProvider (local), etc.
```

**Why Anthropic first:** Best tool-use reliability as of today. Claude's extended thinking is ideal for the ReAct loop. Tool use format is clean and well-documented.

**How to handle provider differences:** The `ProviderCapabilities` interface lets the Orchestrator adapt — e.g., if a provider has a 32K context window, the Memory Manager compacts more aggressively. Provider-specific features (like extended thinking) are exposed as optional capabilities, not required.

**What this means for v1:** One provider, one set of API calls to debug. But the `LLMProvider` interface exists from day one, so adding a second provider is a new file, not a refactor.

---

### 2. Persistence Backend

**Decision: SQLite for everything in v1. Pluggable interface from day one.**

| Component | v1 Implementation | Future Option |
|-----------|-------------------|---------------|
| Event Store | SQLite append-only table with `created_at` index | EventStoreDB or Postgres with partitioning |
| Task Queue DB | SQLite with WAL mode for concurrent reads | Postgres for multi-node |
| Memory Store (Keyword) | SQLite FTS5 for full-text search | — (FTS5 is already production-grade) |
| Memory Store (Vector) | sqlite-vec for ANN search on embeddings | Qdrant or ChromaDB if scale demands |
| Memory Store (Graph) | SQLite adjacency tables for entity relations | Neo4j or DGraph for heavy graph queries |
| Perception Log | SQLite with auto-vacuum (short retention) | TimescaleDB or ClickHouse |
| Evolution Log | SQLite (gaps, proposals, skills, traces) | — |

**Why SQLite:** Single file, zero configuration, embedded in the Bun process, ACID-compliant, handles hundreds of thousands of rows without breaking a sweat. For a single-user, single-node agent framework, SQLite is not a compromise — it is the correct choice. It eliminates an entire class of ops problems (connection pools, migrations, backups are just file copies).

**Why sqlite-vec over sqlite-vss:** sqlite-vss depends on the legacy fts3 extension; sqlite-vec is the successor by the same author (Alex Garcia), cleaner API, actively maintained, and works with Bun's native SQLite driver.

**The pluggable interface:**

```typescript
interface PersistenceBackend {
  events: EventStore;
  tasks: TaskStore;
  memory: MemoryStore;
  perception: PerceptionStore;
}

// v1: everything is SQLite
const backend = new SQLitePersistenceBackend("./nous.db");
```

---

### 3. Agent Identity and Lifecycle

**Decision: TypeScript config files + runtime registration. No hot-reload in v1. Versioning via git.**

```typescript
// agents/code-analyst.ts
export default defineAgent({
  name: "code-analyst",
  role: "specialist",
  capabilities: {
    "fs.read": { paths: ["**"] },
    "fs.write": false,
    "shell.exec": false,
  },
  personality: {
    style: "thorough",
    toolPreferences: ["read_file", "grep", "glob"],
  },
  systemPrompt: `You are a code analysis specialist. You read code,
    identify patterns, and produce structured analysis. You never
    modify files directly.`,
});
```

**Why TypeScript config, not JSON/YAML:** Agents need logic (conditional capabilities, dynamic system prompts). TypeScript gives us type safety + IDE autocomplete + the ability to compose agents from shared traits. JSON would be simpler but would immediately need an escape hatch for logic.

**Why no hot-reload in v1:** Hot-reloading stateful agents is hard and error-prone (what happens to an agent mid-task when its definition changes?). For v1, restart the process. The agent's *state* (current task, memory) survives restart because it's in SQLite. Only the *definition* reloads.

**Why git for versioning:** Agent definitions are code. Code versioning is a solved problem. `git log agents/code-analyst.ts` gives you full history. No need to reinvent this.

---

### 4. Tool Sandbox Implementation

**Decision: Bun subprocess with capability filtering. Timeout via `AbortController`. No Docker for v1.**

```typescript
// Tool execution is always in a subprocess
async function executeTool(tool: Tool, args: unknown, permissions: PermissionRule[]): Promise<ToolResult> {
  // 1. Check permission BEFORE spawning
  if (!isPermitted(tool.requiredCapabilities, permissions)) {
    return { error: "permission_denied", detail: `Tool ${tool.name} requires ${tool.requiredCapabilities}` };
  }

  // 2. Spawn subprocess with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), tool.timeoutMs ?? 30_000);

  try {
    const proc = Bun.spawn(tool.command, {
      signal: controller.signal,
      env: filterEnv(permissions),     // Only pass allowed env vars
      cwd: sandboxDir(permissions),   // Restrict working directory
    });
    return await collectResult(proc);
  } finally {
    clearTimeout(timeout);
  }
}
```

**Why not Docker:** Docker adds 200-500ms cold start per tool invocation. For an agent that might call 50 tools in a single task, that's 10-25 seconds of pure overhead. Unacceptable for v1 where responsiveness matters.

**Why not Deno-style permissions:** Deno's permission model is elegant but requires running tools as Deno scripts. We need to support arbitrary executables (git, npm, curl, etc.).

**The v1 tradeoff:** Bun subprocess isolation is lighter than Docker but provides: process-level memory isolation, timeout enforcement, filtered environment variables, and restricted CWD. This is sufficient for a single-user system where the user trusts their own tools. For multi-tenant or untrusted tools, Docker becomes necessary — the interface supports this swap.

**Resource limits:** v1 uses `AbortController` for timeouts and trusts the OS for memory limits. For v2, consider `cgroups` (Linux) or `ulimit` for hard resource caps.

---

### 5. Inter-Agent Communication

**Decision: Event bus via Event Store. Sub-agents yes, with depth limit of 3 and budget caps.**

Agents communicate through events, not direct messages. This is consistent with the event-sourcing architecture:

```typescript
// Agent A completes analysis, emits event
await eventStore.append({
  type: "task.completed",
  entityType: "task",
  entityId: task.id,
  payload: { result: analysisResult },
  agentId: agentA.id,
});

// Task Scheduler (polling Event Store) sees this, unblocks dependent tasks
// Agent B is assigned the next task, receives Agent A's result as context
```

**Why event bus, not direct messaging:** Direct messaging creates coupling between agents. Agent A doesn't need to know Agent B exists. The Scheduler handles routing. This also means the Event Store is the single source of truth — no message can be lost or duplicated.

**Sub-agent spawning rules:**

```typescript
interface SubagentPolicy {
  maxDepth: 3;                    // A → B → C → D is the deepest chain
  maxConcurrentPerParent: 5;      // One agent can have at most 5 sub-agents running
  budgetInheritance: "split";     // Sub-agents share parent's remaining budget
  supervisorModel: "one_for_one"; // If a sub-agent fails, only that one is restarted
}
```

**Infinite loop prevention:** Each agent spawn event includes the full ancestry chain. If `agentId` appears in its own ancestry, the spawn is rejected. Combined with `maxDepth: 3`, this makes infinite spawning structurally impossible.

---

### 6. Human Interface

**Decision: Daemon + thin CLI client for MVP. Non-blocking, multi-channel architecture. CLI-first, other clients follow.**

The CLI is no longer Nous itself — it is a thin client that connects to the Nous daemon via Unix Domain Socket. This enables non-blocking interaction, persistent execution, and multi-channel support.

```bash
# Submit an intent (non-blocking — returns immediately)
$ nous "Add dark mode to this extension"
  Intent submitted → Thread #dark-mode
  Plan: 5 tasks (T1→T5). Nous is working.

# Check status from any terminal
$ nous status
  ✓ T1: Analyze CSS structure [2.3s]
  ► T2: Create theme toggle component [running...]
  ► T3: Add dark theme CSS variables [running...]
  ○ T4: Wire toggle into popup UI [blocked by T2, T3]
  ○ T5: Test in browser [blocked by T4]

# Attach to live progress (Ctrl+C to detach, NOT cancel)
$ nous attach #dark-mode
  [streaming progress, tool calls, results...]

# Interactive REPL mode (multi-turn conversation)
$ nous
  nous> Add dark mode to this extension
  On it. Thread #dark-mode. Planning...
  nous> Also make the toggle remember user preference
  Added to the plan. T6: Persist theme preference (after T4).
  nous> [Ctrl+D to exit REPL — daemon keeps running]
```

**Human Decision Queue surfaces as push notification:**

```bash
# If you're attached to a thread:
  ⚠ Decision needed:
  T3 wants to modify manifest.json (irreversible: changes extension permissions)
  [a]pprove  [d]eny  [m]odify  [v]iew diff

# If you're not attached (terminal closed), message waits in outbox:
$ nous
  Welcome back. 1 decision pending:
  [1] T3: modify manifest.json? (waiting 12m) [a]pprove [d]eny [v]iew
```

**Why daemon + thin client (not foreground CLI):**
- Closing the terminal does NOT stop work — Nous is an OS process, not a conversation
- Multiple terminals = one Nous, shared context, no session isolation
- Non-blocking: submit intent and go, results push to you
- Survives crashes: all state in SQLite, daemon auto-recovers

**v2: Web dashboard** for monitoring (long-running tasks, agent status, communication log). Connects to the same daemon via WebSocket.

**v2: IDE extension** (VS Code / JetBrains) for inline agent interaction. Another client to the same daemon — shares all state, threads, and memory with CLI.

---

### 7. Deployment Model

**Decision: Single Bun daemon process + thin CLI client. Clean module boundaries for future splitting.**

```
v1: Daemon + Client
┌──────────────────────────────────┐     ┌──────────────┐
│     Nous Daemon (Bun Process)     │     │  CLI Client   │
│                                   │     │  (thin Bun)   │
│  ┌──────────┐                    │     │               │
│  │ Dialogue │                    │◄────│  Connects via │
│  │  Layer   │                    │     │  Unix Socket  │
│  └──┬───────┘                    │     │               │
│  ┌──▼──┐ ┌──────┐ ┌──────┐     │     └──────────────┘
│  │ L0  │ │  L1  │ │  L2  │     │
│  │Intent│ │Orch. │ │ Run  │     │     ┌──────────────┐
│  └──┬───┘ └──┬───┘ └──┬───┘     │     │  IDE Plugin   │
│     │        │        │          │◄────│  (future)     │
│  ┌──▼────────▼────────▼───┐     │     └──────────────┘
│  │  L3 Persistence         │     │
│  │  (SQLite: events, tasks,│     │     ┌──────────────┐
│  │   messages, memory)     │     │     │  Web UI       │
│  └─────────────────────────┘     │◄────│  (future)     │
│                                   │     └──────────────┘
│  L4: Sensors, IPC server,        │
│      Process Supervisor           │
└──────────────────────────────────┘
```

**Why single daemon process:**
- No network calls between layers — function calls are nanoseconds, HTTP is milliseconds.
- One thing to deploy, one thing to monitor, one log stream.
- SQLite requires single-process access anyway (WAL mode allows concurrent reads but single writer).
- A single Bun process comfortably handles one user's agent workload.
- **Daemon survives terminal close** — the defining behavioral difference from CLI-only frameworks.

**Why separate CLI client:** The CLI client is ~100 lines: connect to socket, send message, receive response, render output. Keeping it separate means the daemon can be started once (via launchd/systemd or manually) and the CLI is just a lightweight connector.

**Preparation for future splitting:** Each layer is a separate package (`packages/orchestrator`, `packages/runtime`, `packages/dialogue`, etc.) with explicit interfaces. When the time comes to split, the interface stays the same — only the transport changes (function call → HTTP/gRPC).

**When to split:** When Nous needs to survive the user's laptop sleeping (→ move orchestrator to a server), or when multiple users share an orchestrator (→ multi-tenant), or when agent compute needs GPU (→ separate runtime nodes). None of these apply to v1.

---

### 8. Testing Strategy

**Decision: Three-layer testing with recorded LLM responses for determinism.**

```
Layer 1: Unit Tests (no LLM)
  - Test state machines, schedulers, memory metabolism logic
  - Mock the LLMProvider interface with canned responses
  - Fast, deterministic, run on every commit
  - Target: All business logic in L1-L4

Layer 2: Recorded Integration Tests (recorded LLM)
  - Record real LLM API calls once, replay them in CI
  - Test the full pipeline: Intent → Plan → Task → Agent → Result
  - Deterministic (same recording = same output)
  - Re-record when agent definitions or prompts change
  - Tool: Custom recorder that wraps LLMProvider

Layer 3: Live Integration Tests (real LLM, optional)
  - Run against real API with a budget cap ($5/run)
  - Non-deterministic — used for validation, not gating
  - Run manually or on release branches, not on every PR
  - Asserts on structure (did the agent produce a file?) not content
```

```typescript
// The test recorder
class RecordedLLMProvider implements LLMProvider {
  constructor(
    private recordings: Recording[],  // Pre-recorded responses
    private mode: "replay" | "record" // Replay in CI, record locally
  ) {}

  async *chat(messages, tools) {
    if (this.mode === "record") {
      const result = await this.realProvider.chat(messages, tools);
      this.save(messages, tools, result);
      yield* result;
    } else {
      yield* this.findMatch(messages, tools);  // Fuzzy match on message structure
    }
  }
}
```

**Why not just mock everything:** Mocks test your assumptions about the LLM, not the LLM's actual behavior. The recording approach captures real behavior and replays it deterministically. When the recording drifts from reality (prompt changes), you re-record — which also serves as a manual check that the new behavior is correct.

---

### 9. Procedural Memory Details

**Decision: Task-type tag + semantic similarity hybrid. Invalidation via content hash.**

**What constitutes a "reusable execution path":**

```typescript
interface ProceduralMemory {
  id: string;
  // Matching
  taskTypeTags: string[];           // ["eslint.setup", "monorepo.config"] — exact match, fast
  semanticEmbedding: number[];      // Vector embedding of task description — fuzzy match, slower
  applicabilityConditions: string[]; // ["project uses TypeScript", "monorepo detected"] — guard clauses

  // The actual procedure
  steps: ProceduralStep[];

  // Validation
  successCount: number;
  failureCount: number;
  lastUsed: string;
  contentHash: string;              // Hash of step definitions — detects drift

  // Provenance
  sourceEpisodeIds: string[];       // Which episodic memories this was compiled from
}
```

**Matching strategy (two-pass):**

```
Incoming task: "Set up ESLint in this project"

Pass 1 (fast): Tag match
  → Search procedural memories with tag "eslint.setup"
  → If found AND applicabilityConditions met → use it

Pass 2 (slow, only if pass 1 fails): Semantic similarity
  → Embed task description
  → Vector search against all procedural memory embeddings
  → If similarity > 0.85 AND applicabilityConditions met → use it
  → If similarity 0.7-0.85 → suggest to agent as reference, don't auto-apply
```

**Invalidation:** Procedures include a `contentHash` of the files/tools they reference. On each use, the system checks if the referenced files have changed (git diff) or tools have been removed. If the hash mismatches, the procedure is marked `needs_revalidation` — it's still available as a reference but won't auto-execute.

---

### 10. Security Model

**Decision: Permission System modeled after Claude Code. User-controlled, no auto-escalation, no decay. Secrets via env vars + encrypted local store.**

**Permission model:** See the Permission System section above for full details. Key design points:

- Default safe permission set at install (read + safe commands auto-allowed)
- User progressively confirms permissions during interaction (ask_once pattern)
- Grant-all escape hatch for power users
- User can revoke any permission at any time, effective immediately
- No automatic decay or reduction — permissions only change when user explicitly changes them
- Scoped by directory (glob patterns), command (allowlist), network (domain list), system level

**Agents declare needs, users control access:**

```typescript
// Agent declares what it needs
const agent = defineAgent({
  name: "code-analyst",
  capabilitiesRequired: ["fs.read", "shell.exec"],  // What the agent needs
  // Whether these are GRANTED depends on PermissionRules, not agent definition
});

// At runtime:
// Agent requests fs.read for src/main.ts
// → Permission System checks PermissionRules
// → If auto_allow: proceed
// → If ask_once/always_ask: prompt user
// → If deny: reject with explanation
```

**Secrets management:**

```
v1: Environment variables + file-backed SecretStore (~/.nous/secrets/providers.json)
    Env still has highest priority for CI / temporary overrides.
    File-backed secrets are allowed for usability.
    Nous NEVER logs secret values.
    Provider/runtime code depends on SecretStore, not direct file reads.
    Permission rules control which secrets or env vars are visible to which agent.

v2: Encrypted local secret store (age or libsodium)
    → nous secrets set ANTHROPIC_API_KEY
    → Stored encrypted at rest in ~/.nous/secrets.enc
    → Decrypted into agent subprocess env at runtime, never on disk in plaintext
```

**Audit log:** Every permission check (granted or denied) is an Event. The CLI can query: `nous permissions log --last 24h` to see every permission usage.

---

### 11. Evolution Engine Calibration

**Decision: Start conservative, tune empirically. Ship with sensible defaults and an evolution log.**

**Skill crystallization thresholds (deliberately conservative — better to miss a pattern than to create a bad skill):**

| Evolution Action | Minimum Criteria | Notes |
|-----------------|------------------|-------|
| Episodic → Semantic extraction | 3+ episodes with >0.85 vector similarity | Pattern must be real, not coincidental |
| Semantic → Procedural compilation | 5+ semantic facts describing a repeatable workflow | Must cover a complete workflow, not fragments |
| Procedural → Skill promotion | 3+ validations with >80% success rate, >70% user satisfaction | Skill must be proven reliable |
| Gap Detection trigger | 3+ tasks exhibiting the same failure pattern OR >50% user edit rate in a domain | Systematic weakness, not one-off failure |
| Auto-apply Skill | risk == "low" AND type == "new_skill" | Skills are additive — safe to auto-apply |
| Auto-create Tool | evolution.self_mutate == "auto_allow" AND risk == "low" | User must have granted self-mutation permission |
| Code Patch | ALWAYS requires human approval | Never auto-apply code changes to Nous's own source |

**No permission decay.** Permissions are user-controlled and do not change automatically. If you granted Nous file write access, it stays until you revoke it.

**Evolution portability:** A user can export their Nous's evolved Skills and import them on a new machine. Skills transfer at full fidelity (they are code, not implicit state). Evolved tools also transfer (they are TypeScript files in `.nous/tools/`).

**Evolution rollback:** Every evolution action (new skill, new tool, prompt change) is logged with a before/after snapshot. `nous evolution rollback <proposal-id>` reverts a specific change. This makes self-mutation safe — every change is reversible.

**Calibration log:** Every evolution action is logged with the specific evidence that triggered it. `nous evolution history` shows the full trajectory — what skills were learned, what gaps were detected, what mutations were applied. This data is essential for tuning thresholds after real-world usage.

---

### 12. Memory Metabolism Implementation

**Decision: Vector similarity (>0.85) on embeddings triggers extraction. Shadow execution for validation. 90-day episodic retention. sqlite-vec for ANN search.**

**Similarity detection (the core improvement over FTS-only):**

```
episodic → semantic:
  Step 1: Embed each new episodic memory via EmbeddingProvider
  Step 2: ANN search via sqlite-vec for existing episodic memories
          with cosine similarity > 0.85
  Step 3: When 3+ similar episodes cluster:
          → LLM synthesizes a general fact from the cluster
          → Create graph edges (derived_from) linking new semantic → source episodics
          → Mark source episodes as "digested"
          → Validation: the semantic memory must match the next similar episode

semantic → procedural:
  Step 1: Cluster semantic memories by domain tag + vector similarity
  Step 2: When 5+ semantic facts in a cluster describe a repeatable workflow:
          → LLM compiles into a step-by-step procedure
          → Create graph edges (compiled_into) linking procedural → source semantics
          → Validation: shadow execution on next matching task

procedural → skill (via Evolution Engine):
  Step 1: Track procedural memory usage and outcomes
  Step 2: When validated 3+ times with >80% success rate:
          → Evolution Engine promotes to Skill (first-class, directly invocable)
```

**Shadow execution:** When a new procedural memory is compiled, the next matching task runs the procedure in "shadow mode" — the agent executes normally using its ReAct loop, but the compiled procedure runs in parallel (without actually executing tools). If both produce the same tool calls in the same order, the procedure is validated. If they diverge, the procedure is flagged for review.

**Storage budget:**
- Episodic: 90-day retention. After metabolism (→ semantic), mark as "digested" and retain for 30 more days (audit trail), then prune.
- Semantic: No auto-prune. Invalidated only by contradicting evidence (tracked via `contradicts` graph edges).
- Procedural: No auto-prune. Invalidated by content hash drift or repeated failure.
- Embeddings: Stored alongside memory entries in sqlite-vec. Dimension matches the EmbeddingProvider (e.g., 1024 for Voyage, 1536 for OpenAI). Re-embedded on provider change.

**Conflicting procedures:** When two successful procedures exist for the same task type, keep both. Tag them with the conditions under which each succeeded. Let the agent choose based on current context. If one consistently outperforms, the other naturally decays in usage and eventually gets flagged as "stale alternative."

---

### 13. Collective Intelligence Infrastructure

**Decision: Centralized pool hosted by Nous project for v1. Validation-based trust scoring. Reciprocity incentive.**

**v1 architecture:**

```
Nous Project hosts:
  - Shared Procedural Pool (Postgres + pgvector, hosted)
  - REST API for contribution/retrieval
  - No P2P in v1 — all exchange goes through the pool

Why centralized for v1:
  - Dramatically simpler to build and debug
  - Easier to enforce quality (one place to validate patterns)
  - Privacy auditing is centralized (one system to secure)
  - Matches Phase 2 star topology from Communication Architecture
```

**Privacy verification:** Before a pattern is accepted into the pool, an automated LLM-based privacy scan checks for PII, file paths, usernames, API keys, and project-specific references. Patterns that fail are rejected with an explanation. This is not perfect (LLM-based detection has false negatives), so v2 adds a formal differential privacy layer.

**Incentive model:** Reciprocity. A Nous instance that only consumes patterns without contributing gets rate-limited on retrieval. Contribution score = `patterns_shared * avg_validation_score`. Top contributors get priority access. This mirrors academic citation: you publish to gain access to the community's knowledge.

**Adversarial pattern injection:** Every shared pattern starts at `confidence: 0.1`. It only rises when other Nous instances independently validate it (the pattern worked in their context too). A malicious pattern that doesn't actually work will never rise above the noise floor. Patterns below `confidence: 0.3` after 30 days are auto-pruned.

---

### 14. Inter-Nous Communication Infrastructure

**Decision: Cloudflare Workers for relay in v1. libsodium for E2E encryption. Relay-assisted tunneling (no STUN/TURN). Matrix-inspired federation for v2.**

| Component | v1 Choice | Rationale |
|-----------|-----------|-----------|
| **Relay hosting** | Cloudflare Workers + Durable Objects + D1 + R2 | Edge-distributed globally (300+ PoPs), zero cold start, free tier covers MVP, WebSocket relay via Durable Objects |
| **E2E encryption** | libsodium (tweetnacl.js in Bun) | Battle-tested, small, no native dependencies, X25519 key exchange + XSalsa20 stream cipher |
| **NAT traversal** | Relay-first, direct-upgrade-when-possible | Most machines are behind NAT. Relay is the default. Direct connections (same LAN / IPv6 / public IP) are opportunistic upgrades, not requirements |
| **Offline messages** | Relay stores encrypted payloads for 24h | Nous instances aren't always online; short TTL prevents unbounded storage |
| **Sybil prevention** | Rate limiting + proof-of-work for registration | v1: IP-based rate limiting + lightweight hashcash. v2: tie to real identity (GitHub account, etc.) |
| **Federation** | Single CF deployment for MVP (auto-global via edge) | CF Workers are already globally distributed. True federation (community-run relays) added when organizational isolation is needed |
| **Version skew** | Semantic versioning on message protocol | Messages include protocol version. Relay can translate between adjacent versions. Breaking changes require major version bump with 90-day overlap period |

**Why Cloudflare Workers over self-hosted:**
- Edge-distributed by default across 300+ PoPs (low latency globally, no multi-region setup)
- No server management, no scaling concerns, no NAT traversal infrastructure to maintain
- Durable Objects provide stateful WebSocket relay for NAT tunneling
- D1 (edge SQLite) for discovery index, R2 for blob storage — full stack on one platform
- **MVP cost: $0-5/month** on free tier. Scales to ~$50/month at 10K instances
- See "Network Topology: Hybrid From Day One" section for full architecture

**Why libsodium over Signal Protocol:** Signal Protocol is designed for multi-device, asynchronous messaging with forward secrecy — it's more complex than we need. Nous-to-Nous communication is session-based (not long-lived conversations), so libsodium's simpler box/secretbox primitives suffice. If we later need forward secrecy for persistent connections, we can layer in Double Ratchet.

---

### 15. User Communication Dashboard

**Decision: CLI-first with `nous network` commands. Three presets. Org policies via config inheritance.**

**CLI interface:**

```bash
# View network status
$ nous network status
  Network: enabled (5+ validated skills)
  Shared patterns: 12 contributed, 47 consumed
  Consultations: 3 given, 8 received (this month)
  Blocked instances: 0
  Policy: "balanced" preset

# View communication log
$ nous network log --last 7d
  2026-03-25 14:32  OUT  pattern.contribute  domain:eslint.config   auto-shared
  2026-03-25 16:01  IN   consult.request     domain:react.hooks     auto-responded
  2026-03-26 09:15  IN   insight.broadcast   "12 instances report vitest 3.x regression"
  2026-03-27 11:42  OUT  consult.request     domain:k8s.deploy      awaiting response...

# Manage policies
$ nous network policy set sharing.autoShare false   # Require approval for every share
$ nous network block instance-abc123                # Block a specific instance
$ nous network pause                                # Kill switch — instant isolation

# Review pending items
$ nous network pending
  1 consultation request awaiting your review:
  [1] Instance xyz789 asks about "TypeScript monorepo testing patterns"
      [a]pprove  [d]eny  [v]iew detail
```

**Three presets:**

| Preset | Sharing | Respond to Queries | Query Others | Insights | Who it's for |
|--------|---------|-------------------|--------------|----------|-------------|
| **Solo** | Off | Off | Off | Receive only | Privacy-maximizing. No outbound data. Still gets collective insights. |
| **Balanced** (default) | Auto-share, min confidence 0.8 | Auto-respond for declared domains | Auto-query, max 10/day | Auto-apply if confidence >0.9 | Most users. Participates in the network with sensible limits. |
| **Team** | Auto-share all | Auto-respond all | Auto-query unlimited | Auto-apply all | Organizational use. All Nous instances in the org share freely. |

**Org policies:** A `.nous/org-policy.json` file can be distributed (via git, MDM, or config management) to enforce organizational rules:

```json
{
  "networkEnabled": true,
  "sharing": {
    "enabled": true,
    "excludeDomains": ["finance.internal", "legal.contracts"]
  },
  "preset": "team",
  "presetLocked": false,
  "minTrustForNetwork": 2
}
```

`presetLocked: true` prevents the user from overriding (e.g., compliance requirement that all instances share within the org). `presetLocked: false` means the org policy is a default, not a mandate.

---

### 16. Daemon + Dialogue Architecture

**Decision: Daemon from MVP. Unix Domain Socket IPC. Persistent message outbox. Two-layer conflict detection. CLI-first client.**

**Why daemon instead of foreground CLI:**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Foreground CLI (like Claude Code) | Simple, familiar | Session isolation, blocking, state lost on close | Rejected: violates "OS not chatbot" principle |
| Web server (like ChatGPT) | Multi-client, persistent | Heavyweight, requires browser, not dev-native | Rejected for MVP: right for v2 Web UI |
| **Daemon + thin clients** | Persistent, multi-channel, non-blocking, survives terminal close | More complex IPC | **Chosen**: aligns with OS model |

**IPC choice — Unix Domain Socket vs alternatives:**

| Transport | Latency | Complexity | Cross-platform | Verdict |
|-----------|---------|-----------|----------------|---------|
| Unix Domain Socket | ~10μs | Low | macOS + Linux (Windows: named pipes) | **Chosen for MVP**: fast, simple, well-supported |
| TCP localhost | ~50μs | Low | Full | Fallback for Windows |
| gRPC | ~100μs | Medium | Full | Overkill for single-machine IPC |
| Shared memory | ~1μs | High | Partial | Overkill for message passing |

**Conflict detection — why two layers:**

Static resource analysis catches 80% of conflicts (file path overlap) with zero LLM cost. LLM semantic analysis handles the remaining 20% (contradictory goals, non-obvious dependencies). This keeps the common case fast and cheap while still handling complex scenarios correctly.

**Offline delivery — why persistent outbox:**

Messages are the atomic unit of human-Nous communication. Losing a message is as bad as losing an event in the Event Store. The outbox pattern (write → deliver → acknowledge) is a well-proven reliability pattern (cf. transactional outbox in distributed systems). The 7-day TTL prevents unbounded storage growth while giving users ample time to reconnect.

**MVP scope:** Daemon + Unix Socket IPC + CLI client + message outbox + Layer 1 conflict detection (static resource overlap). Layer 2 semantic conflict analysis exists but uses a simple prompt. IDE/Web clients deferred to v2.

---

## Roadmap, Resource Planning & Growth Strategy

This section bridges architecture into execution: what to build first, what resources are needed at each stage, and how Nous bootstraps its own growth — using itself.

### Phase 0: MVP — The Core Loop

**Goal:** A single-user Nous that can receive an intent, decompose it into tasks, execute them with agents, and learn from the results. **Ambient Intent is in MVP** — the perception pipeline (FS + Git sensors → Attention Filter → Ambient Intent) ships from day one as a core differentiator. The Relay Network also exists from Day 1, so even the first two Nous instances can communicate.

**MVP scope (what ships):**

```
Must Have (MVP)                          Not Yet (v2+)
─────────────────                        ────────────────
Dialogue: Daemon process                 IDE plugin client
Dialogue: Unix Socket IPC               Web UI client
Dialogue: CLI client (thin)              Mobile client
Dialogue: Message outbox (persistent)    Email/SMS fallback notifications
Dialogue: Thread tracking                —
Dialogue: Conflict detection (Layer 1)   Layer 2 (LLM semantic analysis, refined)
Dialogue: Multi-turn conversation        —
L0: Intent parsing (basic)               —
L0: Ambient Intent pipeline              Calendar/email/screen sensors
L1: Task DAG planner                     Multi-strategy routing
L1: Task Scheduler + state machine       —
L1: Agent Router (single strategy)       —
L1: Context Assembly (env + project)     User context from RAG (needs memory)
L1: Attention Filter (fast model)        —
L2: Agent Runtime (ReAct loop)           Shadow execution
L2: Tool System (Tier 1 + Tier 2)       Tier 3 (Evolved tools)
L2: Memory Manager (Tier 1-3 + RAG)     Full metabolism + Tier 4-5
L2: Evolution Engine (Layer 1-2)         Layer 3-4 (Gap Detection, Self-Mutation)
L3: SQLite + FTS5 + sqlite-vec          Graph index (later)
L3: Embedding Provider (Anthropic)       Local embedding (Ollama)
L3: Message Store (dialogue + outbox)    —
L4: Permission System                    —
L4: FS Sensor + Git Sensor               Full sensor suite
L4: Relay Client                         Direct connection upgrade
L4: Process Supervisor (basic)           —

Cloud: Relay Network on CF               Federated relays
Cloud: Shared Procedural Pool (basic)    Trend Aggregator, Collective Insights
```

**Development resources needed:**

| Resource | Specification | Monthly Cost | Purpose |
|----------|--------------|-------------|---------|
| **LLM API** | Anthropic Claude API (Sonnet for agents, Haiku for Attention Filter) | $300-500 | Agent ReAct loops, intent parsing, memory extraction, embedding |
| **Development Machine** | Already available | $0 | Local development + testing |
| **Cloudflare** | Workers + D1 + Durable Objects + R2 | $0-5 (free tier) | Relay Network, Shared Pool, Discovery Index |
| **Domain** | nous.dev or similar | $10/year | Relay endpoint, project website |
| **GitHub** | Free (open source) | $0 | Code hosting, CI/CD (Actions), Issues, Discussions |
| **npm / JSR** | Free | $0 | Package registry |

**MVP Phase Total: ~$300-500/month** (almost entirely LLM API costs)

---

### Phase 1: Dogfooding — Nous Promotes Nous

**The most convincing proof that Nous works is Nous doing real work.** Phase 1 starts the moment MVP ships: your own Nous instance becomes the first 24/7 operator.

#### What Your Promotion Nous Does

```
┌──────────────────────────────────────────────────────────────────┐
│  Joey's Nous — "Nous Zero" (the first production instance)       │
│                                                                   │
│  Sensors (always running):                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ GitHub Sensor │ │ Social Sensor│ │ Community    │             │
│  │               │ │              │ │ Sensor       │             │
│  │ • New issues  │ │ • Twitter/X  │ │ • Discord    │             │
│  │ • New PRs     │ │   mentions   │ │   questions  │             │
│  │ • Stars/forks │ │ • HN/Reddit  │ │ • Forum      │             │
│  │ • Discussions │ │   posts about│ │   threads    │             │
│  │               │ │   agent/AI   │ │              │             │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘             │
│         │                │                │                       │
│         ▼                ▼                ▼                       │
│  ┌────────────────────────────────────────────────┐              │
│  │              Attention Filter                    │             │
│  │  "Is this relevant to Nous growth?"              │             │
│  └──────────────────────┬─────────────────────────┘              │
│                         │                                         │
│                         ▼                                         │
│  Autonomous Actions:                                              │
│  ├── GitHub: Triage issues, label, respond to questions           │
│  ├── GitHub: Review simple PRs, suggest improvements              │
│  ├── Content: Draft blog posts / changelogs when features ship    │
│  ├── Social: Respond to mentions, share updates (with approval)   │
│  ├── Community: Answer Discord questions, onboard new users       │
│  └── Growth: Identify trending AI/agent discussions, draft        │
│       context-relevant responses showing Nous's approach          │
│                                                                   │
│  Human Decision Queue:                                            │
│  ├── "Approve this tweet about our new memory metabolism feature?"│
│  ├── "This HN thread about agent frameworks — should I comment?"  │
│  └── "New contributor submitted a PR — here's my review, LGTM?"   │
└──────────────────────────────────────────────────────────────────┘
```

#### Promotion Strategy: Content-Driven, Not Spam

The strategy is **demonstrate, don't advertise**:

| Channel | Strategy | Nous's Role | Human Approval Needed |
|---------|----------|-------------|----------------------|
| **GitHub** | World-class issue triage and contributor experience | Auto-label, auto-respond to questions, draft PR reviews | PR merges, architecture decisions |
| **Technical Blog** | Deep-dive posts on each architectural concept | Draft posts when features ship (e.g., "How Nous implements Memory Metabolism") | Review and publish |
| **Twitter/X** | Share insights from building Nous, not marketing fluff | Draft threads from development log, respond to AI/agent conversations | Approve before posting |
| **Hacker News / Reddit** | Participate in agent framework discussions with substance | Monitor discussions, draft context-aware responses showing Nous's approach | Approve before posting |
| **Discord / Community** | Fast, helpful responses to every question | Answer technical questions, link to relevant docs, onboard new users | Escalate complex questions |
| **YouTube / Demos** | "Watch Nous build X" live demos | Prepare demo scripts, narrate actions during live coding | Set up and run the demo |

**Key principle: every interaction should provide value first.** Nous doesn't say "try our framework!" — it says "here's how we solved the problem you're describing, with a link to the code."

#### Resources for Promotion Nous

| Resource | Specification | Monthly Cost | Purpose |
|----------|--------------|-------------|---------|
| **LLM API (heavy)** | Anthropic Claude API — Opus for content drafting, Sonnet for routine, Haiku for attention | $500-800 | 24/7 operation: sensing, triaging, drafting, responding |
| **Social APIs** | Twitter/X API (Basic tier) | $100 | Post tweets, monitor mentions |
| **Server** | Small VPS or always-on Mac Mini | $20-50 | Nous Zero runs 24/7 (can't rely on laptop being open) |
| **Cloudflare** | Same as MVP + higher tier if needed | $5-20 | Relay + pool traffic from early users |
| **Monitoring** | Uptime + error alerting (free tier: Grafana Cloud, Sentry) | $0 | Know when Nous Zero is down |

**Phase 1 Total: ~$800-1200/month**

#### What You Provide to Nous Zero

Your Nous needs these **capabilities and access**:

```yaml
# Nous Zero capability config
capabilities:
  github:
    repos: ["nous-framework/nous"]       # Full access to the project repo
    actions: [read_issues, write_comments, read_prs, write_reviews, manage_labels]
    # NOT: merge PRs, push to main — those stay human-only

  social:
    twitter:
      actions: [read_mentions, draft_tweets]
      # Posting requires human approval (never auto-post in Phase 1)
    hackernews:
      actions: [read_threads, draft_comments]
      # Posting requires human approval

  community:
    discord:
      channels: ["#general", "#help", "#development"]
      actions: [read_messages, send_messages]
      # Auto-respond in #help, human-approve in #general

  content:
    actions: [draft_blog_post, draft_changelog]
    # Publishing requires human approval

  self:
    actions: [read_own_codebase, run_own_tests]
    # Nous Zero can read and test the Nous codebase itself
```

---

### Phase 2: Community Building — From Users to Co-Builders

**Goal:** Build a contributor community where people first use Nous, then improve Nous, and eventually their own Nous instances help build Nous.

#### The Three-Stage Contributor Journey

```
Stage A                    Stage B                      Stage C
USERS ────────────────────► CONTRIBUTORS ──────────────► NOUS-ASSISTED CONTRIBUTORS
                                                          (their Nous helps build Nous)

"I installed Nous          "I filed a bug,              "My Nous identified a performance
 and it works."             submitted a fix."            issue, drafted a PR, and submitted
                                                          it for review by another Nous."
```

#### Stage A: Users (Month 1-3)

Make the first experience frictionless:

```bash
# One command to install
$ curl -fsSL https://nous.dev/install | sh

# One command to start
$ nous "Help me understand this codebase"

# Nous immediately starts working — no config needed
# Default permissions: explains everything, asks permission for non-default actions
```

**Community infrastructure:**
- GitHub Discussions (async Q&A — Nous Zero monitors and responds)
- Discord (real-time help — Nous Zero auto-responds in #help)
- Documentation site (generated from architecture doc + API docs)
- `nous --feedback` command (one-click feedback reporting)

**Metrics Nous Zero tracks:**
- Installs per week
- Completion rate of first task (did they get to a result?)
- Drop-off points (where do users abandon?)
- Common error messages → auto-filed issues

#### Stage B: Contributors (Month 3-6)

Convert users to contributors by **making contributing easy and rewarding**:

```bash
# Nous helps you contribute to Nous
$ nous contribute
  "I see 3 good-first-issues that match your expertise (TypeScript + CLI):
   #42: Add --verbose flag to task output
   #67: Improve error message for missing API key
   #91: Add SQLite WAL mode configuration

   Want me to set up a dev environment and start on one?"
```

**Nous Zero's role in contributor experience:**

| Activity | Nous Zero Does | Human (Joey) Does |
|----------|---------------|-------------------|
| Issue triage | Auto-label, assess complexity, suggest assignee | Review controversial labels |
| First-timer PRs | Detailed code review, suggest improvements, run tests | Final merge approval |
| Documentation | Auto-generate API docs from code, flag stale docs | Review architecture docs |
| Release notes | Draft from commit history + PR descriptions | Review and publish |
| Contributor recognition | Track contributions, draft thank-you messages | Send them |

**Community Nous instances for specific roles:**

```
┌─────────────────────────────────────────────────────┐
│  Community Nous Instances (run by project)            │
│                                                       │
│  ┌───────────────┐  ┌───────────────┐               │
│  │ Triage Nous    │  │ Docs Nous      │              │
│  │ (auto-label,   │  │ (keep docs in  │              │
│  │  assess,       │  │  sync with     │              │
│  │  respond)      │  │  code changes) │              │
│  └───────────────┘  └───────────────┘               │
│                                                       │
│  ┌───────────────┐  ┌───────────────┐               │
│  │ Review Nous    │  │ Onboard Nous   │              │
│  │ (first-pass    │  │ (help new      │              │
│  │  code review,  │  │  contributors  │              │
│  │  style check)  │  │  set up env)   │              │
│  └───────────────┘  └───────────────┘               │
│                                                       │
│  All community Nous share the same Relay Network      │
│  and contribute to the Shared Procedural Pool         │
└─────────────────────────────────────────────────────┘
```

#### Stage C: Nous-Assisted Contributors (Month 6+)

This is the inflection point: **contributors' own Nous instances participate in building Nous.**

```
Contributor Alice has an evolved Nous (with relevant skills) that:
  1. Monitors the Nous repo for issues matching Alice's expertise
  2. Proposes: "Issue #142 looks like something we can fix — similar to
     that React Hook refactor we did last week"
  3. Alice: "Go for it"
  4. Alice's Nous:
     - Reads the issue and related code
     - Drafts a fix based on its procedural memory
     - Runs local tests
     - Submits PR with detailed description
     - Alice reviews and approves
  5. Review Nous (project-side) does first-pass review
  6. Joey (human) does final merge

The PR was written by Alice's Nous, reviewed by the project's Nous,
and merged by a human. This is the beginning of Nous building Nous.
```

**The meta-pattern:** As more Nous instances work on the Nous codebase, the Shared Procedural Pool accumulates "how to contribute to Nous" patterns. New contributors' Nous instances pull these patterns, making them effective contributors faster. **The framework improves itself by being used to improve itself.**

#### Resources for Community Building

| Resource | Phase A (Month 1-3) | Phase B (Month 3-6) | Phase C (Month 6+) |
|----------|---------------------|---------------------|---------------------|
| **LLM API** | $500-800 (Nous Zero) | $1,000-2,000 (+ community Nous instances) | $2,000-5,000 (scaling with contributors) |
| **Cloudflare** | $5-20 | $20-50 (more relay traffic) | $50-200 |
| **Community platforms** | Discord (free), GitHub (free) | Same + documentation site ($20/mo hosting) | Same |
| **Dedicated server** | 1x small VPS ($20-50) | 2-3x VPS for community Nous ($60-150) | Scale as needed |
| **Human time (Joey)** | 10-15 hrs/week (review, respond, decide) | 5-10 hrs/week (Nous handles more) | 3-5 hrs/week (mostly strategic decisions) |
| **Monthly total** | ~$800-1,200 | ~$1,500-2,500 | ~$3,000-6,000 |

---

### Resource Scaling Summary: From MVP to Maturity

```
                     Monthly Cost
        $10K ┤
             │                                          ╭──── Phase 4: Self-sustaining
             │                                    ╭─────╯     Community funds relay costs.
        $5K  ┤                              ╭─────╯           Nous instances contribute compute.
             │                         ╭────╯                 Revenue from enterprise features.
             │                    ╭────╯
        $2K  ┤              ╭─────╯  Phase 2-3: Community Growth
             │         ╭────╯        LLM API scales with community Nous.
             │    ╭────╯             Relay traffic grows.
        $500 ┤────╯  Phase 1: Dogfooding
             │       Nous Zero + relay.
        $300 ┤── Phase 0: MVP
             │   Development + LLM API.
             └────┬────────┬────────┬────────┬────────┬──────
                  M1       M3       M6       M12      M18
```

| Phase | Timeline | Monthly Budget | Primary Cost Driver | Key Milestone |
|-------|----------|---------------|--------------------|----|
| **Phase 0: MVP** | Month 1-2 | $300-500 | LLM API for dev/testing | First Nous instance completes a real task |
| **Phase 1: Dogfooding** | Month 2-4 | $800-1,200 | LLM API (24/7 Nous Zero) + VPS | Nous Zero handles its first GitHub issue autonomously |
| **Phase 2: Early Community** | Month 4-8 | $1,500-2,500 | LLM API (community Nous instances) | 10 contributors, first Nous-written PR merged |
| **Phase 3: Growth** | Month 8-14 | $3,000-6,000 | LLM API + relay scaling | 100+ Nous instances on the network, procedural pool >500 patterns |
| **Phase 4: Self-Sustaining** | Month 14+ | Variable | Community-supported | Community funds infrastructure. Enterprise features generate revenue. Nous instances contribute relay capacity. |

#### Phase 4 Self-Sustainability Model

```
Revenue Sources (when the network is large enough):
  ├── Enterprise features (org policies, private relay, SLA)
  ├── Hosted Relay service (managed relay for teams that don't want to self-host)
  ├── Priority access to Shared Pool (faster consultation, more patterns)
  └── Professional support (deployment, customization)

Cost Offsets:
  ├── Community-contributed relay capacity (Phase 3+ Nous instances can relay)
  ├── Shared compute for community Nous instances (sponsors, cloud credits)
  └── Open source contributions reduce development cost
```

---

### The Bootstrap Paradox: How Nous Builds Nous

There's a beautiful recursive structure in this plan:

```
1. Human builds MVP Nous (Phase 0)
         │
         ▼
2. MVP Nous helps human promote Nous (Phase 1)
         │
         ▼
3. Users become contributors, their Nous instances help build Nous (Phase 2)
         │
         ▼
4. Contributors' Nous instances train each other via Shared Pool (Phase 3)
         │
         ▼
5. The Nous network collectively evolves Nous faster than any team could (Phase 4)
         │
         ▼
6. Goto 3 (but with more Nous instances, better patterns, and less human effort)
```

This is the same pattern as:
- **GCC**: C compiler written in C, compiled by itself
- **Linux**: OS developed on Linux, using Linux tools
- **Git**: Version control system whose source is managed by Git

Nous is the first **AI agent framework designed to be built by its own agents.** The architecture (Evolution Engine, Shared Pool, Communication Network) isn't just a feature — it's the mechanism by which the framework improves itself.

The human's role converges toward: **set the vision, make the irreversible decisions, and let Nous handle the rest.**

---

## Implementation Plan: Sprint-by-Sprint

### What's Already Built (Sprints 1-4: DONE)

Sprints 1-4 are complete. The following infrastructure is in place:

```
✅ Sprint 1: Core + Persistence
   Types, state machines, SQLite stores, event store, task store

✅ Sprint 2: Runtime (ReAct)
   3 LLM providers (Anthropic, OpenAI-compat, Claude CLI), ReAct loop,
   5 primitive tools, heartbeat, context compaction

✅ Sprint 3: Orchestration
   Intent parsing, Task DAG planning, scheduler, agent router, DAG utils

✅ Sprint 4: CLI + Interface
   CLI app (5 commands), process supervisor, UI components, agent defs,
   binary entry point. `nous "Read README.md and summarize"` works.
```

### Remaining Sprints (Bottom-Up, Dependency-Aware)

```
Sprint 5 ──► Sprint 6 ──► Sprint 7 ──► Sprint 8 ──► Sprint 9 ──► Sprint 10
 Daemon +     Memory       Context +     Perception   Evolution    Relay +
 Dialogue     RAG          Tools         Pipeline     Engine       Network

 Daemon proc  Embeddings   Context       FS Sensor    Experience   Relay client
 IPC socket   sqlite-vec   Assembly      Git Sensor   Collection   CF Workers
 CLI client   RAG pipeline Tier 2 tools  Perception   Skill Cryst. E2E encrypt
 Message      Graph rels   Permission    Log          Gap Detect.  Discovery
 outbox       Metabolism   System        Attention    Self-Mutate  Pattern pool
 Thread track (ep→sem→proc)             Filter       (tools only)
 Conflict                               Ambient
 detect (L1)                            Intent
 Multi-turn

 ── Foundation ──  ── Intelligence ──  ── Awareness ──  ── Growth ──  ── Collective ──
```

**Key insight:** Sprint 5 (Daemon + Dialogue) must come first — it restructures HOW Nous runs (persistent process vs one-shot CLI), which every subsequent sprint depends on. Sprint 6 (Memory RAG) is the intelligence foundation that perception, evolution, and network all build upon.

### Sprint Exit Criteria

| Sprint | Exit Criteria |
|--------|--------------|
| 5 | `nous daemon start` launches background process. `nous "Read README"` submits intent via Unix socket, receives result via push. Closing terminal does NOT stop execution. `nous status` shows active intents. Message outbox delivers pending messages on reconnect. Multi-turn: `nous` opens REPL that maintains conversation context. Conflict detection: submitting two intents that touch the same file triggers a sequencing notice. |
| 6 | Memory stores embeddings via sqlite-vec. RAG retrieval returns semantically relevant results across all tiers. Episodic→Semantic metabolism works for 3+ similar episodes. Second run remembers and retrieves facts from first run via vector search. |
| 7 | Agent receives rich context (CWD, project type, git state) in system prompt. 10+ Tier 2 tools available. Permission System enforces directory-scoped rules. `nous permissions` shows/modifies rules. |
| 8 | FS Sensor detects file changes. Git Sensor detects branch switches. Attention Filter evaluates signals. Ambient Intent triggers autonomous action (e.g., "test file modified but tests not run → suggest running tests"). |
| 9 | Every task execution produces an ExecutionTrace. Skill crystallization works (3+ validated procedural memories → Skill). Gap Detection identifies missing tools. Evolution Engine can create a new Tier 3 tool from a gap. |
| 10 | Two Nous instances discover each other via Cloudflare relay and exchange an anonymized skill pattern. `nous network status` shows connectivity. |

---

## Collaboration Model: Who Does What, When

### During MVP Build (Sprints 5-10): Human + LLM

```
Human (Joey)                          LLM (Claude Code)
  │                                     │
  ├── All architecture decisions        ├── Writes code per direction
  ├── Reviews all code                  ├── Runs tests
  ├── Every commit is human-authored    ├── Suggests improvements
  └── Deploys relay                     └── No autonomous action
```

### Post-MVP: Human + Nous Zero (with evolved skills)

| Task Type | Who | How |
|-----------|-----|-----|
| Architecture changes | Human only | Human designs, human implements |
| New features | Human designs, Nous implements | Nous drafts PR, human reviews + merges |
| Bug fixes (clear repro) | Nous autonomous, human reviews | Nous files fix, human approves |
| Doc updates | Nous autonomous | Nous detects stale docs, auto-updates |
| Issue triage | Nous autonomous, human reviews labels | Nous labels + responds, human reviews |
| Dependency updates | Nous autonomous | Nous bumps deps, runs tests, human batch-approves |
| Community Q&A | Nous autonomous (Discord #help) | Nous answers, escalates complex questions |

### Multi-Human + Multi-Nous: Task Allocation Protocol

```
New task arrives
      │
      ▼
Task Classifier (complexity, risk, domain, reversibility)
      │
      ├── Tier 1 (Low risk, reversible): Nous-Autonomous
      │   Bug fixes, doc updates, dep bumps, tests
      │
      ├── Tier 2 (Medium risk): Nous + Human Review
      │   Features, refactors, new tools, integrations
      │
      └── Tier 3 (High risk, irreversible): Human-Led
          Architecture, security, breaking changes

Cross-Nous collaboration on a single task:
  1. Contributor's Nous drafts PR
  2. Project's Review Nous does first-pass review
  3. Domain expert Nous validates (if applicable)
  4. Human maintainer makes final merge decision
```
