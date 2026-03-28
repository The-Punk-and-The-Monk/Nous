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
| **Agent** | Runtime | A persistent identity with memory, capabilities, and a behavioral profile |
| **Tool** | Runtime | An atomic capability (shell exec, file read, HTTP call, etc.) |
| **Event** | Persistence | An immutable record of what happened — the system's source of truth |
| **Memory** | Runtime | Layered persistent state (5 tiers, see Memory System below) |
| **Sensor** | Infrastructure | A continuous input source that passively observes the environment (file watcher, calendar, screen, mic, etc.) |
| **Attention Filter** | Orchestration | Evaluates raw perception signals and decides what is worth processing — the "is this interesting?" gate |
| **Ambient Intent** | Orchestration | A goal inferred from environment signals, not explicitly stated by a human — system-initiated action |
| **TrustProfile** | Runtime | Bidirectional, earned trust score that governs capability scope and maturity stage |
| **GrowthCheckpoint** | Runtime | An explicit proposal for maturity stage transition — requires evidence and user consent |
| **CommunicationPolicy** | Infrastructure | User-controlled rules governing all inter-Nous communication — what to share, whom to consult, what to auto-approve |
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
| Growth maturity model (trust-based stages) | No | No | No | Yes |
| Memory metabolism (experience → skill) | No | No | No | Yes |
| Collective intelligence (cross-instance) | No | No | No | Yes |
| Inter-instance communication protocol | No | No | No | Yes (hybrid relay + P2P) |

---

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  L0 — Intent Plane                                          │
│  Human Intent · Ambient Intent · Constraints · Human        │
│  Decision Queue (only truly blocking decisions reach human) │
├─────────────────────────────────────────────────────────────┤
│  L1 — Orchestration Plane                                   │
│  Intent Planner · Task Scheduler · Agent Router ·           │
│  Attention Filter                                           │
├─────────────────────────────────────────────────────────────┤
│  L2 — Runtime Plane                                         │
│  Agent Runtime (ReAct loop) · Tool Sandbox · Memory Manager │
│  Growth Engine (trust, capability graduation, metabolism)    │
├─────────────────────────────────────────────────────────────┤
│  L3 — Persistence Plane                                     │
│  Event Store · Task Queue DB · Memory Store ·               │
│  Perception Log                                             │
├─────────────────────────────────────────────────────────────┤
│  L4 — Infrastructure Plane                                  │
│  Channel Adapters · Sensors · Process Supervisor ·          │
│  Observability · Security · Nous Relay Client               │
└─────────────────────────────────────────────────────────────┘
```

**Three data flow paths exist in parallel:**
- **Request path** (top-down): Human Intent → Orchestration → Runtime → Persistence
- **Perception path** (bottom-up): Sensors → Perception Log → Attention Filter → Ambient Intent
- **Network path** (lateral): Nous Relay Client ↔ Relay Network ↔ Other Nous Instances (see Inter-Nous Communication Architecture)

**Dependency rule:** Dependencies flow downward only. L0 depends on L1, L1 on L2, etc. No upward dependencies.

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

### L2 — Runtime Plane (`packages/runtime`)
- **Agent Runtime**: ReAct reasoning loop (Think → Act → Observe → repeat)
- **Tool Sandbox**: Isolated execution per tool, timeout enforcement, capability-scoped
- **Memory Manager**: Unified interface to 5-tier memory system (includes memory metabolism — transforming episodic → semantic → procedural)
- **Growth Engine**: Manages TrustProfile, capability graduation, and maturity stage transitions (see Growth Model below)

### L3 — Persistence Plane (`packages/persistence`)
- **Event Store**: Append-only log of all state transitions (event sourcing)
- **Task Queue DB**: SQLite-backed task state machine persistence
- **Memory Store**: Vector + full-text + graph index for semantic memory
- **Perception Log**: Append-only buffer of raw sensor signals, time-indexed. High-volume, low-retention — older entries are compacted or pruned after Attention Filter has evaluated them

### L4 — Infrastructure Plane (`packages/infra`)
- **Channel Adapters**: Plugin system for I/O channels (CLI, HTTP, WebSocket, etc.)
- **Sensors**: Continuous environment observers — each Sensor is a long-lived process that watches one input source and emits signals to L3 Perception Log. Examples: file system watcher, calendar poller, email listener, clipboard monitor, screen capture, microphone stream. Sensors are stateless and restartable; they only write, never read.
- **Process Supervisor**: Agent heartbeat monitoring, crash detection, restart (also supervises Sensors)
- **Observability**: Metrics, tracing, structured logging — all derived from Event Store
- **Security**: Capability token issuance and enforcement
- **Nous Relay Client**: Handles Relay Network registration, discovery queries, P2P connection establishment, and E2E encryption. Governed by the user's `CommunicationPolicy`. Only active at maturity Stage 2+ (see Inter-Nous Communication Architecture below)

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

**Memory Metabolism:** Memory is not a static store — it is actively transformed. Episodic memories (individual events) are digested into semantic knowledge (general facts), which are compiled into procedural skills (reusable execution paths). Stale memories decay unless reinforced by usage. This process is the engine behind the Growth Model (see below).

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

## Comparative Analysis: Why Existing Frameworks Fall Short

| Dimension | OpenClaw | LangChain | AutoGPT | Nous |
|-----------|----------|-----------|---------|------|
| Task lifecycle | File locks (brittle) | None | Basic loop | State machine + heartbeat + auto-retry |
| Failure recovery | Manual | None | Retry (no backoff) | Tiered auto-recovery → human escalation |
| Intent layer | None (tasks are intents) | None | None | Intent → Plan → Task (3 levels) |
| Multi-agent coordination | Subagent (no monitoring) | Chain (sequential) | Single agent | Supervisor model + liveness tracking |
| Memory | 4 tiers (no procedural) | Short-term only | File-based | 5 tiers (with Procedural Memory) |
| Security | Global permissions | None | None | Capability tokens, least-privilege |
| Observability | Log files | Callbacks | Log files | Event sourcing, full causal chain |
| Human interaction | Chat + Cron | Chat | Chat | Intent layer + minimal-interruption decision queue |
| Perception | None | None | None | Sensors + Attention Filter + Ambient Intent |
| Growth model | None | None | None | 5-stage maturity with trust scores + capability graduation |
| Memory metabolism | None | None | None | Active transformation: episodic → semantic → procedural |
| Cross-instance learning | None | None | None | Federated pattern sharing + specialist consultation |
| Inter-instance communication | None | None | None | Hybrid relay + P2P, E2E encrypted, user-controlled |

**The core difference in approach:**

- OpenClaw / LangChain / AutoGPT: Start from a **chatbot** and bolt on agent features.
- Nous: Start from an **operating system** and add intelligence.

The latter is more structurally sound. An OS-first design gets reliability, scheduling, isolation, and observability for free — they are inherent in the model, not afterthoughts.

---

## Growth Model: From Stranger to Extended Self

Most agent frameworks treat the agent-user relationship as static: configure once, run forever. This is architecturally wrong. The relationship between Nous and its user is **a living system that must grow**, not a tool that gets configured.

### How Current Frameworks Handle Growth (They Don't)

| Framework | Memory Model | Growth Strategy | Trust Model | Cross-Instance Learning |
|-----------|-------------|----------------|-------------|------------------------|
| **ChatGPT Memory** | Flat fact list ("user likes Python") | Accumulate facts forever | None — same permissions always | None |
| **Claude Code** | File-based memory (CLAUDE.md + memory dir) | User manually curates | Static permission modes | None |
| **LangChain** | Pluggable (buffer, summary, vector) | None — session-scoped by default | None | None |
| **AutoGPT** | File-based workspace | None | None | None |
| **OpenClaw** | 4-tier memory (no procedural) | Passive accumulation | Global permissions | None |

**The universal failure:** Every framework treats memory as a **database** — you put things in, you get things out. None models memory as a **metabolism** — raw experience being digested, transformed, and integrated into increasingly sophisticated understanding.

The difference is the difference between a notebook and a brain.

### The Five Maturity Stages

Nous models its relationship with each user as a maturity progression. Each stage has explicit entry criteria, capability scope, and behavioral characteristics.

```
Stage 0        Stage 1          Stage 2         Stage 3            Stage 4
STRANGER ────► ACQUAINTANCE ──► COLLEAGUE ────► TRUSTED PARTNER ─► EXTENDED SELF
  │               │                │                │                  │
  │  First        │  Knows basic   │  Understands   │  Makes judgment  │  Handles 80%+
  │  contact.     │  facts. Less   │  patterns.     │  calls within    │  autonomously.
  │  Max caution. │  confirmation  │  Proactive     │  boundaries.     │  Surfaces only
  │  Zero context.│  for routine.  │  suggestions.  │  Ambient aware.  │  the novel.
  │               │                │                │                  │
  ▼               ▼                ▼                ▼                  ▼
  Trust: 0       Trust: 0.2       Trust: 0.5      Trust: 0.8         Trust: 0.95
  Confirm: ALL   Confirm: MOST    Confirm: SOME   Confirm: RARE      Confirm: NOVEL ONLY
```

#### Stage 0 — Stranger

The first conversation. Nous knows nothing.

| Aspect | Behavior |
|--------|----------|
| **Capabilities** | Minimal defaults only. No file writes, no shell exec, no network. |
| **Confirmation** | Every non-trivial action requires explicit approval. |
| **Memory** | Working memory only (context window). Nothing persists yet. |
| **Perception** | No sensors active. Pure request-response. |
| **Goal** | Learn who this human is — role, project context, communication style. |
| **Transition to Stage 1** | After N successful interactions where Nous correctly understood intent, OR user explicitly grants initial trust (e.g., shares a CLAUDE.md / project brief). |

#### Stage 1 — Acquaintance

Nous knows the basics: who you are, what you're working on, how you like to communicate.

| Aspect | Behavior |
|--------|----------|
| **Capabilities** | Basic read/write within project scope. Shell exec with allowlist. |
| **Confirmation** | Routine tasks (file edits, searches) proceed without asking. Novel task types still confirm. |
| **Memory** | Episodic + Semantic tiers active. Begins building user profile. |
| **Perception** | File system watcher active for current project. |
| **Goal** | Build procedural memory — learn which execution paths work for this user's codebase. |
| **Transition to Stage 2** | Procedural memory reaches critical mass (M successful task patterns stored). User correction rate drops below threshold. |

#### Stage 2 — Colleague

Nous understands not just what you ask, but the patterns behind your requests.

| Aspect | Behavior |
|--------|----------|
| **Capabilities** | Broader tool access. Can make multi-file changes. Can run tests autonomously. |
| **Confirmation** | Only for irreversible or cross-boundary actions. Routine work is autonomous. |
| **Memory** | All 5 tiers active. Procedural memory drives task execution. Prospective memory tracks commitments. |
| **Perception** | Calendar + email sensors active. Begins ambient awareness. |
| **Goal** | Develop predictive capability — anticipate needs before they're voiced. |
| **Transition to Stage 3** | Proactive suggestions are accepted >70% of the time. User delegates multi-step tasks without specifying method. Nous has demonstrated reliable judgment on ambiguous tasks. |

#### Stage 3 — Trusted Partner

Nous makes judgment calls. You review outcomes, not processes.

| Aspect | Behavior |
|--------|----------|
| **Capabilities** | Nearly full capability set. Can create PRs, deploy to staging, communicate with external services. |
| **Confirmation** | Only for genuinely novel situations or irreversible production changes. |
| **Memory** | Memory metabolism fully active — episodic experiences are being distilled into semantic knowledge and procedural skills. |
| **Perception** | Full sensor suite active. Ambient awareness of work context, schedule, and communication. |
| **Goal** | Minimize human cognitive burden to pure decision-making. |
| **Transition to Stage 4** | User consistently delegates entire workflows. Nous's autonomous decisions align with user's values and judgment >95% of the time. |

#### Stage 4 — Extended Self

Nous is an extension of you. Like a trusted chief of staff who has worked with you for years.

| Aspect | Behavior |
|--------|----------|
| **Capabilities** | Full capability set, dynamically scoped per task. |
| **Confirmation** | Only for situations Nous has never encountered AND that carry significant consequences. |
| **Memory** | Self-maintaining. Actively prunes stale knowledge. Generates meta-insights from accumulated experience. |
| **Perception** | Fully ambient. Knows what you're working on without being told. Anticipates blockers before you hit them. |
| **Goal** | You provide goals and values. Nous handles everything else. |

### Core Growth Mechanisms

Growth doesn't happen by accumulating data. It happens through four active mechanisms:

#### 1. Trust Score — Bidirectional, Earned, Decayable

Trust is not a config setting. It is a **computed metric** that changes with every interaction.

```
                    ┌─────────────────────────┐
                    │      Trust Profile       │
                    │                          │
  User → Nous:     │  reliability: 0.82       │  ← Did Nous do what it said it would?
                    │  judgment: 0.61          │  ← Were Nous's autonomous decisions good?
                    │  proactivity: 0.45       │  ← Were Nous's suggestions welcome?
                    │                          │
  Nous → Self:     │  confidence: 0.73        │  ← How often is Nous right about its own certainty?
                    │  calibration: 0.88       │  ← When Nous says 80% sure, is it right 80% of the time?
                    │                          │
                    │  maturityStage: 2        │  ← Derived from above scores
                    │  lastTransition: <date>  │
                    └─────────────────────────┘
```

**Trust increases through:**
- Successful task completion without correction
- Proactive suggestions that are accepted
- Accurate self-assessment ("I'm not sure about this" → user confirms it was indeed ambiguous)

**Trust decreases through:**
- Tasks that require correction or rollback
- Proactive suggestions that are rejected
- Confident assertions that turn out wrong (overconfidence penalty is harsh)

**Trust decays over time** if not reinforced. A Nous that hasn't interacted with its user for weeks should not retain Stage 3 trust — the user's codebase and priorities may have changed.

#### 2. Capability Graduation — Dynamic Authorization

Capabilities are not static. They expand with demonstrated reliability in specific domains.

```
Initial state:
  "fs.write": false

After 10 successful file reads with no issues:
  → Nous proposes: "I've read 10 files accurately. Can I write files within src/?"
  → User approves (or Nous auto-graduates if trust threshold met)

  "fs.write": { paths: ["src/**"] }

After 20 successful writes with <5% correction rate:
  → Graduation: write access expands to full project

  "fs.write": { paths: ["**"] }
```

This mirrors how you'd onboard a new team member: start with read access, earn write access, eventually get deploy access.

#### 3. Memory Metabolism — From Experience to Wisdom

Raw experience is not knowledge. Knowledge is not skill. The memory system must actively **transform** lower-tier memories into higher-tier ones.

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
         │  (after N similar episodes)          │  (after M similar facts)       │
         └──────────────►──────────────────────►┘──────────────►────────────────►┘

                              METABOLISM DIRECTION ──────────────────────►
```

**Metabolism rules:**
- **Episodic → Semantic**: When 3+ episodes share the same pattern, extract the general fact. Mark episodes as "digested" (retain for audit but deprioritize in retrieval).
- **Semantic → Procedural**: When a cluster of semantic facts describes a repeatable workflow, compile into a procedure. Test the procedure on the next matching task.
- **Decay**: Episodic memories older than 30 days that haven't been referenced or metabolized are candidates for pruning. Semantic and procedural memories decay only if contradicted by newer evidence.
- **Reinforcement**: Every time a memory is successfully used (retrieved and led to good outcome), its retention score increases.

#### 4. Growth Checkpoints — Explicit Negotiation

Nous does not silently expand its scope. At each maturity transition, it explicitly proposes the change:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GROWTH CHECKPOINT                                                       │
│                                                                          │
│  Current stage: 1 (Acquaintance)                                         │
│  Proposed stage: 2 (Colleague)                                           │
│                                                                          │
│  Evidence:                                                               │
│  - 47 tasks completed, 2 required correction (95.7% accuracy)            │
│  - 12 procedural memories compiled and validated                         │
│  - User correction rate dropped from 23% → 4% over last 30 days         │
│                                                                          │
│  What changes:                                                           │
│  + Can make multi-file changes without per-file confirmation             │
│  + Can run test suites autonomously                                      │
│  + Calendar sensor activates (ambient schedule awareness)                │
│  + Will begin making proactive suggestions                               │
│                                                                          │
│  [Approve]  [Defer]  [Customize — choose which capabilities to grant]    │
└─────────────────────────────────────────────────────────────────────────┘
```

The user can always override: skip stages, revert to a lower stage, or customize which capabilities to grant at each level.

#### 5. Feedback Loop — Every Signal Counts

Every interaction is a learning signal, not just explicit corrections:

| Signal | What Nous Learns | Weight |
|--------|-----------------|--------|
| User accepts result without edit | Execution path was correct | +1 (weak positive) |
| User edits result | Execution was close but imperfect — diff is the lesson | +2 (informative) |
| User rejects result entirely | Approach was wrong — analyze what went wrong | +3 (strong corrective) |
| User says "perfect" / "exactly" | Non-obvious approach validated — remember this judgment call | +4 (strong positive) |
| User undoes Nous's action | Trust penalty — overstepped or misjudged | -3 (trust damaging) |
| User ignores Nous's proactive suggestion | Suggestion wasn't valuable — recalibrate proactivity | -1 (weak corrective) |
| User acts on proactive suggestion | Proactivity was valuable — increase in this domain | +3 (proactivity positive) |

### Growth Data Models

```typescript
type MaturityStage = 0 | 1 | 2 | 3 | 4;

interface TrustProfile {
  userId: string;
  nousInstanceId: string;

  // User → Nous trust (computed from interaction history)
  reliability: number;        // 0-1: Does Nous do what it says?
  judgment: number;           // 0-1: Are autonomous decisions good?
  proactivity: number;        // 0-1: Are suggestions welcome?

  // Nous → Self trust (metacognitive calibration)
  confidence: number;         // 0-1: How often is Nous right?
  calibration: number;        // 0-1: Alignment between stated and actual certainty

  // Derived
  maturityStage: MaturityStage;
  stageTransitions: StageTransition[];  // History of all transitions

  // Decay
  lastInteraction: string;    // ISO timestamp
  decayRate: number;          // Trust points lost per day of inactivity
}

interface StageTransition {
  from: MaturityStage;
  to: MaturityStage;
  timestamp: string;
  trigger: "auto" | "human_approved" | "human_initiated" | "decay";
  evidence: {
    tasksCompleted: number;
    correctionRate: number;
    proceduralMemoriesCompiled: number;
    proactiveSuggestionAcceptRate: number;
  };
}

interface GrowthCheckpoint {
  id: string;
  proposedStage: MaturityStage;
  evidence: StageTransition["evidence"];
  capabilityChanges: {
    added: Partial<CapabilitySet>;
    removed: Partial<CapabilitySet>;
  };
  sensorChanges: {
    activate: string[];     // Sensor types to enable
    deactivate: string[];   // Sensor types to disable
  };
  status: "proposed" | "approved" | "deferred" | "customized";
  userResponse?: {
    decision: "approve" | "defer" | "customize";
    customizations?: Partial<CapabilitySet>;
    reason?: string;
  };
}

interface MemoryMetabolismRule {
  source: "episodic" | "semantic";
  target: "semantic" | "procedural";
  triggerCondition: {
    minSimilarEntries: number;    // How many similar memories before extraction
    minConfidence: number;         // Pattern confidence threshold
    maxAge?: number;               // Only metabolize entries older than N days
  };
  extractionStrategy: "pattern_match" | "llm_synthesis" | "hybrid";
  validation: {
    testOnNextMatch: boolean;      // Validate procedure on next matching task
    requireHumanReview: boolean;   // For high-impact procedures
  };
}
```

---

## Collective Intelligence: The Nous Network

A single Nous instance, no matter how mature, is limited by one user's experience. The true power emerges when Nous instances learn from each other — while preserving each user's privacy.

### Why Current Frameworks Can't Do This

No existing agent framework has inter-instance learning. Each instance is an island. This means:
- Every Nous must rediscover "how to deploy a Next.js app" from scratch
- Domain expertise (legal, medical, finance) must be rebuilt per user
- Common failure patterns are never shared — the same mistakes are made independently, forever

This is equivalent to a company where no employee can ever talk to another. Each person must independently learn everything. It is spectacularly inefficient.

### Four Phases of Collective Intelligence

```
Phase 1              Phase 2                Phase 3                Phase 4
ISOLATED ──────────► PATTERN SHARING ──────► SPECIALIZATION ──────► EMERGENCE

Nous A ○             Nous A ○───────┐       Nous A ○──Expert:Web──┐  ┌──────────────┐
                                    │                              │  │              │
Nous B ○             Nous B ○───────┼──CP   Nous B ○──Expert:ML───┼──│  Collective   │
                                    │                              │  │  Intelligence │
Nous C ○             Nous C ○───────┘       Nous C ○──Expert:Ops──┘  │              │
                                                                     └──────────────┘
No communication.    Share anonymized       Develop domain          Network-level
Each learns alone.   procedural patterns.   specializations.        knowledge emerges
                     (CP = Common Pool)     Consult each other.     that no single
                                                                     instance holds.
```

#### Phase 1 — Isolated Instances (Current State)

Each Nous learns only from its own user. No sharing. This is where we start — and it's already valuable, because single-instance growth (the maturity model above) is a massive improvement over the status quo.

#### Phase 2 — Anonymized Pattern Sharing

The first step toward collective intelligence: **procedural memory federation**.

When a Nous compiles a procedural memory (e.g., "how to set up ESLint in a monorepo"), it can contribute an **anonymized, generalized version** to the Common Procedural Pool.

```
Local procedural memory (Nous A):
  "In Joey's project /Users/joey/Projects/Nous, when adding ESLint:
   1. Install @eslint/config in workspace root
   2. Add .eslintrc.cjs with Joey's preferred rules (strict + no-any)
   3. Add lint script to root package.json
   4. Run eslint --fix on existing files"

     │
     │  anonymize + generalize
     ▼

Shared procedural pattern:
  "When adding ESLint to a TypeScript monorepo:
   1. Install @eslint/config in workspace root
   2. Create config file with project-appropriate rules
   3. Add lint script to root package.json
   4. Run initial lint pass"
   confidence: 0.78 (validated by 1 instance)

     │
     │  another Nous validates this pattern independently
     ▼

  confidence: 0.91 (validated by 3 instances)
```

**Privacy rules:**
- User names, file paths, project names, secrets are **never** shared
- Only structural patterns are extracted
- Each user can opt out entirely
- Shared patterns are versioned and auditable

#### Phase 3 — Federated Specialization

Over time, Nous instances develop **domain expertise** based on their users' work:
- A Nous working with a data scientist becomes expert in ML pipelines
- A Nous working with a DevOps engineer becomes expert in infrastructure
- A Nous working with a lawyer becomes expert in legal document patterns

These specialists can be **consulted** by other Nous instances:

```
Nous A (user is a frontend dev, building a dashboard):
  Task: "Add real-time data visualization"
  │
  ├── Local procedural memory: has React/D3 patterns ✓
  ├── Needs: streaming data architecture
  │
  └── Consults Nous Specialist Registry:
        "Who has expertise in real-time data pipelines?"
        → Nous B (DevOps expert) responds with anonymized architecture pattern
        → Nous A applies pattern to user's specific context
```

**The Specialist Registry:**

```typescript
interface NousSpecialistProfile {
  instanceId: string;           // Anonymous identifier
  domains: DomainExpertise[];   // What this Nous is good at
  availablePatterns: number;    // How many shareable procedures
  consultationCount: number;    // How many times others have consulted
  avgHelpfulnessRating: number; // Were consultations useful?
}

interface DomainExpertise {
  domain: string;               // "ml.pipeline" | "devops.k8s" | "frontend.react" | ...
  depth: number;                // 0-1: How deep is the expertise
  breadth: number;              // 0-1: How many sub-topics covered
  lastActive: string;           // When was this domain last exercised
  proceduralCount: number;      // How many procedures in this domain
}
```

#### Phase 4 — Emergent Collective Intelligence

This is the long-term vision. When enough Nous instances are sharing patterns and consulting each other, **network-level knowledge emerges** that no single instance possesses.

Examples of emergent capabilities:
- **Cross-domain synthesis**: Nous A (security expert) + Nous B (ML expert) → the network understands ML security, even though no single user works in that intersection
- **Trend detection**: The network notices that 15 Nous instances are all encountering the same library bug this week → proactively warns other instances
- **Collective debugging**: When Nous C encounters an error, the network has already seen 7 variants of this error and knows the most effective fix
- **Evolving best practices**: The network converges on optimal patterns through natural selection — patterns that work get reinforced across instances, patterns that fail get deprecated

**This is not centralized training.** No single entity controls the collective. It is a **federated, privacy-preserving, bottom-up** intelligence that emerges from many individual agents sharing anonymized experience.

### Collective Intelligence Data Models

```typescript
interface SharedProceduralPattern {
  id: string;
  domain: string;
  description: string;
  steps: ProceduralStep[];        // Anonymized, generalized steps

  // Provenance
  contributorCount: number;       // How many instances contributed
  validationCount: number;        // How many instances validated
  confidence: number;             // 0-1, increases with validation

  // Lifecycle
  version: number;
  createdAt: string;
  lastValidated: string;
  deprecatedAt?: string;          // Set when pattern is superseded or found unreliable
  supersededBy?: string;          // Pattern ID that replaced this one
}

interface ConsultationRequest {
  requesterId: string;            // Anonymous Nous instance
  domain: string;                 // What domain expertise is needed
  taskDescription: string;        // Anonymized task description
  localContext: string;           // What the requester already knows (anonymized)
  urgency: "low" | "medium" | "high";
}

interface ConsultationResponse {
  responderId: string;
  relevantPatterns: SharedProceduralPattern[];
  additionalContext: string;      // Anonymized domain-specific advice
  confidence: number;             // How confident the responder is
  helpfulnessRating?: number;     // Set by requester after applying advice
}

interface CollectiveInsight {
  id: string;
  type: "trend" | "warning" | "best_practice" | "deprecation";
  description: string;
  evidence: {
    instanceCount: number;        // How many instances observed this
    timespan: string;             // Over what period
    confidence: number;
  };
  actionRecommendation: string;   // What should individual instances do
  distributedAt: string;
  acknowledgedBy: number;         // How many instances have seen this
}
```

### The Growth Architecture in One Picture

```
                    ┌──────────────────────────────────────────┐
                    │         Nous Collective Network           │
                    │                                          │
                    │  ┌──────────┐  ┌──────────┐             │
                    │  │ Shared   │  │Specialist │             │
                    │  │Procedural│  │ Registry  │             │
                    │  │  Pool    │  │           │             │
                    │  └────┬─────┘  └─────┬────┘             │
                    │       │              │                    │
                    └───────┼──────────────┼───────────────────┘
                            │              │
              ┌─────────────┼──────────────┼─────────────┐
              │             │              │             │
       ┌──────▼──────┐ ┌───▼────────▼───┐ ┌─────▼──────┐
       │   Nous A     │ │    Nous B      │ │   Nous C    │
       │   Stage 3    │ │    Stage 2     │ │   Stage 4   │
       │              │ │                │ │              │
       │ ┌──────────┐ │ │ ┌──────────┐  │ │ ┌──────────┐│
       │ │ Growth   │ │ │ │ Growth   │  │ │ │ Growth   ││
       │ │ Engine   │ │ │ │ Engine   │  │ │ │ Engine   ││
       │ │          │ │ │ │          │  │ │ │          ││
       │ │ Trust ◄──┼─┤ │ │ Trust ◄──┼──┤ │ │ Trust ◄──┼┤
       │ │ Memory   │ │ │ │ Memory   │  │ │ │ Memory   ││
       │ │ Metabolism│ │ │ │ Metabolism│ │ │ │ Metabolism││
       │ │ Feedback │ │ │ │ Feedback │  │ │ │ Feedback ││
       │ └──────────┘ │ │ └──────────┘  │ │ └──────────┘│
       │              │ │               │ │              │
       └──────┬───────┘ └───────┬───────┘ └──────┬──────┘
              │                 │                 │
         User Alice        User Bob          User Carol
```

---

## Inter-Nous Communication Architecture

How do Nous instances talk to each other? This is a fundamental infrastructure decision that affects privacy, scalability, reliability, and user control. We reason from first principles.

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
  ├── Maturity Stage < 2?
  │   └── NO. Stranger and Acquaintance stages have no network access.
  │       (Nous must demonstrate reliability to its own user before
  │        being trusted to interact with the network.)
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

**The maturity gate is critical:** A Nous at Stage 0 or 1 has not yet proven itself to its own user. It has no business participating in a network. Network access is a Stage 2+ capability, earned through demonstrated reliability. This prevents:
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

These questions were originally open. After reasoning through the full architecture — from first principles, through the growth model, perception layer, and communication architecture — we can now make concrete decisions grounded in **current reality**: existing model capabilities, single-node v1 constraints, and limited resources.

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
| Memory Store (Semantic) | SQLite FTS5 for full-text search | Qdrant or ChromaDB for vector search |
| Memory Store (Vector) | sqlite-vec (Bun-compatible SQLite vector extension) | Dedicated vector DB |
| Perception Log | SQLite with auto-vacuum (short retention) | TimescaleDB or ClickHouse |

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
async function executeTool(tool: Tool, args: unknown, caps: CapabilitySet): Promise<ToolResult> {
  // 1. Check capability BEFORE spawning
  if (!isAuthorized(tool.requiredCapabilities, caps)) {
    return { error: "capability_denied", detail: `Tool ${tool.name} requires ${tool.requiredCapabilities}` };
  }

  // 2. Spawn subprocess with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), tool.timeoutMs ?? 30_000);

  try {
    const proc = Bun.spawn(tool.command, {
      signal: controller.signal,
      env: filterEnv(caps),           // Only pass allowed env vars
      cwd: sandboxDir(caps),          // Restrict working directory
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

**Decision: CLI-first for v1. The terminal is where the work happens.**

```
$ nous "Add dark mode to this extension"

  Intent parsed: Add dark mode support
  Plan: 5 tasks (T1→T5)
  ✓ T1: Analyze CSS structure [2.3s]
  ► T2: Create theme toggle component [running...]
  ► T3: Add dark theme CSS variables [running...]
  ○ T4: Wire toggle into popup UI [blocked by T2, T3]
  ○ T5: Test in browser [blocked by T4]

  [Press 'd' for detail on any task, 'p' to pause, 'q' to cancel]
```

**Human Decision Queue surfaces as an interactive prompt:**

```
  ⚠ Decision needed:
  T3 wants to modify manifest.json (irreversible: changes extension permissions)

  Context: Adding "activeTab" permission for CSS injection
  Risk: Low (standard permission for theme extensions)

  [a]pprove  [d]eny  [m]odify  [v]iew diff
```

**Why CLI-first:**
- Developers live in the terminal. Switching to a web browser breaks flow.
- CLI is a single Bun binary — no web server, no frontend build, no port conflicts.
- Real-time streaming is natural in a terminal (like Claude Code does today).
- CLI output is scriptable and pipeable.

**v2: Web dashboard** for monitoring (long-running tasks, agent status, communication log). Not a replacement for CLI — a complement. Think of it like `htop` vs your shell: you use both.

**v2: IDE extension** (VS Code / JetBrains) for inline agent interaction. Like GitHub Copilot, but for orchestration: "I see you're struggling with this function — want me to spawn a specialist agent?"

---

### 7. Deployment Model

**Decision: Single Bun process for v1. Clean module boundaries for future splitting.**

```
v1: Single Process
┌──────────────────────────────────┐
│           Bun Process             │
│                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │  L0  │ │  L1  │ │  L2  │     │
│  │Intent│ │Orch. │ │ Run  │     │
│  └──┬───┘ └──┬───┘ └──┬───┘     │
│     │        │        │          │
│  ┌──▼────────▼────────▼───┐     │
│  │     L3 Persistence      │     │
│  │     (SQLite file)       │     │
│  └─────────────────────────┘     │
│                                   │
│  L4: Built-in (CLI adapter,      │
│      process supervisor)         │
└──────────────────────────────────┘
```

**Why single process:**
- No network calls between layers — function calls are nanoseconds, HTTP is milliseconds.
- One thing to deploy, one thing to monitor, one log stream.
- SQLite requires single-process access anyway (WAL mode allows concurrent reads but single writer).
- A single Bun process comfortably handles one user's agent workload.

**Preparation for future splitting:** Each layer is a separate package (`packages/orchestrator`, `packages/runtime`, etc.) with explicit interfaces. When the time comes to split, the interface stays the same — only the transport changes (function call → HTTP/gRPC).

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

**Decision: Static config for v1, dynamic request-and-grant for v2. Secrets via env vars + encrypted local store.**

**v1 (static):**

```typescript
// Agent capabilities defined at registration time
const agent = defineAgent({
  capabilities: {
    "fs.read": { paths: ["src/**", "tests/**"] },
    "fs.write": { paths: ["src/**"] },
    "shell.exec": { allowlist: ["bun", "git", "npm"] },
    "network.http": { domains: ["api.anthropic.com"] },
  },
});

// Immutable during runtime — change requires restart
```

**v2 (dynamic — after Growth Model is implemented):**

```typescript
// Agent can request elevated capabilities mid-task
await requestCapability("fs.write", { paths: ["config/**"] }, {
  reason: "Need to update ESLint config as part of task T3",
  duration: "task",          // Revoked when task completes
  riskLevel: "low",          // Self-assessed, verified by Orchestrator
});

// → Routes to Growth Engine
// → If trust score sufficient AND risk level matches → auto-grant
// → Otherwise → Human Decision Queue
```

**Secrets management:**

```
v1: Environment variables + .env files (standard, simple, works with every tool)
    Nous NEVER logs or stores env var values.
    CapabilitySet controls which env vars are visible to which agent.

v2: Encrypted local secret store (age or libsodium)
    → nous secrets set ANTHROPIC_API_KEY
    → Stored encrypted at rest in ~/.nous/secrets.enc
    → Decrypted into agent subprocess env at runtime, never on disk in plaintext
```

**Audit log:** Every capability check (granted or denied) is an Event. The CLI can query: `nous audit --agent code-analyst --last 24h` to see every capability usage.

---

### 11. Growth Model Calibration

**Decision: Start conservative, tune empirically. Ship with sensible defaults and a calibration log.**

**Initial thresholds (deliberately conservative — better to be slow than to over-trust):**

| Transition | Minimum Criteria | Notes |
|-----------|------------------|-------|
| 0 → 1 (Stranger → Acquaintance) | 5 successful tasks OR user imports project brief | Low bar — just prove basic communication works |
| 1 → 2 (Acquaintance → Colleague) | 30 tasks, <10% correction rate, 5+ procedural memories | Must demonstrate pattern learning |
| 2 → 3 (Colleague → Trusted Partner) | 100 tasks, <5% correction rate, proactive suggestions accepted >60% | Must demonstrate good judgment |
| 3 → 4 (Trusted Partner → Extended Self) | 300 tasks, <2% correction rate, user delegates whole workflows | Highest bar — must demonstrate autonomy |

**Trust decay:** 5% per week of inactivity. After 4 weeks of no interaction, a Stage 3 Nous drops to Stage 2. Rationale: the user's codebase, priorities, and preferences evolve even when Nous is inactive. Stale trust is dangerous trust.

**Fast-forward:** Yes — a user can import a TrustProfile from another Nous instance (e.g., moving to a new machine). The imported trust starts at 80% of its original value (trust transfer is lossy — the new environment may differ).

**Trust regression:** A single serious mistake (user undoes an action, data loss, wrong deployment) triggers an immediate one-stage regression with a clear explanation: "I made a significant error on [task]. I'm reducing my autonomy level to Stage N until I re-earn your trust. Here's what I'll now confirm before acting: [list]."

**Calibration log:** Every trust score change is logged with the specific event that caused it. `nous trust --history` shows the full trajectory. This data is essential for tuning thresholds after real-world usage.

---

### 12. Memory Metabolism Implementation

**Decision: 3+ similar episodes triggers extraction. Shadow execution for validation. 90-day episodic retention.**

**Extraction trigger:**

```
episodic → semantic:
  When 3+ episodic memories share a structural pattern
  (same task type, similar tool sequence, similar outcome)
  → LLM synthesizes a general fact
  → Human review: NO (too frequent, would overwhelm)
  → Validation: the semantic memory must match the next similar episode

semantic → procedural:
  When 5+ semantic facts describe a repeatable workflow
  → LLM compiles into a step-by-step procedure
  → Validation: shadow execution on next matching task
```

**Shadow execution:** When a new procedural memory is compiled, the next matching task runs the procedure in "shadow mode" — the agent executes normally using its ReAct loop, but the compiled procedure runs in parallel (without actually executing tools). If both produce the same tool calls in the same order, the procedure is validated. If they diverge, the procedure is flagged for review.

**Storage budget:**
- Episodic: 90-day retention. After metabolism (→ semantic), mark as "digested" and retain for 30 more days (audit trail), then prune.
- Semantic: No auto-prune. Invalidated only by contradicting evidence.
- Procedural: No auto-prune. Invalidated by content hash drift or repeated failure.

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
  Network: enabled (Stage 2+)
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

## Roadmap, Resource Planning & Growth Strategy

This section bridges architecture into execution: what to build first, what resources are needed at each stage, and how Nous bootstraps its own growth — using itself.

### Phase 0: MVP — The Core Loop

**Goal:** A single-user Nous that can receive an intent, decompose it into tasks, execute them with agents, and learn from the results. Plus: the Relay Network exists from Day 1, so even the first two Nous instances can communicate.

**MVP scope (what ships):**

```
Must Have (MVP)                          Not Yet (v2+)
─────────────────                        ────────────────
L0: Intent parsing (basic)               Ambient Intent
L1: Task DAG planner                     Attention Filter
L1: Task Scheduler + state machine       Dynamic capability graduation
L1: Agent Router (single strategy)       Multi-strategy routing
L2: Agent Runtime (ReAct loop)           Shadow execution
L2: Memory Manager (Tier 1-3)            Tier 4-5 (Procedural, Prospective)
L2: Growth Engine (Stage 0-2 only)       Stage 3-4
L3: SQLite persistence (all stores)      Memory metabolism
L4: CLI interface                        Web dashboard, IDE extension
L4: Relay Client                         Direct connection upgrade
L4: Process Supervisor (basic)           Full sensor suite

Cloud: Relay Network on CF               Federated relays
Cloud: Shared Procedural Pool (basic)    Trend Aggregator, Collective Insights
```

**Development resources needed:**

| Resource | Specification | Monthly Cost | Purpose |
|----------|--------------|-------------|---------|
| **LLM API** | Anthropic Claude API (Sonnet for agents, Haiku for Attention Filter) | $300-500 | Agent ReAct loops, intent parsing, memory extraction |
| **Development Machine** | Already available | $0 | Local development + testing |
| **Cloudflare** | Workers + D1 + Durable Objects + R2 | $0-5 (free tier) | Relay Network, Shared Pool, Discovery Index |
| **Domain** | nous.dev or similar | $10/year | Relay endpoint, project website |
| **GitHub** | Free (open source) | $0 | Code hosting, CI/CD (Actions), Issues, Discussions |
| **npm / JSR** | Free | $0 | Package registry |

**MVP Phase Total: ~$300-500/month** (almost entirely LLM API costs)

**Timeline estimate:** The MVP is a focused system with clear boundaries. The core components (Task state machine, Agent Runtime, Scheduler, Memory Manager, CLI) are well-defined data structures + algorithms. The Relay Network is a small Cloudflare Workers project. The LLM integration layer is one provider implementation.

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
# Stage 0 (Stranger) behavior: explains everything, asks permission for everything
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
Contributor Alice has a Stage 2+ Nous that:
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

Nous is the first **AI agent framework designed to be built by its own agents.** The architecture (Growth Model, Shared Pool, Communication Network) isn't just a feature — it's the mechanism by which the framework improves itself.

The human's role converges toward: **set the vision, make the irreversible decisions, and let Nous handle the rest.**

---

## Implementation Plan: Sprint-by-Sprint

### Sprint Order (Bottom-Up, Dependency-Aware)

```
Sprint 1 ──► Sprint 2 ──► Sprint 3 ──► Sprint 4 ──► Sprint 5 ──► Sprint 6
 Core +       Runtime      Orchestr.     CLI +        Memory +     Relay +
 Persistence  (ReAct)      (Scheduler)   Interface    Growth       Integration

 Types        LLM adapter  Intent parse  CLI app      Tier 1-3     Relay client
 State machines Tool system Task planner  Commands     Trust score  CF Workers
 SQLite stores ReAct loop  Scheduler     Supervisor   Graduation   E2E encrypt
 Event store  Heartbeat    Agent router  Agent defs   Feedback     Discovery
 Task store   Context mgmt DAG utils     Binary       Episodic     Pattern pool
                                                      Semantic

 ──── Foundation ────  ── Execution ──  ─── User-Facing ───  ── Network ──
```

**Key insight:** Sprint 4 is the first time a human can actually USE Nous. Everything before that is invisible infrastructure.

### Sprint Exit Criteria

| Sprint | Exit Criteria |
|--------|--------------|
| 1 | `bun test` passes. Can create tasks, transition states, store/query events. |
| 2 | Agent receives a task, runs ReAct loop with real LLM, uses tools, returns result. |
| 3 | Natural language intent → Task DAG → scheduled → assigned → executed → result. |
| 4 | `nous "Read README.md and summarize"` works end-to-end in a terminal. |
| 5 | Second run remembers facts from first run. `nous trust` shows scores. |
| 6 | Two Nous instances discover each other via relay and exchange a pattern. |

---

## Collaboration Model: Who Does What, When

### During MVP Build (Sprints 1-6): Human + LLM

```
Human (Joey)                          LLM (Claude Code)
  │                                     │
  ├── All architecture decisions        ├── Writes code per direction
  ├── Reviews all code                  ├── Runs tests
  ├── Every commit is human-authored    ├── Suggests improvements
  └── Deploys relay                     └── No autonomous action
```

### Post-MVP: Human + Nous Zero (Stage 2)

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
