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

> **Build AI agents on an operating-system-grade substrate, but shape them as proactive personal assistants, not enhanced chatbots.**

An operating system solves the core problem: how do multiple unreliable processes reliably accomplish complex tasks?

The answers are well-known (since the 1970s):
- Explicit process state machines
- Schedulers, not polling loops
- Inter-process communication, not shared mutable state
- Capability isolation, not global permissions
- Event logs, not ephemeral execution

These answers apply directly to AI agents — they are the new "processes." Nous applies OS principles to the AI agent domain.

But substrate is not the whole product. The **operating system** is the reliability substrate; the **personal assistant** is the behavioral form. If Nous gets the substrate right but behaves like a cold workflow engine, it fails as a product. If it behaves warmly but lacks OS-grade reliability, it fails as an agent system. Both layers are required.

### Why "Nous"

The name was chosen with intent, not decoration.

**Nous (νοῦς)** — a core concept in ancient Greek philosophy. Anaxagoras said: the universe was originally undifferentiated chaos; it was Nous that organized it into an ordered world. Aristotle said: Nous is the active intellect, the force that transforms potential into actuality.

```
Chaotic tasks, failing agents, accumulating events
                    ↓
                  Nous
                    ↓
Ordered execution, reliable help, human welfare remains central
```

The name is philosophically precise: this framework is not a tool — it is the organizing principle that transforms the chaos of AI execution into an ordered world in service of humans, not in service of automation for its own sake.

---

## Design Philosophy

Five principles that govern every design decision. Each is derived from the first principles above:

### North Star and Current Architectural Center

Nous must be reasoned about on **two levels at the same time**:

1. **North Star (highest guiding idea):** Nous should ultimately become a **self-evolving collective intelligence in service of human welfare** — not a better chat wrapper and not a disembodied swarm, but a federation of persistent Nous instances that can accumulate, validate, and exchange useful intelligence over time without erasing personal sovereignty.
2. **Current architectural center (what we build around today):** the necessary base form is a **persistent personal assistant runtime** — a long-lived, auditable, policy-governed system that can carry identity, memory, initiative, and execution across channels and sessions for one human first.

This distinction matters. The North Star prevents us from building a dead-end local tool. The current architectural center prevents us from prematurely building distributed complexity before the local substrate is real.

**Architectural test:** every major design decision should satisfy all four:

- **Works locally first** — it improves the single-instance persistent runtime.
- **Deepens personal assistant quality** — it makes single-user Nous more proactive, considerate, reliable, and context-aware.
- **Preserves future collective growth** — it does not block multi-instance learning, exchange, or evolution later.
- **Avoids premature swarm complexity** — it does not force distributed coordination into v1 where local contracts would suffice.

### 《Nous 的“个人优先的联邦群体智能”架构修正草案》 / Personal-First Federated Collective Intelligence

The architecture should be read with a strict ordering:

1. **Nous must first become a proactive, considerate, reliable personal assistant.**
2. **Collective intelligence emerges from many such assistants; it does not replace them.**
3. **The network exists to strengthen the local human-assistant relationship, not to harvest or override it.**

This implies a hard distinction between the **private core** of a local Nous and the **shareable shell** that may participate in collective learning.

| Layer | What lives here | Default policy |
|-------|------------------|----------------|
| **Private Core** | raw dialogue, user-state signals, relationship judgments, intimate memories, reflective reasoning, pending commitments, local context assemblies | local only, never shared by default |
| **Shareable Shell** | validated skills, governed tools, anonymized harness/eval traces, abstracted pattern summaries, approved collective proposals | shareable only through explicit governance, provenance, and policy |

Collective intelligence therefore means:

- **not** one global hive mind with local terminals attached
- **not** a centralized optimization layer that trades away personal context boundaries
- **not** raw-memory sharing between users

It means:

- a federation of **sovereign local Nous instances**
- each instance is loyal to its local human first
- intelligence flows outward only after abstraction, validation, and policy checks
- shared learning flows back only when it improves local welfare and respects local boundaries

This also changes how we think about proactive behavior. A good personal assistant should not only react to explicit commands; it should also notice, remember, reflect, encourage, remind, and gently offer help. Therefore the local architecture must include:

- **Proactive Cognition** — a background reflective loop, not just cheap event filtering
- **Relationship Boundary** — explicit policy for tone, intimacy, interruption, and care
- **Proactive Candidate outputs** — not every proactive act is a task; some are check-ins, celebrations, reminders, offers, or silent watchpoints

The resulting invariant is:

> **personal assistant quality is the primary product truth; collective intelligence is the amplification layer built on top of that truth.**

1. **Failure is the norm, not the exception.**
   Every component assumes it will crash. Recovery paths are built in from the start, not bolted on.
   *(From OS principle: processes crash — the OS must survive them.)*

2. **State is a first-class citizen.**
   Every entity (Task, Agent, Intent) has an explicit state machine. No implicit state allowed.
   *(From OS principle: process state machines are the foundation of reliable scheduling.)*

3. **Human welfare is the point; machines execute in service of it.**
   The system should reduce cognitive and operational burden while preserving human agency, boundaries, and dignity.
   *(From the abstraction history: each era moves humans further from operation toward pure decision-making — but the end goal is flourishing, not automation throughput.)*

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
| **Proactive Cognition** | Orchestration | A lower-frequency reflective loop that synthesizes signals, memory, prospective commitments, and user state into governed proactive candidates — the "background caring mind" of Nous |
| **ProactiveCandidate** | Orchestration / Dialogue | A system-initiated candidate output: reminder, check-in, celebration, suggestion, offer, silent watchpoint, or actionable ambient task |
| **RelationshipBoundary** | Cross-cutting | User-specific policy for proactivity, intimacy, interruption, tone, and what forms of care or initiative are welcome |
| **Ambient Intent** | Orchestration | An actionable subtype of proactive output: a goal inferred from environment/state signals, not explicitly stated by a human — system-initiated work that enters the normal intent pipeline |
| **ProcedureCandidate** | Evolution | A reusable execution pattern observed from successful runs, not yet fully validated as a stable Skill |
| **Skill** | Evolution | A reusable execution path crystallized from successful experience — the unit of learned competence |
| **PromptAsset** | Runtime | A versioned reusable instruction template with variables and metadata; may seed an Agent or Skill, but is not itself a Skill |
| **MCPServer** | Infrastructure | An external context/capability server exposing tools, resources, or prompts via MCP; always mediated by trust, auth, scope, and output policy |
| **Harness** | Infrastructure | A repeatable scenario runner for tests/evals that executes agents with controlled models, tools, approvals, failures, and trace assertions |
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

### ProactiveCandidate

`AmbientIntent` should not carry the whole burden of Nous's proactive behavior. Many valuable assistant acts are not tasks. So the system needs a wider proactive object family:

```typescript
type ProactiveCandidateKind =
  | "check_in"
  | "celebration"
  | "reminder"
  | "suggestion"
  | "offer"
  | "ambient_intent"
  | "protective_intervention"
  | "silent_watchpoint";

interface ProactiveCandidate {
  id: string;
  kind: ProactiveCandidateKind;

  summary: string;                 // Human-readable one-line explanation
  messageDraft: string;            // What Nous would actually say/show
  rationale: string;               // Why this is timely and useful now

  // If kind == "ambient_intent", this is the action-oriented path
  proposedIntentText?: string;     // The intent text that would enter the normal pipeline

  // Decision quality
  confidence: number;              // "I am right about the need"
  valueScore: number;              // "This is worth surfacing"
  interruptionCost: number;        // "How costly is it to interrupt right now"
  urgency: "low" | "normal" | "high";

  // Delivery / governance
  recommendedMode: "silent" | "async_notify" | "ask_first" | "auto_execute";
  requiresApproval: boolean;
  cooldownKey?: string;            // Avoid repeating the same suggestion too often
  expiresAt?: string;              // If this moment passes, the candidate is stale

  // Traceability
  sourceSignalIds: string[];
  sourceMemoryIds: string[];
  sourceIntentIds: string[];
  sourceThreadIds: string[];
  sourceAgendaItemIds: string[];

  status: "candidate" | "queued" | "delivered" | "converted" | "dismissed" | "expired";

  scope: Scope;
  provenance: Provenance;
}
```

**Key rule:** only `kind == "ambient_intent"` becomes an `Intent`. The other kinds route into dialogue / outbox / decision governance directly.

**Why this object matters:** if Nous only knows how to proactively generate tasks, it becomes a workflow machine. `ProactiveCandidate` lets it also:

- care
- remind
- encourage
- offer
- hold back and stay silent when that is the right move

### RelationshipBoundary

To be a good personal assistant, Nous must not only ask "can I do this?" but also "what kind of relationship with this user is welcome?" That requires an explicit boundary model.

```typescript
interface RelationshipBoundary {
  id: string;
  userId: string;

  assistantStyle: {
    warmth: "low" | "balanced" | "high";
    directness: "low" | "balanced" | "high";
    celebrationStyle: "subtle" | "warm" | "enthusiastic";
    checkInStyle: "rare" | "situational" | "proactive";
  };

  proactivityPolicy: {
    initiativeLevel: "minimal" | "balanced" | "high";
    allowedKinds: ProactiveCandidateKind[];
    blockedKinds: ProactiveCandidateKind[];
    requireApprovalForKinds: ProactiveCandidateKind[];
  };

  interruptionPolicy: {
    quietHours?: Array<{
      start: string;               // "22:00"
      end: string;                 // "08:00"
      timezone: string;
    }>;
    maxUnpromptedMessagesPerDay: number;
    preferredDelivery: "thread" | "notification" | "digest";
    urgentBypassKinds: ProactiveCandidateKind[];
  };

  intimacyPolicy: {
    emotionalMirroring: "minimal" | "measured" | "warm";
    personalInference: "conservative" | "moderate";
    neverAssumeEmotionalState: boolean;
    avoidTopics: string[];
  };

  autonomyPolicy: {
    allowOffersWithoutPrompt: boolean;
    allowAmbientAutoExecution: boolean;
    maxAutoExecutionRisk: "none" | "low_only" | "policy_controlled";
  };

  scope: Scope;                    // Usually user-global, but may be project/thread refined
  createdAt: string;
  updatedAt: string;
  provenance: Provenance;
}
```

**Key rule:** `RelationshipBoundary` belongs to the **private core**, not the shareable shell. It is about the local human-assistant relationship and should never be exported as raw data.

**Why this object matters:** without it, "proactivity" quickly degrades into either:

- spammy interruption
- creepy overreach
- emotionally flat utility behavior

This object gives the architecture a place to encode tone, cadence, restraint, and consent.

### ReflectionAgenda / Memory Rover

The background reflective loop needs explicit runtime objects too. Otherwise "memory rover" stays a metaphor instead of a governed system.

```typescript
type ReflectionAgendaCategory =
  | "closure"
  | "deadline"
  | "friction"
  | "progress"
  | "environment_change"
  | "wellbeing"
  | "follow_up"
  | "relationship";

interface ReflectionAgendaItem {
  id: string;
  category: ReflectionAgendaCategory;
  summary: string;                 // Why this item deserves reflection
  drivingQuestion: string;         // "Does the user need a reminder / offer / encouragement?"

  priority: number;                // Higher = reflect sooner
  dueAt?: string;
  dedupeKey: string;
  cooldownUntil?: string;

  budgetClass: "cheap" | "standard" | "deep";
  sourceSignalIds: string[];
  sourceMemoryIds: string[];
  sourceIntentIds: string[];
  sourceThreadIds: string[];

  status: "queued" | "leased" | "synthesized" | "dismissed" | "expired";

  scope: Scope;
  provenance: Provenance;
}

interface ReflectionRun {
  id: string;
  agendaItemIds: string[];
  retrievedMemoryIds: string[];
  producedCandidateIds: string[];

  modelClass: "fast" | "strong";
  maxTokensBudget: number;
  tokensUsed: number;

  outcome: "no_action" | "candidate_emitted" | "deferred";
  startedAt: string;
  finishedAt?: string;
}
```

`Memory Rover` is the runtime service that:

1. leases `ReflectionAgendaItem`s
2. retrieves relevant memory / commitments / context
3. evaluates them under `RelationshipBoundary`
4. emits `ProactiveCandidate`s or decides silence is better

**Key invariants:**

- it is **agenda-driven**, not a blind random walk over memory
- it is **budget-governed**, not an unlimited background thinker
- it is **relationship-bound**, not free to say whatever it infers
- it may legitimately output **no action**

Silence is a first-class valid result, not a failure mode.

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

### Unified Artifact / Governance Model

The unifying pattern behind **PromptAsset**, **Tool**, **Skill**, and **Harness** is this:

> They are all **Governed Operational Artifacts** — runtime-relevant objects that must be selectable, auditable, scoped, validated, and eventually evolvable.

This matters because many frameworks let these concepts grow independently:

- prompts live as loose text files
- tools live as callable adapters
- skills live as vaguely defined "reusable things"
- harnesses live outside the runtime as one-off QA scripts

That fragmentation makes governance impossible. Nous should instead treat them as one family of objects with a shared control plane.

```text
┌─────────────────────────────────────────────────────────────┐
│           Unified Artifact / Governance Plane              │
├─────────────────────────────────────────────────────────────┤
│  Artifact Registry                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ PromptAssets · Tools · Skills · Harnesses            │  │
│  │                                                       │  │
│  │ Shared governance fields:                             │  │
│  │ - id / kind / version                                 │  │
│  │ - scope / provenance / owner                          │  │
│  │ - validationState / riskClass / status                │  │
│  │ - dependencies / evidence / metrics                   │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Selection / Assembly                                       │
│  Intent + Context + Memory + Policy                         │
│    ├─ choose PromptAssets                                   │
│    ├─ expose Tool subset                                    │
│    ├─ match applicable Skills                               │
│    └─ bind Harness scenarios for validation / rollout       │
├─────────────────────────────────────────────────────────────┤
│  Runtime Execution                                          │
│  Agent / Subagent executes with:                            │
│    - prompts from PromptAssets                              │
│    - actions through Tools                                  │
│    - strategy shortcuts from Skills                         │
│    - optional MCP-backed Tool/Resource adapters             │
├─────────────────────────────────────────────────────────────┤
│  Evidence Collection                                        │
│  Traces · approvals · outcomes · edits · failures · costs   │
├─────────────────────────────────────────────────────────────┤
│  Governance Loop                                            │
│    - ProcedureCandidate -> Skill promotion                  │
│    - CapabilityGap -> Tool / Prompt proposal               │
│    - failures / regressions -> Harness scenarios            │
│    - rollout / deprecate / revoke by evidence               │
└─────────────────────────────────────────────────────────────┘
```

#### Why unify them

All four artifacts solve the same meta-problem from different angles:

- **PromptAsset** compresses reusable instruction structure
- **Tool** compresses reusable environment interaction
- **Skill** compresses reusable strategy
- **Harness** compresses reusable validation and trust generation

If Nous models them separately with no shared governance, it cannot reliably answer:

- what is safe to auto-use?
- what is only experimental?
- what evidence justified promotion?
- what should be exported to another instance?
- what should be revoked after regression?

#### The common base object

At the architectural level, every governed artifact should converge on a shape like:

```typescript
interface GovernedArtifact {
  id: string;
  kind: "prompt_asset" | "tool" | "skill" | "harness";

  name: string;
  version: number;
  description: string;

  scope: ArtifactScope;
  provenance: ArtifactProvenance;
  validationState: ArtifactValidationState;

  owner: "system" | "user" | "evolution";
  riskClass: "low" | "medium" | "high";
  status: "active" | "disabled" | "deprecated" | "revoked";

  dependencies: ArtifactRef[];
  evidence: EvidenceRef[];

  createdAt: string;
  updatedAt: string;
}
```

#### Specialization rules

| Artifact | Governs | May reference | Must not be confused with |
|----------|---------|---------------|----------------------------|
| **PromptAsset** | reusable instruction templates | model/provider hints, variables | Skill |
| **Tool** | environment action surface | capabilities, approval policy, MCP adapter | Skill or PromptAsset |
| **Skill** | reusable execution policy | PromptAssets, Tools, MCP subsets, subagent profile | mere prompt/package/persona |
| **Harness** | repeatable trust-generation scenario | fixtures, assertions, fault injection, rollout gates | production runtime capability |

#### Relationship to Nous philosophy

This unified model is not architectural decoration. It is how Nous operationalizes its core principles:

- **State is first-class** → artifacts are explicit governed objects, not scattered files
- **Observability is built-in** → evidence and validation are part of the object model
- **Least capability** → tool and MCP exposure are policy-filtered artifacts, not ambient power
- **Growth ≠ permission escalation** → Skills and Harnesses improve competence and trust, not authority
- **Works locally first** → the whole governance plane can exist in a single local runtime before federation

#### Current vs future boundary

For v1/v1.5, Nous does **not** need to fully productize all four artifact families.

What it needs now is:

1. a shared metadata/governance vocabulary
2. a formal Tool contract
3. Skill promotion that can reference other artifacts without collapsing into them
4. a minimal Harness model for regression and rollout gating

The full artifact ecosystem — export/import, rich registries, cross-instance sharing, and automatic rollout governance — can come later.

**Implementation note:** a first future-facing TypeScript draft for this model should live in core types as a design anchor (`packages/core/src/types/artifact.ts`). It is allowed to be ahead of the currently implemented runtime as long as it stays clearly framed as the target object model rather than falsely claiming full feature completion.

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

The same permission policy should also be rendered back into Context Assembly as an **explainable boundary summary**. This matters product-wise: a personal assistant should be able to say not only "I can't do that," but **why** the current scope/policy blocks it and what kind of approval would unblock it.

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

### Current Implementation Reality

The current codebase has **not** yet reached the full memory architecture described here.

What exists today is best described as:

- **memory substrate**
  - `SQLiteMemoryStore`
  - 5-tier enum and basic entry model
- **first retrieval loop**
  - hybrid lexical + local-semantic heuristic retrieval
  - lexical FTS candidate expansion + local semantic scoring
  - chunk-aware selection and compact context packing
  - provenance / scope / thread bias in ranking
  - context assembly consumes compact memory hints
  - daemon already auto-ingests:
    - incoming human intents
    - intent outcomes
    - promoted perception signals
    - selected in-thread conversation turns
  - runtime boundary now has producer hooks for:
    - conversation turns
    - perception signals
    - prospective commitments
  - first prospective lifecycle exists:
    - pending/scheduled/done state updates
    - due/remind-time scanning
    - linked intent success can close related prospective commitments

What does **not** exist yet:

- real embedding provider abstraction in production use
- sqlite-vec / ANN retrieval
- graph traversal
- persisted chunk store / ANN chunk index
- metabolism pipeline
- true procedural memory producers
- rich prospective metabolism / reminder families beyond the first queue-backed producer

This distinction matters architecturally. If we pretend the current implementation is already “RAG memory”, we will scatter ad hoc patches across daemon, retriever, and future evolution code. The right framing is:

> current state = **memory substrate + first retrieval loop**
> not yet = **true RAG + metabolism + procedural memory**

### MemoryService — Runtime Memory Boundary

The runtime needs a **single memory boundary object**, not a growing set of direct calls to:

- `memory.store(...)`
- `HybridMemoryRetriever`
- per-tier helpers
- future metabolism jobs

That boundary is `MemoryService`.

```
┌──────────────────────────────────────────────────────────────┐
│                  Runtime / Infra Producers                  │
│  daemon   orchestrator   runtime   perception   evolution   │
└──────────────────────────────┬───────────────────────────────┘
                               │ ingest / retrieve / feedback
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                        MemoryService                         │
│                                                              │
│  1. Ingest boundary                                           │
│     - canonicalize metadata / provenance                      │
│     - choose tier                                              │
│     - persist entry                                            │
│                                                              │
│  2. Retrieval boundary                                        │
│     - query formulation                                       │
│     - candidate retrieval                                     │
│     - ranking / packing                                       │
│     - return context-ready memory hints                       │
│                                                              │
│  3. Feedback boundary                                         │
│     - record access / reinforcement                           │
│     - emit evidence for metabolism later                      │
│                                                              │
│  4. Future hooks                                              │
│     - episodic → semantic digestion                           │
│     - semantic → procedural compilation                       │
│     - prospective scheduling / reminders                      │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
      Memory Store Substrate            Retrieval Substrate
  (SQLite today, pluggable later)   (FTS today, vector/graph later)
```

Minimal contract:

```typescript
interface MemoryService {
  ingestHumanIntent(...): MemoryEntry;
  ingestIntentOutcome(...): MemoryEntry;
  ingestConversationTurn(...): MemoryEntry;
  ingestPerceptionSignal(...): MemoryEntry;
  ingestProspectiveCommitment(...): MemoryEntry;

  retrieveForContext(...): string[];
  recordAccess(memoryId: string): void;
  findDueProspectiveCommitments(...): DueProspectiveCommitment[];
  updateProspectiveCommitment(...): MemoryEntry | undefined;

  // next / future
  ingestDecision(...): MemoryEntry;
  runMetabolismPass(...): Promise<void>;
}
```

Why this boundary matters:

- **daemon / CLI / future MCP channels** should not each invent their own memory shape
- **retrieval policy** should not be hard-coded into context assembly call sites
- **metabolism** must have one place to hook into ingestion + access feedback
- **interview-grade traceability** improves when memory production is explicit and canonical

What `MemoryService` is **not**:

- not the full storage engine
- not the context assembler
- not the evolution engine
- not a synonym for one specific retrieval algorithm

It is the **governed runtime boundary** between producers/consumers and the underlying memory substrate.

### Canonical Metadata / Provenance Schema

Every durable Tier 2+ memory should carry a canonical metadata envelope, even if early-stage producers only fill part of it.

```typescript
interface BaseMemoryMetadata {
  schemaVersion: "memory.v1";
  sourceKind: MemorySourceKind;
  threadId?: string;
  intentId?: string;
  taskId?: string;
  decisionId?: string;
  projectRoot?: string;
  focusedFile?: string;
  labels?: string[];
  tags?: string[];
  provenance: {
    source: MemorySourceKind;
    observedAt: string;
    producer: {
      layer: "dialogue" | "daemon" | "orchestrator" | "runtime" | "perception" | "evolution" | "human";
      name: string;
      version?: string;
    };
    sourceRefs?: Array<{ kind: "thread" | "message" | "intent" | "task" | "decision" | "event" | "memory" | "tool_call" | "sensor_signal"; id: string }>;
    evidenceRefs?: Array<{ kind: string; id: string; role?: "source" | "support" | "contradiction" | "rollback" }>;
    parentMemoryIds?: string[];
    confidence?: number;
  };
}
```

Tier-specific rules:

- **episodic metadata**
  - describes **what happened**
  - should point back to concrete thread / intent / task lineage
  - may include:
    - `outcomeStatus`
    - `toolsUsed`
    - `success`
- **semantic metadata**
  - describes **what claim/fact was distilled**
  - should carry:
    - `factType`
    - `derivedFromMemoryIds`
    - claim-level confidence
- **prospective metadata**
  - describes **what must happen later**
  - should carry:
    - `dueAt`
    - `remindAt`
    - `fulfillmentStatus`
    - `blocking`

Why provenance is first-class:

- retrieval should prefer memories with clearer evidence chains
- contradiction / supersession later depends on traceable lineage
- metabolism must know which episodes produced which semantic claims
- user-facing explanations need source attribution without replaying whole transcripts

This is also where Nous intentionally differs from “just dump strings into vector DB” memory designs. Nous memory is not only about similarity; it is about **governed recall with lineage**.

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

#### Layered retrieval contract

The retrieval pipeline should be treated as a **layered contract**, not a single `search()` call:

1. **Query formulation**
   - input:
     - user/task text
     - scope
     - thread / active intent state
   - output:
     - normalized retrieval query
     - optional sub-queries

2. **Candidate generation**
   - lexical path
   - semantic/vector path
   - graph/provenance path
   - future prospective/deadline path

3. **Fusion + dedupe**
   - merge heterogeneous candidate sets
   - normalize scores
   - remove duplicates / superseded entries

4. **Re-rank**
   - tier-aware prioritization
   - confidence / provenance boost
   - recency / access / retention adjustments
   - optional LLM reranker later

5. **Packing**
   - fit the context budget
   - prefer compact summaries over raw episodes when equivalent
   - preserve provenance handles so the runtime can explain “why this memory was used”

6. **Feedback**
   - record access
   - record whether retrieval helped
   - create future reinforcement / contradiction / digestion signals

Current vs future status:

- **current code**
  - partial query grounding
  - heuristic hybrid scoring
  - compact hint rendering
  - access-count reinforcement
- **future code**
  - explicit multi-path candidate objects
  - vector backend abstraction
  - graph traversal
  - RRF / learned fusion
  - provenance-aware packer
  - retrieval evaluation hooks

Architecturally, this means:

- `MemoryStore` is the **substrate**
- `MemoryService` is the **runtime boundary**
- the retrieval pipeline is the **policy stack**

These are different layers and should not collapse into one class.

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

## Unified Task Intake and Execution Depth Model

If Nous is genuinely a **persistent personal assistant**, it must not split the world into:

- "real agent tasks"
- "simple commands"
- "ambient signals"

as if these were different kinds of minds. They are different **input surfaces**, but they must enter one unified intent system.

### The architectural correction

The wrong framing is:

> some inputs go through a deep agent path, while other inputs take a special "short path"

That framing tends to pull the system back toward today's workspace-centric agent frameworks — optimized for command execution inside a repo, but weak at understanding the user's broader state and intent.

The correct framing for Nous is:

> every incoming user message, command, or ambient signal enters the same **task-intake pipeline**; the system then chooses the appropriate **execution depth**.

This preserves the product thesis:

- **user-centered**, not workspace-centered
- **intent-centered**, not command-centered
- **continuity-first**, not session-first
- **proactive-capable**, not purely request/response

### One intake, many depths

```text
Message / Command / Ambient Signal
  │
  ▼
User-State Grounding
  │  Who is this user? what thread/project/goal context are they in?
  │  what unfinished work, preferences, and recent activity matter here?
  ▼
Intent Inference
  │  explicit intent
  │  real intent
  │  latent/potential intent
  ▼
Clarification Gate
  │  ask only if ambiguity blocks safe or useful execution
  ▼
Task Contract Formation
  │  goal · boundaries · success criteria · interruption policy
  ▼
Execution Depth Selection
  │
  ├─ Planning depth: none / light / full
  ├─ Time depth: foreground / background
  ├─ Organization depth:
  │    - single agent
  │    - serial specialists
  │    - parallel specialists
  └─ Initiative mode:
       - reactive to user request
       - proactive from ambient/user-state signals
  ▼
Orchestration + Execution
  ▼
Verification + Decision Queue
  ▼
Delivery + Memory + Follow-up
```

### User interaction flow

From the user's perspective, a well-designed Nous task should feel like this:

1. **The user expresses a goal or request**
   - not necessarily in perfectly structured language
   - possibly from any channel or environment
2. **Nous demonstrates understanding before over-executing**
   - what it thinks the user wants
   - how deeply it plans to engage
   - when it may need to interrupt
3. **Nous proceeds mostly silently**
   - only surfacing true blockers, risks, or important forks
4. **Nous returns a structured delivery**
   - result
   - evidence / validation
   - remaining risks
   - possible next steps
5. **Nous retains continuity**
   - the task does not disappear just because the channel does

### Internal execution flow

Internally, the flow should be reasoned about in this order:

1. **Signal intake**
2. **User-state grounding**
3. **Explicit / real / latent intent inference**
4. **Clarification if ambiguity matters**
5. **Task contract formation**
6. **Execution depth selection**
7. **Orchestration**
8. **Verification**
9. **Decision queue / human checkpoints**
10. **Delivery + evidence capture + memory/evolution hooks**

This order matters. Planning is not the universal entrypoint. Long-running execution is not the universal entrypoint. Multi-agent orchestration is not the universal entrypoint. They are all consequences of the depth decision made *after* intent and contract are understood.

### What "execution depth" means

Execution depth is the key abstraction that replaces the misleading "fast path vs deep path" mental model.

#### 1. Planning depth

- **none**: direct action is safe and obvious
- **light**: a short local plan is enough
- **full**: explicit task decomposition and scheduler involvement are needed

#### 2. Time depth

- **foreground**: user likely expects a quick answer/result
- **background**: task continues asynchronously with progress continuity

#### 3. Organization depth

- **single agent**: one runtime loop is enough
- **serial specialists**: distinct stages benefit from handoff
- **parallel specialists**: bounded concurrent branches provide value

#### 4. Initiative depth

- **reactive**: user-requested execution
- **proactive**: user-state and ambient signals justify a suggestion or action

### Commands are not a separate ontology

This is the crucial point.

A shell-like request such as:

- "check git status"
- "search for the failing test"
- "see what changed in auth.ts"

must not be modeled as a fundamentally different class of system input.

They are still:

- user-originated signals
- interpreted in user/project/thread context
- candidates for latent-intent inference
- subject to contract/risk/interruption policy

What differs is only the selected execution depth — often shallow, but still inside the same unified system.

### Relation to existing architecture layers

This model does not replace the current layered architecture. It clarifies how those layers should collaborate.

| Concern | Primary layer(s) |
|---------|------------------|
| signal/message intake | Dialogue Layer + L0 Intent Plane |
| user-state grounding | Context Assembly + Memory + Dialogue continuity |
| intent inference | L0 Intent Plane |
| task contract formation | L0 Intent Plane |
| execution depth selection | L0/L1 boundary |
| planning / routing / scheduling | L1 Orchestration Plane |
| tool/model execution | L2 Runtime |
| evidence / continuity / replay | L3 Persistence + Dialogue Outbox |
| proactive follow-up | Perception Pipeline + L0 Ambient Intent |

### Architectural implication

The current architecture already has many necessary building blocks:

- Unified Presence
- Intent → Plan → Task separation
- Context Assembly
- Human Decision Queue
- Daemon continuity
- Conflict detection
- Ambient Intent

But this section makes explicit a still-missing middle structure:

1. **User-State Grounding as a first-class step**
2. **Task Contract Formation as a first-class step**
3. **Execution Depth Selection as a first-class step**
4. **Delivery as a first-class contract, not just a final message**

That is the path from "persistent agent runtime" toward "persistent personal assistant."

### Semantic Layering Draft

Nous should not treat every "semantic" problem as the same kind of problem solved by the same mechanism.

That is one of the biggest architectural traps in agent systems: once LLMs are available, teams start routing every fuzzy problem through a generic prompt. This feels flexible early, but it collapses distinct concerns:

- understanding what the user means
- retrieving the right past knowledge/artifacts
- deciding whether human governance is required
- learning durable improvements from repeated experience

Those are all semantic in some sense, but they are **not the same layer**. They have different latency budgets, correctness requirements, persistence needs, and governance implications.

#### Four semantic layers

| Semantic layer | Core question | Primary mechanism | Why this split matters |
|----------------|---------------|-------------------|------------------------|
| **Intent semantics** | "What does the user mean right now in this thread, with this grounding?" | LLM structured output + user-state grounding | This is where ambiguity, latent intent, clarification, and thread reply routing live. The output must become explicit contracts/state, not stay trapped in prompt text. |
| **Retrieval semantics** | "What prior memory, artifact, or history is actually relevant?" | Hybrid retrieval: embeddings + lexical + filters + re-ranking | Retrieval is a recall problem, not a dialogue-generation problem. It needs scope filters, ranking, chunking, and provenance — not just another free-form model answer. |
| **Control / governance semantics** | "Can Nous safely continue, or does it need a human decision?" | Explicit `Decision` objects + queue policy + optional LLM interpretation | Governance must be explicit and auditable. Approval, conflict resolution, and scope confirmation cannot be hidden inside transient reasoning. |
| **Evolution semantics** | "What repeated patterns should become reusable competence or governance policy?" | Harness/eval evidence + artifact governance + proposal pipeline | Learning is not just semantic clustering. It needs validation, rollback, provenance, and rollout policy. |

#### Current design consequences

1. **Understanding-heavy semantics should use LLMs, but through structured contracts**
   - intent parsing
   - user-state-grounded task contract formation
   - thread reply routing
   - decision response interpretation

   Nous should prefer LLM structured output here because the problem is genuinely semantic and brittle if reduced to string matching. But the result must land in typed objects (`Intent`, `TaskContract`, `Decision`, etc.), not in ad hoc prompt-local heuristics.

2. **Recall-heavy semantics should use retrieval systems, not conversational guesses**
   - memory retrieval
   - artifact lookup
   - future skill/harness/prompt-asset selection

   This is why the memory direction is hybrid retrieval / RAG, not FTS-only and not "ask the model to remember."

3. **Background semantics should be staged: cheap triage first, richer reflection second**
   - perception filtering
   - attention scoring
   - reflection agenda building
   - proactive candidate synthesis

   The reason is cost and cadence: these paths run continuously, so they cannot assume a large-model call on every raw signal. Cheap heuristics or small models should pre-filter first; stronger semantic interpretation should happen on a smaller set of promoted agendas, including memory/prospective reflection.

4. **Governance semantics must be objectified**
   - clarification
   - approval
   - scope confirmation
   - conflict resolution

   Nous should never leave these as hidden branches in controller code or one-off booleans on an intent. They need first-class queue objects, persistence, routing, and resume semantics.

#### Why this matters for Nous specifically

Nous is trying to become a persistent personal assistant, not a workspace-bound command runner. That means semantic correctness is not only about "did the model understand this sentence?" It is also about:

- whether the right **personal/project context** was assembled
- whether the right **history** was recalled
- whether the right **human decision** was surfaced
- whether the right **learning artifact** was produced for future work

So the architecture must separate these semantic concerns early, even if some of them temporarily use the same LLM provider under the hood.

### Generic DecisionQueue Model

The original clarification flow was the first real blocked-intent path, but it must not remain a one-off exception.

The correct generalization is:

- **`Decision`** = one explicit blocking coordination object
- **`DecisionQueue`** = the ordered human-facing coordination layer that decides which blocking item is currently active in a thread/runtime surface

In other words, clarification was never the ontology. It was only the first producer.

#### Decision kinds

Current decision kinds:

- `clarification`
- `approval`
- `scope_confirmation`
- `conflict_resolution`

These map to distinct reasons Nous may need the human:

| Kind | Why Nous is blocked | Typical producer | Current status |
|------|---------------------|------------------|----------------|
| `clarification` | intent understanding is materially incomplete | intake / resume | **active producer** |
| `approval` | action is system-initiated or otherwise requires explicit consent | ambient intent promotion; risky task-boundary checkpoint | **active producer** |
| `scope_confirmation` | the user message could either narrow the current intent or start a new one / change scope | thread/intake boundary handling for the latest active thread-owned intent | **active producer (current/new disambiguation + execution-boundary resume)** |
| `conflict_resolution` | concurrent work cannot be safely or meaningfully continued without a user choice | conflict analyzer | **active producer** |

#### Response modes

A generic queue also needs generic response contracts:

- `free_text` — open clarification / disambiguation
- `approval` — yes/no style consent
- `single_select` — choose one explicit resolution option

This matters because reply interpretation, UX rendering, storage, and resume behavior should all derive from the same model instead of each producer inventing its own mini-protocol.

#### Relationship to intent state

All of these are `Decision`s, but not all blocked intents are blocked for the same reason. So Nous currently distinguishes:

- `intent.status = awaiting_clarification`
  - the blocker is missing or underspecified intent understanding
  - the decision object still exists in the queue, but the intent state preserves the semantic reason
- `intent.status = awaiting_decision`
  - the blocker is broader governance / coordination
  - approval, scope confirmation, and conflict resolution land here

This is an intentional compromise. A future design could normalize all blocked intents under a generic `blocked` state with a reason enum, but for now the explicit distinction keeps intake/resume semantics clearer.

#### Queue policy

MVP queue policy:

1. **One active pending decision per thread at a time**
   - thread replies remain unambiguous
   - user experience stays coherent
   - the thread input router has a clear target
2. **A decision always belongs to exactly one intent and one primary thread**
3. **A decision may reference other intents for context, but ownership stays singular**
4. **Resolving a decision must produce an explicit outcome**
   - resume current intent
   - queue after current work
   - abandon / reject
   - persist a scope choice

This is why the queue is not just a UI list. It is a runtime governance boundary.

#### Runtime queue / resume policy

The queue policy should not stay as prose only. In runtime terms, the policy is:

1. **A newly created decision becomes `pending` only if the thread currently has no pending decision**
2. **Otherwise it becomes `queued`**
3. **Queued decisions are activated oldest-first**
4. **A resolved decision does not just disappear; it must execute a resume policy before the queue advances**

That resume policy is:

- persist answer + selected option + outcome
- apply the owning intent action
  - clarification → revise same intent, then resume or re-clarify
  - approval → resume, pause, or abandon depending on producer policy
  - conflict resolution → queue/resume or abandon
  - scope confirmation → either revise current intent or start a separate new intent from the buffered message
- only then activate the next queued decision if the thread has no other pending blocker

Pause-aware extension:

- if the user says “pause this for now” while a decision is pending, that is **not** cancellation
- the owner intent moves to `paused`
- outstanding decisions owned by that paused intent move back to `queued` instead of being destroyed
- resume re-activates the queued decision only when the thread no longer has another pending blocker

This is important because a queue without a resume policy is just a ticket list. Nous needs a **governed blocking runtime**, not an inbox.

#### Defer → decide → resume

For non-trivial governance cases, the daemon/orchestrator interaction should follow this pattern:

```
new input / ambient promotion
  │
  ├─► create intent + preserve original request / grounding
  │
  ├─► defer execution if human governance may be needed
  │
  ├─► analyze blockers
  │     ├─ clarification?        → create Decision(kind=clarification)
  │     ├─ approval needed?      → create Decision(kind=approval)
  │     ├─ scope unclear?        → create Decision(kind=scope_confirmation)
  │     └─ conflict requires user choice? → create Decision(kind=conflict_resolution)
  │
  ├─► prompt inside the same primary thread
  │
  ├─► interpret the user reply according to responseMode
  │
  └─► resolve decision and either resume, re-queue, or abandon
```

This pattern is important because it preserves the original intent identity before human governance happens. Nous should not lose the original task simply because a checkpoint appeared in the middle.

### Thread / Intent / DecisionQueue Relationship Model

To preserve continuity correctly, Nous must not collapse conversation, work, and blocking coordination into one object.

- **Thread** = communication continuity
  - the place where the human and Nous talk
  - contains messages, clarifications, notifications, and delivery
- **Intent** = execution continuity
  - the thing Nous is trying to accomplish
  - owns goal, contract, execution depth, tasks, and execution state
- **Decision** = blocking coordination item
  - the explicit object for "I cannot safely/usefully continue until X is resolved"
  - clarification is one decision kind, not the only one
- **DecisionQueue** = the thread-facing governance surface for pending decisions
  - controls which blocking item is currently active for human resolution
  - keeps thread replies and resume semantics coherent

#### Relationship

- one `DialogueThread` may contain **multiple** intents over time
- one intent should have one **primary thread** for human-facing coordination
- one blocking `Decision` belongs to:
  - exactly one `intent`
  - exactly one `thread`
- one `DecisionQueue` may contain multiple decisions over time, but MVP policy keeps only one pending decision active per thread at once

So the model is not:

- thread == intent

It is:

- thread = conversation container
- intent = work identity
- decision = blocking bridge between them

#### Invariants

1. **Tasks belong to intents, not threads**
2. **Messages belong to threads, not intents by default**
3. **A clarification reply happens in a thread, but it resumes an intent**
4. **Clarification does not create a new intent identity**
5. **The original request should remain preserved; the executable understanding may evolve**

This implies Nous should distinguish between:

- `intent.raw` — the original human request
- `intent.workingText` — the latest executable understanding after clarification / revision

#### Clarification-resume flow

```
User request
  │
  ▼
Thread message ──► Intent intake
                     │
                     ├─ enough information
                     │    └─► plan / execute
                     │
                     └─ clarification needed
                          ├─► create Decision(kind=clarification)
                          ├─► intent.status = awaiting_clarification
                          └─► ask inside the same thread

User reply in same thread
  │
  ▼
Thread input router
  │
  ├─ new intent
  │    └─► create another intent
  │
  └─ clarification response
       ├─► apply response to the original intent
       ├─► rebuild intent.workingText
       ├─► re-run intake on the same intent identity
       ├─► clear or renew blocking decision
       └─► resume original intent
```

#### Architectural consequence

The correct abstraction is therefore:

- **threads are where the conversation continues**
- **intents are where responsibility continues**
- **decisions are where blocking coordination is made explicit**

This is what allows Nous to behave like a persistent assistant rather than a sequence of disconnected command invocations.

#### Execution-boundary scope revision

Clarification-resume is not the same thing as **scope revision**.

- clarification = “I still do not understand enough to continue”
- scope revision = “I understand the task, but the user just changed what the task should become”

For scope revision, Nous now treats the **intent** as the stable owner and the **task graph** as revisable.

Current policy:

1. **No tasks yet**
   - revise the same intent immediately before planning
2. **Tasks exist, but none are `assigned` / `running`**
   - delete unfinished tasks
   - preserve completed work as execution evidence
   - rebuild `intent.workingText`
   - re-run intake on the same intent id
   - re-plan the remaining work immediately
3. **At least one task is `assigned` / `running`**
   - do not rewrite live execution in place
   - persist `intent.pendingRevision`
   - stop dispatching further ready tasks for that intent
   - wait until active work drains to zero
   - apply the revision at the next safe execution boundary, then re-plan

This gives Nous a real mid-execution revision path without pretending it can safely mutate a live running step in place.

#### New invariant: pending revision blocks dispatch

If an intent has `pendingRevision`, ready tasks for that intent must **not** continue dispatching blindly.

The scheduler therefore treats `intent.pendingRevision` as a local execution brake:

- already running work may finish
- newly ready work is held back
- the next safe boundary becomes the point where the task graph may be rewritten

This is important because otherwise a user could update the task scope while Nous keeps launching now-stale queued tasks, which would break intent continuity.

#### Interruption / cancellation contract

Scope revision is only half of long-running task governance. Nous also needs an explicit answer for:

- “stop this task”
- “cancel the remaining work”
- “what if a tool is already running right now?”

The current cancellation contract is:

1. **Queued / not-yet-running work cancels immediately**
   - `created`
   - `queued`
   - `assigned` (if execution has not actually entered the runtime loop yet)
2. **Running work does not always die immediately**
   - Nous checks the current tool semantics first
3. **Intent-level cancellation persists as `intent.pendingCancellation` until the runtime reaches a safe stop boundary**
4. **The scheduler must not dispatch new tasks for an intent that has either**
   - `pendingRevision`
   - `pendingCancellation`

This makes cancellation a governed runtime state, not just a UI button.

#### Intent execution directive ledger

Nous now needs a more explicit execution-governance model than two unrelated booleans.

At the intent layer, the runtime direction is:

- keep `pendingRevision` and `pendingCancellation` as **fast runtime projections / convenience views**
- but treat them as projections of a broader `intent.executionDirectives[]` ledger

Current directive kinds are:

- `scope_revision`
- `cancellation`
- `pause`
- `resume`
- `approval_wait`

Why this matters:

- it preserves **ordered traceability** of execution governance requests
- it gives Nous one architectural place for future directives such as:
  - pause
  - resume
  - approval-gated risky continuation
- it avoids hard-coding long-term runtime governance into a growing list of one-off fields

Current policy:

- scheduler dispatch is blocked whenever the intent still has a **requested** blocking execution directive
- when deferred revisions are finally applied at a safe boundary, the matching revision directives become `applied`
- when an intent is cancelled, still-pending scope-revision directives are marked `superseded` rather than silently disappearing
- pause is modeled as **honest task-boundary governance**
  - if no task is active, the intent pauses immediately
  - if a task is already running/assigned, Nous records a requested pause and stops only at the next safe task boundary
- resume is a first-class directive, not an implicit side effect
- risky-boundary approval wait is also part of the same ledger, so post-task human checkpoints are traceable in the same intent-facing governance surface

#### Pause / resume contract

Nous should not pretend it can suspend arbitrary task execution mid-thought and later continue from the exact same continuation point. That would be dishonest with the current runtime.

So the current contract is:

1. **Pause is intent-level, not hidden coroutine suspension**
   - current running tool/task is allowed to reach the next safe task boundary
   - queued work is preserved, not discarded
2. **Pause stores a resume target**
   - `active`
   - `awaiting_clarification`
   - `awaiting_decision`
3. **Resume restores the correct governance mode**
   - if the paused intent was blocked on clarification/decision, resume returns it to that blocked surface
   - if it was simply active work, resume returns it to `active`

This matters because “pause” is semantically different from:

- `cancel` — abandon the intent
- `clarification` — missing understanding
- `approval_wait` — blocked on an explicit checkpoint

#### Approval-after-risky-boundary contract

The first honest checkpoint model is **after-task, not mid-tool**.

Current policy:

- the runtime records tool-governance evidence for the completed task:
  - used tool names
  - risky tool names
  - rollback plans
- after a task finishes, the orchestrator checks:
  - are there remaining unfinished tasks?
  - did this task use risky tools?
  - does the intent’s `humanCheckpoints` policy require a checkpoint here?
- if yes, the intent enters `awaiting_decision` and appends an `approval_wait` execution directive
- the daemon then produces `Decision(kind=approval)` with producer metadata `risky_boundary`

Why this shape is correct right now:

- it is honest about current runtime boundaries
- it does not fake “interrupt before this exact side effect” semantics
- it still gives Nous a real production checkpoint after non-read-only work

Rejection policy is producer-specific:

- ambient approval rejection may abandon the intent
- risky-boundary approval rejection should usually **pause** the intent instead

#### Real rollback contract

Rollback is no longer only prose/hints.

Current tool contract now distinguishes:

- `rollbackPolicy = none`
- `rollbackPolicy = manual`
- `rollbackPolicy = handler_declared`

And tool results can carry a structured `rollbackPlan`, for example:

- `restore_file`
- `delete_file`
- `manual`

This gives Nous a bounded but real rollback surface:

- `file_write` can now produce automatic rollback plans
  - restore prior contents if the file existed
  - delete the file if the write created it
- `shell` still usually degrades to structured manual rollback

This is still not universal transactional undo. But it is now a **real executable contract**, not only a note field.

This is the runtime-side analogue of `DecisionQueue`: not human-facing coordination, but **intent-facing execution governance**.

#### Free-text stop / cancel routing

Explicit `cancel_intent` protocol is not enough for a persistent assistant. In real threads, the user will also say:

- “stop”
- “别做了”
- “先别继续”
- “never mind”

So the daemon’s thread routers should be allowed to classify a message as:

- decision response
- current-intent scope update
- current-intent cancellation
- new intent
- ambiguous / mixed

Important runtime consequence:

- if the user cancels the current intent from free text while a decision is pending, Nous should **cancel the intent**, not incorrectly treat the message as clarification text
- outstanding pending/queued decisions owned by that intent should be cancelled as well
- after that, the next queued decision in the thread may activate immediately

This keeps thread governance honest: human-facing blockers should not remain stuck behind an intent the user has already cancelled.

#### Tool interruption semantics

Tool definitions now need more than just capability + timeout metadata.

Nous needs each tool to declare:

- `sideEffectClass`
  - `read_only`
  - `write`
  - `destructive`
- `idempotency`
  - `idempotent`
  - `best_effort`
  - `non_idempotent`
- `interruptibility`
  - `cooperative`
  - `after_tool`
  - `never`
- optional rollback hint / rollback policy

This is important because “can the process be stopped?” and “is it safe to stop here?” are **different questions**.

Current runtime policy is intentionally conservative:

- if the current tool is `read_only + cooperative`
  - interrupt immediately
- otherwise
  - let the current tool finish
  - then cancel before the next task/tool boundary

This is not full rollback. It is a first honest contract for **bounded interruptibility**.

#### Revision ledger

`intent.workingText` alone is not enough for serious traceability.

Nous now needs a revision ledger on the intent:

- every scope update request gets a revision record
- deferred revisions stay visible even before they are applied
- when execution-boundary replan happens, the corresponding revision entries move from:
  - `requested`
  - to `applied`

This matters because interview-grade traceability requires more than “here is the latest prompt string”.

The runtime should be able to answer:

- what changed
- when it changed
- whether it was applied immediately or only at a later safe boundary
- what prior work had already completed before the replan

### Runtime Harness / Task Driver Chain

The runtime harness in Nous is not a single helper class wrapped around an LLM call. It is a **layered driver chain**.

Classic agent frameworks often compress all of this into one loop:

```text
LLM -> tool_use -> execute tools -> append results -> LLM
```

Nous still has that inner loop, but it lives inside a larger task-completion system:

```text
User / Sensor signal
  │
  ▼
Dialogue + Daemon
  - accept message / channel / thread
  - preserve continuity
  - persist message and outbox state
  │
  ▼
Orchestrator
  - user-state grounding
  - intent parsing
  - task contract formation
  - execution-depth selection
  - DecisionQueue production when blocked
  │
  ▼
DecisionQueue
  - clarification / approval / scope confirmation / conflict resolution
  - queue policy: one pending decision per thread
  - resume policy: resolve -> apply owner action -> activate next queued item
  │
  ▼
Task Scheduler
  - task DAG / dependency order
  - retry / timeout / sequencing
  - waits until a task is actually ready
  │
  ▼
Agent Runtime
  - the inner ReAct harness
  - Think -> Act(tool_use) -> Observe(tool_result) -> repeat
  - collect tool-governance evidence for the completed task
  │
  ▼
Tool Executor
  - capability check
  - permission enforcement
  - real side-effect execution
  - structured rollback-plan production / execution
  │
  ▼
Persistence + Delivery
  - events
  - task / intent / decision state
  - memory capture
  - outbox delivery back into the thread
```

#### Key architectural point

So in Nous:

- **`AgentRuntime` is the inner LLM/tool harness**
- **`Daemon + Orchestrator + Scheduler + DecisionQueue` are the outer task driver**
- **task-boundary governance lives between them**
  - pause finalization
  - approval-after-risky-boundary
  - revision-at-boundary application

This split is deliberate.

If we collapse all of this back into a single harness loop, Nous drifts toward a workspace-bound command runner. If we keep the layered driver chain, Nous can preserve:

- thread continuity
- intent identity
- human governance
- long-running execution
- delivery continuity
- auditability

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
    gitStatusDetail: string[];     // Short `git status --short` lines
    packageManager?: string;       // "bun" | "npm" | "pip" | "cargo" | ...
    language: string;
    framework?: string;
    directoryTree: string;         // Top 3 levels, truncated
    readmeSnippet?: string;        // First 200 lines of README
    configFiles: string[];         // Which config files exist
    localNousConfigFiles: string[];// `.nous/*.json` files in scope
  };
  user: {
    recentMemoryHints: string[];      // Compact packed retrieval hints
    activeIntents: Intent[];          // What the user is currently working on
    scopeLabels: string[];            // Channel / workspace labels
  };
  permissions: {
    autoAllowed: string[];
    approvalRequired: string[];
    denied: string[];
    explanation: string;              // Why Nous can / cannot act here
  };
}
```

**Context Assembly is cheap.** Environment and project context are gathered via filesystem reads and shell commands (no LLM calls). User context comes from the RAG pipeline. The permission system also contributes a **human-readable boundary summary**, so Nous can explain why it can or cannot act in the current scope instead of treating permissions as invisible runtime-only state. The total overhead is still kept low enough for every-run assembly.

---

## Tool System (3-Tier Architecture)

Current agent frameworks ship with a fixed set of tools. If the tool you need doesn't exist, you're stuck. Nous has a **3-tier tool architecture** where the system can create new tools for itself.

**Production rule:** a Tool is not just a callable. Every Nous tool contract should eventually carry:

- schema / argument validation
- side-effect class (`read_only` / `write` / `destructive`)
- idempotency expectation
- timeout / retry policy
- output budget and compaction policy
- provenance and audit hooks

Without this metadata, "tool use" quickly degrades into prompt folklore and unsafe retries.

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

### MCP Boundary — External Capability Interop, Not Internal Ontology

The industry is converging on **MCP** as the standard way to expose external tools and context. This is useful, but the architectural lesson is precise:

> **MCP should be a Nous interoperability boundary, not Nous's internal ontology.**

MCP standardizes:

- lifecycle negotiation
- transports (`stdio`, streamable HTTP, etc.)
- auth at the transport edge
- three server primitives:
  - **tools** (actions)
  - **resources** (context/data)
  - **prompts** (reusable interaction templates)

That is valuable, but it does **not** decide:

- whether a server is trusted
- whether a tool is safe to auto-run
- how much server output should enter context
- whether a prompt should become a reusable Nous Skill
- how provenance, scope, and governance should be attached

So Nous should map MCP into its own architecture as follows:

| MCP primitive | Nous interpretation |
|---------------|---------------------|
| MCP Tool | External ToolAdapter candidate in the ToolRegistry |
| MCP Resource | Context source / retrievable artifact, not blindly pasted into the prompt |
| MCP Prompt | Explicit PromptAsset input, not automatically promoted to a Skill |

**Non-negotiable MCP gates for Nous:**

1. **Server identity + trust registry**
   - every configured MCP server has a durable identity, transport type, auth mode, and trust state
2. **Scope-aware exposure**
   - a server may be attached only to a thread / task / subagent / project scope, not necessarily the whole runtime
3. **Tool filtering**
   - only allowlisted tools are exposed to the model; "connect the server" is not the same as "expose every tool"
4. **Session policy**
   - Nous must choose explicitly between stateless calls and stateful MCP sessions
5. **Output discipline**
   - large MCP outputs must go through budget, truncation, summarization, or artifact storage instead of flooding the main context
6. **Audit + provenance**
   - every MCP call records which server, which transport, which auth context, and what artifact/result entered memory or context

**Important context-engineering implication:** large MCP tool inventories should not all be injected into the main agent context up front. Discovery may need to be:

- lazy / search-based
- scoped to a specialized subagent
- cached with explicit invalidation policy

This preserves context budget and reduces tool-selection noise.

---

## Perception Pipeline: From Environment to Action

Perception alone is not enough. If Nous is supposed to feel like a proactive, considerate personal assistant, it cannot stop at "detect signal → maybe create task." It also needs a **background reflective layer** that revisits memory, commitments, timing, and user state to ask:

- what might the user need right now?
- what is worth reminding, celebrating, or gently checking in on?
- what should stay silent for now but remain watch-listed?

So the proactive path runs **continuously in parallel** with the request path, but in two stages:

1. **cheap continuous sensing / triage**
2. **smarter lower-frequency reflection / synthesis**

```
Environment / Time / Dialogue / Memory / Commitments
  │
  ├─ files, git, calendar, email, screen
  ├─ pending prospective memories
  ├─ recent task outcomes
  └─ thread / user-state changes
  │
  ▼
L4 Signal Producers
  │  stateless sensors + scheduled watchpoints
  │
  ▼
L3 Perception Log + Reflection Inputs
  │  append-only raw signals
  │  plus agenda-worthy memory/prospective cues
  │
  ▼
Stage A — Signal Triage / Attention
  │  high-frequency, cheap
  │  heuristics + small/fast model where needed
  │  outputs:
  │    - discard
  │    - log
  │    - add to reflection agenda
  │    - promote immediately if clearly actionable
  │
  ▼
Stage B — Proactive Cognition / Background Reflector
  │  lower-frequency, smarter
  │  stronger LLM synthesis over:
  │    - selected signals
  │    - retrieved memories
  │    - prospective commitments
  │    - relationship boundary / interruptibility policy
  │
  ▼
Proactive Candidates
  │
  ├─ check_in
  ├─ celebration
  ├─ reminder
  ├─ suggestion
  ├─ offer
  ├─ ambient_intent
  └─ silent_watchpoint
  │
  ▼
Governance + Delivery
  │
  ├─ low-risk async message → outbox / notification
  ├─ needs consent → DecisionQueue
  ├─ actionable and allowed → Ambient Intent → normal intent pipeline
  └─ not yet appropriate → store as watchpoint / defer
```

### Background Reflector / "Memory Rover"

This reflective layer is the architectural home for the "后台记忆漫游器" idea.

It should **not** be a random walk over the whole memory store. It should be **agenda-driven**, revisiting questions such as:

- what promises or paused items still need closure?
- what repeated friction suggests the user is stuck?
- what recent progress is worth encouragement or celebration?
- what upcoming commitment or deadline needs a timely reminder?
- what environment change matters in light of the user's current goals?
- when is silence more respectful than interruption?

This is where a stronger model belongs. Raw signals are too frequent for an expensive model on every tick; reflective synthesis is not.

### Not every proactive act is an Intent

`AmbientIntent` remains important, but it should be treated as only **one subtype** of proactive output.

Many valuable assistant behaviors are not tasks:

- "You made real progress on this today — nice work."
- "You said this deadline matters; do you want me to summarize what remains?"
- "You've paused this for a while. Should I help you reopen it?"

If Nous collapses all of these into tasks, it becomes a workflow machine instead of a considerate assistant.

### Cost and backpressure rules

The system still needs bounded always-on cost:

- **Signal producers** must remain cheap and mostly stateless
- **Stage A triage** handles high-volume filtering and backpressure
- **Stage B reflection** runs only:
  - on promoted agendas
  - on periodic reflection ticks
  - or on high-value state changes

Each Sensor still has an `emitRateLimit`. If raw signals arrive faster than Stage A can process them, they are buffered in the Perception Log; oldest unprocessed signals can be dropped with a `signal.dropped` event. The stronger reflective layer should never be the first line of defense against raw volume.

**Current implementation note:** today's codebase still implements only the early skeleton of the full design, but the skeleton is now less toy-like:

- FS/Git sensors exist
- idle-first heuristic attention exists
- redundant `git.status_changed` notices can be suppressed after a stronger file-change promotion
- ambient notices are threaded by workspace instead of one undifferentiated global stream
- file-type-specific safe follow-up suggestions exist for tests / deps / config / docs / sensitive config
- a first **agenda-backed reflection runtime** now exists:
  - promoted signals are persisted as `ReflectionAgendaItem`s instead of only being handled inline
  - periodic reflection ticks exist in the daemon
  - due prospective commitments can become agenda items too
  - the reflective step can retrieve memory before deciding whether to emit:
    - silence
    - a proactive message
    - an ambient intent candidate
  - proactive candidates are now queued with basic cooldown / quota governance before delivery

The full target architecture still adds the agenda-driven reflective layer and richer proactive candidate family described above.

### Runtime contract: Agenda → Reflection → Candidate

The three core runtime objects fit together like this:

```
Signal / memory / commitment change
  │
  ▼
ReflectionAgendaItem
  │  created by triage, scheduler, or memory/prospective producers
  │
  ▼
Memory Rover / ReflectionRun
  │  retrieves context
  │  reasons under budget
  │  consults RelationshipBoundary
  │
  ▼
ProactiveCandidate
  │
  ├─ dialogue / notification
  ├─ DecisionQueue
  ├─ AmbientIntent
  └─ silent_watchpoint
```

This separation matters:

- `ReflectionAgendaItem` answers: **what deserves thought?**
- `RelationshipBoundary` answers: **what kind of initiative is welcome?**
- `ProactiveCandidate` answers: **what, if anything, should be surfaced or done now?**

Without this split, the system tends to collapse:

- agenda into raw signal spam
- relationship into hidden prompt vibes
- proactive output into over-eager task creation

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

### Nous 的 Process Surface / Structured Process Visibility

Unified Presence solves **who** the user is talking to. It does **not** automatically solve **how trust is maintained while work is happening**.

That second problem appears the moment Nous becomes slower, deeper, and more autonomous than a simple chat completion:

- the user submits one message
- Nous does intent recovery, context assembly, memory retrieval, planning, tool execution, and decision routing
- several seconds or minutes may pass before a final answer exists

If the user cannot see what is happening, the interaction feels broken:

- “Did it route my message into the right thread?”
- “Did it recover the original intent after clarification?”
- “Did it load the right memory or project context?”
- “Is it stuck, or is it working?”

But the opposite extreme is also wrong. We should **not** dump raw internal events like:

- `Task started: task_01...`
- `task.completed`
- opaque internal ids
- every low-level event tick

That creates noise, not trust.

So Nous needs a distinct architectural layer:

> **Process Surface = the governed, user-facing projection of internal execution.**

It is the translation layer between:

- raw runtime/orchestrator events
- and a human-comprehensible interaction trace

This is the same product lesson visible in tools like **Codex** and **Claude Code**:

- they do **not** hide planning / tool usage / progress
- but they also do **not** expose raw event logs as-is
- instead they render a structured process lane:
  - `Updated Plan`
  - `Ran ...`
  - `Explored ...`
  - `Worked for ...`
  - final answer clearly separated from process commentary

Nous should follow the same trust principle, but adapt it to our architecture: persistent threads, intent continuity, decision queue, and memory-aware grounding.

#### Why this matters more for Nous than for terminal-only agent tools

Codex / Claude Code are usually used as explicit foreground work sessions. Nous is more ambitious:

- persistent daemon
- cross-channel continuity
- thread recovery
- clarification → restore original intent
- ambient/proactive initiation
- governed decision queue

This means the user must not only trust **execution**, but also trust:

- thread routing
- intent recovery
- memory grounding
- scope interpretation

Therefore Nous needs a stronger surface than “tool call visible” alone. It must show both:

1. **execution process**
2. **resolution process** — how this turn was interpreted and attached to ongoing state

#### Core objects

```typescript
interface TurnResolutionSnapshot {
  turnId: string;
  threadId: string;
  intentId?: string;
  route:
    | "new_intent"
    | "thread_reply"
    | "clarification_resume"
    | "scope_update"
    | "decision_response"
    | "proactive";
  threadResolution: "created" | "continued" | "ambient";
  projectRoot?: string;
  projectType?: string;
  gitStatus?: string;
  focusedFile?: string;
  memoryHintCount: number;
  activeIntentCount: number;
  approvalBoundaryCount: number;
  notes?: string[];
}

interface ProcessItem {
  kind:
    | "trust_receipt"
    | "task_contract"
    | "plan_update"
    | "task_start"
    | "task_result"
    | "tool_call"
    | "tool_result"
    | "decision"
    | "worked";
  title: string;
  summary?: string;
  details?: string[];
  status?: "info" | "running" | "completed" | "warning" | "error";
}

interface AnswerArtifact {
  summary?: string;
  evidence?: string[];
  risks?: string[];
  nextSteps?: string[];
}
```

#### Two lanes, one thread

Every assistant-visible turn should be rendered through two separate lanes:

1. **Process Lane** (`phase = commentary`)
   - turn trust receipt
   - task contract
   - updated plan
   - task/tool progress
   - decision prompts
   - worked-for summary
2. **Answer Lane** (`phase = final`)
   - the actual answer / delivery artifact
   - evidence / risks / next steps when available

This separation is critical. Without it, final answers get polluted by runtime chatter, and runtime chatter gets mistaken for user-facing answers.

#### Channel Presentation Adapter

The Process Surface should not be hard-coded to one UI. Instead:

```text
Orchestrator / Runtime / DecisionQueue
            │
            ▼
      Process Surface
  (TurnResolutionSnapshot + ProcessItem + AnswerArtifact)
            │
            ▼
 Channel Presentation Adapter
   ├─ CLI attach / REPL renderer
   ├─ IDE renderer
   ├─ Web timeline renderer
   └─ debug / inspect surfaces
```

So the persistent source of truth remains message/thread state, but the **presentation contract** becomes structured instead of raw string dumping.

#### Design invariants

1. **Do not hide process**
   - planning / tool usage / progress remain visible
2. **Do not dump raw internals**
   - internal ids and low-level event noise must be translated
3. **Every meaningful turn starts with a trust receipt**
   - show thread resolution, route, and grounding summary
4. **Final answer must be visually distinct from process**
5. **Read-only tool success can be coalesced/suppressed**
   - not every internal success needs a transcript line
6. **Debug surfaces can go deeper than default conversational surfaces**
   - default lane = trust-preserving summary
   - debug lane = inspect routing, memory hits, pending state, process lineage

#### End-to-end turn execution flow

The Process Surface sits in the middle of one full turn, not at the very end as a cosmetic formatter. A typical turn flows like this:

```text
Human message
   │
   ▼
Daemon receives thread message
   │
   ├─ route turn
   │   - new_intent
   │   - thread_reply
   │   - clarification_resume
   │   - scope_update
   │   - decision_response
   │   - proactive
   │
   ├─ build execution context
   │   - project context
   │   - memory hints
   │   - active intents
   │   - permission boundary
   │
   ├─ build TurnResolutionSnapshot
   ├─ emit trust receipt first
   │
   ▼
Surface lane: Turn Context
   │
   ▼
Daemon starts / resumes intent execution
   │
   ▼
Orchestrator
   ├─ intent.intake
   ├─ intent.parsed
   ├─ tasks.planned
   ├─ task.started
   ├─ runtime tool events
   │   - tool.called
   │   - tool.executed
   │   - tool.cancelled
   ├─ task.completed / task.failed / task.cancelled
   └─ intent.achieved / escalation
   │
   ▼
Process Surface projection
   ├─ Task Contract
   ├─ Updated Plan
   ├─ Working On
   ├─ tool process items
   ├─ Worked for ...
   ├─ decision prompts
   └─ final AnswerArtifact
   │
   ▼
Channel presentation adapter
   ├─ process lane
   ├─ answer lane
   └─ decision lane
```

The key point is that the user should see the trust receipt before long-running work starts, and then see governed process updates rather than raw runtime events.

#### Cross-object state machine

The Process Surface is easier to reason about if we separate four cooperating object layers:

1. `Turn`
2. `Intent`
3. `Decision`
4. `Surface Message`

```text
Turn.received
   │
   ▼
Turn.routed
   │
   ├─ new_intent
   ├─ thread_reply
   ├─ clarification_resume
   ├─ scope_update
   ├─ decision_response
   └─ proactive
   │
   ▼
Turn.trust_receipt_emitted
   │
   ├─ if execution path:
   │      attach to intent execution
   │
   ├─ if decision path:
   │      attach to pending decision
   │
   ▼
Turn.closed
```

```text
Intent lifecycle

created
  │
  ├─ needs clarification ───────────────► awaiting_clarification
  │                                        │
  │                                        └─ clarified ► active
  │
  └──────────────────────────────────────► active
                                            │
                                            ├─ risky boundary / scope confirmation /
                                            │  approval / conflict
                                            │    ► awaiting_decision
                                            │
                                            ├─ pause ► paused
                                            ├─ complete ► achieved
                                            └─ cancel / abandoned path ► abandoned

paused
  └─ resume ► active | awaiting_decision | awaiting_clarification
```

```text
Decision lifecycle

queued ► pending ► answered ► resolved
            │          │
            │          └─► superseded
            └────────────► cancelled
```

```text
Surface message lifecycle inside a turn

none
  │
  ▼
process: trust_receipt
  │
  ▼
process: contract / plan / task / tool / status ...
  │
  ├─► decision lane (if the turn blocks on user input)
  ├─► process: Worked for ...
  └─► answer: final artifact
```

One subtle but important distinction: some progress event names are user-facing event labels rather than persisted terminal entity states. For example, cancellation progress may be surfaced as `intent.cancelled`, while the persisted `Intent` terminal state may become `abandoned`. The Process Surface should faithfully explain what happened to the user without forcing the storage model and presentation labels to be identical.

#### Interrupt is boundary control, not semantic rollback

Foreground agent tools often expose an affordance like:

- `working: 1m 52s`
- `esc to interrupt`

The timer is straightforward for Nous: a turn already has a start time, and the Process Surface can project elapsed work.  
The harder question is the meaning of **interrupt** in a persistent assistant architecture.

Nous should **not** define interrupt as:

- "pretend this turn never happened"
- "erase what the runtime already read"
- "undo every external side effect automatically"
- "rollback all intermediate cognition"

That contract would be false.

If Nous is treated more like a persistent assistant than a disposable shell session, then interrupt must respect a human-like asymmetry:

- past perception cannot be un-perceived
- completed side effects cannot be assumed reversible
- partial work may still leave useful or risky traces

So the right contract is:

> **Interrupt stops future execution as quickly and safely as possible; it does not promise semantic time-reversal.**

This means interrupt should be understood as **boundary control**.

#### What an interrupt should actually guarantee

1. **Stop new work from progressing**
   - halt planning continuation, task dispatch, or further tool use as soon as the runtime reaches a safe interrupt boundary
2. **Return control to the user**
   - the system should move from autonomous forward execution back to an explicit waiting / paused / cancelled state
3. **Emit an interruption receipt**
   - the user must be told:
     - interrupt requested
     - whether it was immediate or deferred to a safe boundary
     - what completed before the stop
     - what was skipped / not yet started
4. **Preserve traceability**
   - interrupted work remains part of the execution history
   - it may affect future reasoning, but it should be marked as partial / interrupted rather than silently treated as a normal completed run

#### What an interrupt should not guarantee

1. **No implicit memory erasure**
   - information already seen by the runtime should not be modeled as forgotten
2. **No default durable-memory promotion of partial work**
   - interrupted observations should not automatically become high-confidence long-term memory
3. **No universal rollback promise**
   - rollback is tool- and artifact-specific, not a global semantic guarantee
4. **No conflation with cancellation wording**
   - "interrupt", "pause", and "cancel" are related but not identical user intents

#### Recommended product contract for Nous

The safest v1 framing is:

- **surface-level `interrupt` affordance**
  - available in REPL / TUI / future IDE surfaces as the user's quick "stop and give me control back" action
- **runtime meaning defaults to pause-at-boundary**
  - interrupt should usually compile to:
    - immediate stop if the current boundary is safely interruptible
    - otherwise "stop after current tool / task boundary"
- **explicit `cancel` remains stronger and rarer**
  - cancel means the user wants the current intent abandoned, not merely paused for redirection
- **rollback remains explicit and artifact-specific**
  - if a tool or artifact supports rollback, the system may offer it
  - but interrupt itself does not imply rollback

This is already directionally compatible with the current architecture:

- runtime interrupt requests can be:
  - immediate
  - after current tool
- orchestrator already models:
  - `pause`
  - `cancel`
  - approval / resume boundaries

So v1 should avoid inventing a magical new ontology. Instead, Nous should expose **interrupt as a governed surface verb** that compiles onto the existing boundary-aware control model.

#### Process Surface implications

If Nous later exposes live `working ...` timers, it should also expose interrupt receipts in the same structured surface:

- `Interrupt Requested`
- `Waiting for Safe Boundary`
- `Paused`
- `Cancelled`
- `Partially Completed Before Interrupt`

This keeps the user-facing story honest:

- Nous can stop continuing
- Nous can explain what happened
- Nous cannot truthfully claim that partially completed cognition or committed side effects were never real

#### Three implementation phases

**Phase 1 — Turn / trust structure**
- add `turnId`, `presentation`, `phase`, `trustReceipt`, `processItem`, `answerArtifact`
- stop exposing raw `Task started: task_xxx`
- emit `TurnResolutionSnapshot` at the start of meaningful work

**Phase 2 — Rendered process lane**
- render Codex-like process items:
  - `Updated Plan`
  - `Working On`
  - tool calls/results
  - `Worked for ...`
- suppress noisy read-only success items
- keep final answer separate

**Phase 3 — Inspect / trust debugging**
- let `nous debug thread ...` reveal:
  - recent turns
  - route / trust receipt
  - process items
  - final answer summaries
- make it easy to verify whether Nous attached the message to the right thread/intent/memory surface

This layer is not “just UI polish”. It is a core trust boundary for a persistent assistant runtime.

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
| Perception | None | None | None | Sensors + staged proactive cognition + ambient intent |
| Personal assistant quality | Workspace/task centric | App/developer centric | Goal loop centric | Personal-first: continuity, memory, proactive cognition, relationship-aware governance |
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
- Nous: Start from an **operating-system-grade substrate**, then shape it into a **persistent personal assistant** that can later federate.

The latter is more structurally sound. An OS-first design gets reliability, scheduling, isolation, and observability as substrate; the personal-assistant layer adds care, continuity, and initiative. Both are first-class in the Nous design.

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

##### Skill Is Not the Same Object as a Prompt, Plugin, or Subagent

Many production systems blur together four different things:

1. reusable prompt template
2. plugin / MCP capability package
3. specialized subagent
4. learned skill

Nous should keep them separate.

| Object | What it is | What it is not |
|--------|-------------|----------------|
| **PromptAsset** | Versioned instruction template with variables, metadata, and model/provider hints | Not evidence that the workflow is validated |
| **Plugin / MCPServer** | External capability packaging and transport surface | Not proof that the capability should be auto-used |
| **Subagent profile** | Isolated runtime configuration: prompt, tools, model, permission mode, memory scope | Not automatically a reusable competence artifact |
| **Skill** | A governed reusable execution policy distilled from successful experience | Not just "a nice prompt" or "a server with tools" |

**A Nous Skill may reference all three of the other objects**:

- load one or more PromptAssets
- constrain execution to a specialized subagent profile
- attach or prefer specific MCP servers / tool subsets

But the Skill remains the higher-level governed object because it additionally carries:

- trigger / applicability conditions
- scope
- provenance
- validation state
- expected cost / latency profile
- failure patterns and anti-patterns

This separation matters. If Nous collapses Skill, PromptAsset, plugin, and subagent into one object, it loses the ability to answer:

- "Is this reusable pattern actually validated?"
- "Is this just a packaging format, or a learned competence?"
- "Can I trust this across projects or export it to another instance?"

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

This is the **destination architecture** for collective intelligence. But collective intelligence must be understood correctly:

> it is **not** a supra-user hive mind with local terminals attached.
> it is a **federation of personal-first Nous instances**.

Each local Nous remains loyal to its own human first. The network exists to make that local assistant wiser and more capable, not to drain raw intimacy into a central brain.

The important v1 rule is that even before full networking exists, a local Nous instance must already model the right primitives — **Instance identity, Scope boundaries, Provenance, Skill validation, CommunicationPolicy, and local/private vs shareable/public boundaries**. Otherwise inter-Nous exchange would require rewriting local assumptions instead of extending them.

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

**Decision: LLM-agnostic at core, OpenAI-first for v1 runtime, provider-neutral structured generation for control-plane objects.**

```typescript
// Core defines an abstract LLM interface — no provider-specific types leak through
interface LLMProvider {
  chat(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<StreamChunk>;
  getCapabilities(): LLMProviderCapabilities;
}

// v1 ships with multiple implementations behind the same contract
class OpenAIProvider implements LLMProvider { ... }
class OpenAICompatProvider implements LLMProvider { ... }
class AnthropicProvider implements LLMProvider { ... }
class ClaudeCliProvider implements LLMProvider { ... }

// Future: Responses API provider, OllamaProvider (local), etc.
```

**Why OpenAI first:** It is the cleanest default backend boundary for current Nous: direct API, explicit base URL/organization/project config, fewer assumptions about an external agent runtime, and better alignment with a persistent daemon-centered architecture. Claude CLI remains valuable, but as a fallback/escape hatch rather than the default substrate.

**How to handle provider differences:** The `ProviderCapabilities` interface lets the Orchestrator and runtime adapt — e.g., if a provider has a smaller context window, Memory compacts more aggressively; if a provider supports native JSON schema output, the control plane uses that instead of prompt-only coercion. Provider-specific features are exposed as capabilities, not assumed by the upper layers.

**What this means for v1:** Nous can change provider defaults, add direct/compat endpoints, and keep Claude CLI as fallback without rewriting orchestrator/runtime logic. The provider boundary stays stable even as the transport mix evolves.

#### Provider Compat Kernel

The comparison with OpenClaw surfaced an important engineering lesson:

- the **core `LLMProvider` contract should stay small**
- but the code below that contract must still have explicit structure for
  provider-specific compatibility behavior

OpenClaw solves this with a broad provider-plugin system and many typed hooks.
Nous should **borrow the seam design**, but **not** copy the full plugin
marketplace architecture yet.

For Nous, the right near-term shape is an **internal Provider Compat Kernel**:

```typescript
interface ProviderCompatProfile {
  id: string;
  providerFamily: string;
  wireFamily: string;
  requestPolicy: {
    temperaturePolicy: "pass" | "omit_zero" | "provider_specific";
    structuredOutputFallback: "none" | "json_object_on_400";
    assistantReplayMode: "input_text" | "output_text";
    reasoningEffortPolicy: "pass" | "model_gated" | "omit";
  };
  responsePolicy: {
    messageSelection: "all_messages" | "prefer_final_answer";
    toolCallIdMode: "default" | "provider_specific";
  };
}
```

And below that profile, a few explicit seams:

- `RequestNormalizer`
  - maps generic `LLMRequest` into provider/wire-safe payloads
  - owns proxy-safe stripping / fallback preparation
- `ResponseNormalizer`
  - collapses provider-native output into generic `LLMResponse`
  - owns commentary/final-answer selection and transcript quirks
- `RetryPolicy`
  - decides when to retry, when to fall back, and when to surface the error
- diagnostics metadata
  - every dispatch log should know not only `provider` and `model`
  - but also **which compat profile** was active

**Why this matters:** if Nous keeps solving compatibility only inside large
provider classes, `openai-shared.ts` and future equivalents will slowly become
a pile of special cases. The compat kernel keeps the top-level runtime simple
while still admitting the ugly reality of:

- official APIs vs proxy endpoints
- chat-completions vs responses
- history replay quirks
- structured-output quirks
- streaming/event quirks

**Current implementation direction:** start with internal profiles for
`openai` / `openai-compat`, especially for Responses-based proxy routes, and
only promote this into a broader registry/plugin system if Nous later truly
needs large-scale provider breadth, provider-owned auth flows, and provider
marketplace concerns.

#### Structured Generation Contract

Control-plane objects — especially **Intent parsing**, **Task planning**, and later **memory extraction / evolution proposals** — must not depend on ad hoc `"JSON only"` prompting plus `JSON.parse`.

The rule is:

- upper layers declare a **schema + validator**
- providers declare **structured output capabilities**
- runtime owns the **selection / fallback policy**

```typescript
interface LLMRequest {
  messages: LLMMessage[];
  responseFormat?: LLMResponseFormat;   // text | json_object | json_schema
}

interface LLMProviderCapabilities {
  structuredOutputModes: LLMStructuredOutputMode[];
}

class StructuredGenerationEngine {
  generate<T>(spec: StructuredOutputSpec<T>): Promise<T>;
}
```

**Why this matters architecturally:** structured output is not prompt craft; it is a **runtime contract**. If each subsystem hand-rolls its own `"return JSON"` prompt and parser, Nous becomes provider-fragile. A provider-neutral structured generation layer keeps the control plane stable while allowing each backend to use its strongest native mechanism:

- OpenAI → `json_schema` / `json_object`
- Claude CLI → `--json-schema`
- weaker providers → prompt-only fallback with validation + repair loop

This keeps the **semantic contract** at the top and the **transport-specific enforcement** at the provider boundary, which is the right architectural split.

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

#### Self-describing CLI control surface

As the CLI grows, a familiar failure mode appears:

- users cannot remember command names
- `/` menus become long and noisy
- hidden features stay hidden unless the user already knows they exist
- natural-language control gets implemented as a parallel ad hoc parser
- docs, help text, REPL menus, and runtime capability answers drift apart

This is not fundamentally a "menu design" problem. It is a **control-surface modeling** problem.

The real question is:

> can Nous explicitly know what control operations it exposes, in a way that humans, renderers, and the runtime can all query?

The architecture should therefore distinguish two planes:

1. **Task plane**
   - normal user requests and thread conversation
   - routed through the task-intake / intent pipeline
2. **Control plane**
   - explicit operations over the Nous runtime itself
   - status, attach, debug, permission changes, network exchange, discovery, REPL session controls

The control plane should not be encoded only in:

- `if (command === "...")` branches
- hand-written help text
- a giant slash-command list
- an LLM prompt that "knows" the commands informally

Instead, Nous should expose a first-class **OperationCatalog**.

```typescript
interface OperationCatalogEntry {
  id: string;                          // "daemon.start", "thread.attach", ...
  title: string;
  summary: string;
  category:
    | "core"
    | "daemon"
    | "thread"
    | "inspect"
    | "permissions"
    | "network"
    | "discovery"
    | "session";
  surfaces: Array<"cli" | "repl">;
  syntax: string[];                    // e.g. ["nous daemon start", "/attach <threadId>"]
  examples?: string[];
  tags?: string[];                     // search / discovery keywords
  requiresDaemon?: boolean;
  requiresThread?: boolean;
  foregroundOnly?: boolean;
  sideEffectClass?: "read_only" | "state_change";
}
```

This catalog becomes the single source of truth for:

- `nous --help`
- `nous help [query]`
- REPL `/help`
- REPL `/commands [query]`
- future IDE/Web command palettes
- natural-language control routing
- "what can you do here?" capability discovery
- CLI documentation

#### Control-intent router

Inside the REPL, not every line should go straight into the task plane.

The system should first run a lightweight **control-intent router**:

```text
raw REPL input
   │
   ├─ slash command? ─────────────► resolve deterministically from OperationCatalog
   │
   ├─ high-confidence control intent?
   │    e.g. "show daemon status", "attach to thread_123", "what can you do here?"
   │    └─► map to catalog operation
   │
   ├─ medium-confidence control intent?
   │    └─► ask for clarification
   │
   └─ otherwise
        └─► treat as normal thread message / task-plane input
```

This means natural-language control should map to **structured operations**, not directly to arbitrary shell commands and not directly to free-form prompt behavior.

#### Key invariants

1. **Resolution first, execution second**
   - natural language may help identify the intended control operation
   - once resolved, execution should be deterministic and explicit
2. **Natural-language control is a router, not a replacement runtime**
   - it chooses an operation from the catalog
   - it does not invent new hidden control primitives
3. **Low confidence must fall back safely**
   - either clarification
   - or normal task-plane routing
   - never dangerous silent misexecution
4. **Discovery must be context-aware**
   - "what can you do here?" should depend on:
     - whether the daemon is running
     - whether a thread is attached
     - whether an operation is foreground-only
     - whether the current client surface is CLI or REPL
5. **Docs/help/menu/discovery must share the same source**
   - otherwise the control plane fragments immediately

#### Why this is better than a bigger slash menu

A slash menu is still useful, but only as a renderer.  
It should not be the underlying model.

If the catalog exists, then:

- `/commands` becomes a query UI over the catalog
- natural-language "what can you do?" becomes another query UI over the same catalog
- docs become a rendered artifact from the same source
- future clients can present the same operations differently without redefining them

Without the catalog, every surface grows its own shadow protocol.

#### Recommended v1 rollout

1. Create an initial `OperationCatalog` for the current CLI / REPL control surface
2. Render CLI help and REPL help from it
3. Add `/commands [query]` as a richer discovery surface
4. Add lightweight natural-language control routing in the REPL
5. Keep execution grounded in explicit handlers rather than free-form LLM action generation

This keeps the command surface learnable without regressing Nous back into a command-only tool. Users can still speak naturally, but the runtime remains architecturally explicit about what control operations exist.

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

### 8. Testing, Harness, and Evaluation Strategy

**Decision: four-layer testing plus an explicit agent harness/eval flywheel.**

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

Layer 3: Scenario Harness (system-level, controlled runtime)
  - Run repeatable end-to-end scenarios through the daemon/runtime
  - Includes thread attach/reconnect, approvals, interrupts, MCP stub servers,
    ambient perception signals, memory retrieval, and failure injection
  - Assert on trace structure, state transitions, artifact outputs, and
    human interruption counts
  - Deterministic where possible; fault-injection driven where necessary

Layer 4: Live Eval Harness (real LLM, optional but essential)
  - Run against real API with a budget cap ($5/run)
  - Use curated datasets + harvested production traces
  - Score with code rules, human review, and trace grading
  - Compare prompts / models / skills / tool policies
  - Non-deterministic — used for validation and release readiness, not every PR gate
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

**Why the Harness matters:** production Agent failures often live above the unit-test layer:

- context compaction dropped the wrong fact
- a permission gate fired at the wrong time
- an MCP server timed out or exposed too many tools
- a human approval pause failed to resume correctly
- the agent technically "succeeded" but required too many clarifications or tool loops

These are **workflow-level** failures. They need a Harness, not just unit tests.

#### Harness principles

1. **Every major capability gets at least one scenario harness**
   - daemon continuity
   - memory retrieval
   - tool approval
   - MCP interop
   - ambient intent
   - multi-agent handoff

2. **Harness output feeds evaluation**
   - failing scenarios become regression cases
   - interesting live traces are promoted into eval datasets

3. **Evaluation is trace-aware, not only final-answer-aware**
   - final output quality matters
   - but so do tool choice quality, interruption rate, unsafe-action rate, and wasted-token loops

4. **Skill and prompt evolution must pass through the Harness**
   - a changed prompt or new skill is not trusted because it "felt good once"
   - it earns trust by surviving repeatable scenario runs

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

**Decision: Centralized pool hosted by Nous project for v1, but only for governed shareable artifacts. Validation-based trust scoring. Reciprocity incentive.**

**v1 architecture:**

```
Nous Project hosts:
  - Shared Procedural Pool (Postgres + pgvector, hosted)
  - REST API for contribution/retrieval
  - Only shareable-shell artifacts enter the pool:
      - validated skills
      - anonymized pattern summaries
      - governed eval/harness outcomes
      - approved collective proposals
  - Raw private-core data never enters:
      - raw dialogue transcripts
      - user-state reflections
      - relationship judgments
      - intimate episodic memories
  - No P2P in v1 — all exchange goes through the pool

Why centralized for v1:
  - Dramatically simpler to build and debug
  - Easier to enforce quality (one place to validate patterns)
  - Privacy auditing is centralized (one system to secure)
  - Matches Phase 2 star topology from Communication Architecture
```

**Privacy verification:** Before a pattern is accepted into the pool, an automated LLM-based privacy scan checks for PII, file paths, usernames, API keys, project-specific references, and over-personalized relational context. Patterns that fail are rejected with an explanation. This is not perfect (LLM-based detection has false negatives), so v2 adds a formal differential privacy layer plus stricter artifact-type gates.

**Incentive model:** Reciprocity. A Nous instance that only consumes patterns without contributing gets rate-limited on retrieval. Contribution score = `patterns_shared * avg_validation_score`. Top contributors get priority access. This mirrors academic citation: you publish to gain access to the community's knowledge.

**Adversarial pattern injection:** Every shared pattern starts at `confidence: 0.1`. It only rises when other Nous instances independently validate it (the pattern worked in their context too). A malicious pattern that doesn't actually work will never rise above the noise floor. Patterns below `confidence: 0.3` after 30 days are auto-pruned.

---

### 14. Inter-Nous Communication Infrastructure

**Decision: Cloudflare Workers for relay in v1. libsodium for E2E encryption. Relay-assisted tunneling (no STUN/TURN). Matrix-inspired federation for v2.**

**Personal-first invariant:** networking is always an extension of the local assistant, never its owner. A user can fully disable the network and still retain a complete Nous. Enabling the network increases optional collective reach; it does not redefine the local system's identity or duties.

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

**Goal:** A single-user Nous that already feels like a **proactive, considerate, reliable personal assistant**: it can receive an intent, decompose it into tasks, execute them with agents, and learn from the results. **Ambient / proactive cognition is in MVP** — the perception pipeline ships from day one as a core differentiator. The Relay Network may exist from Day 1 as groundwork, but the first product truth is local assistant quality, not network activity.

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
L0: Proactive cognition skeleton         Calendar/email/screen sensors
L1: Task DAG planner                     Multi-strategy routing
L1: Task Scheduler + state machine       —
L1: Agent Router (single strategy)       —
L1: Context Assembly (env + project)     User context from RAG (needs memory)
L1: Signal triage / attention            Full reflective cognition loop
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
