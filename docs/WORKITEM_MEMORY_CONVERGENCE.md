# WorkItem / Memory Convergence Plan

Status: mainline architecture convergence decision  
Date: 2026-04-02

This document turns the current continuity discussion into an explicit architectural decision for Nous.

It does three things:

1. defines the **new canonical object model**
2. gives the **ARCHITECTURE.md rewrite map**
3. gives the **repo-specific migration plan**

It also closes one long-running terminology split:

> **Mainline keeps `WorkItem` and drops `Intent` as a separate architecture concept.**

`intent*` names that still exist in code are treated as **legacy implementation names** until migrated.

---

## 0. Why this convergence is necessary

The current architecture has the right raw ingredients, but continuity authority is still too scattered:

- dialogue/thread state carries some continuity assumptions
- live work/runtime maps carry some continuity assumptions
- memory restoration carries some continuity assumptions
- handoff/attach flows still act like partial truth sources

That creates two problems:

1. **semantic sameness is judged in too many places**
2. **`Intent` and `WorkItem` duplicate the same ontology**

The architectural correction is:

- **Dialogue owns transport continuity**
- **WorkItem owns execution continuity**
- **Memory owns semantic continuity**

In other words:

- `attach` is a transport operation
- `thread` is a surface container
- `work` is a governed live execution object
- `memory` decides whether two things are meaningfully related

---

## 1. Canonical object model

### 1.1 Continuity split

Nous should separate three kinds of continuity explicitly.

#### A. Transport continuity

Owned by the dialogue/surface layer.

It answers:

- where did this message arrive?
- which surface is attached?
- what should be replayed?
- what still needs delivery?

Objects:

- `Channel`
- `SurfaceSession`
- `DialogueThread`
- `Turn`
- `MessageOutbox`
- `DeliveryCursor`

#### B. Execution continuity

Owned by the governed work layer.

It answers:

- what is actively being worked on?
- what is blocked?
- what can be paused/resumed/cancelled?
- which decisions belong to which live work object?

Objects:

- `WorkItem`
- `PlanGraph`
- `Task`
- `DecisionTicket`
- `ExecutionLease`
- `Flow`

#### C. Semantic continuity

Owned by the memory layer.

It answers:

- is this new turn related to earlier work?
- is this the same responsibility or only similar wording?
- what old commitments, preferences, or latent obligations matter now?
- what should be injected into context?

Objects:

- `RecallPack`
- `MemoryEntry` families
- `RelationshipMemory`
- `UserModelMemory`
- `SocialHypothesisMemory`
- `WatchpointMemory`
- `ProcedureMemory`

### 1.2 Core mainline objects

#### `SurfaceSession`

```ts
interface SurfaceSession {
  id: string;
  channelId: string;
  threadId?: string;
  subscriptions: string[];
  deliveryCursor?: string;
  status: "connected" | "disconnected";
  createdAt: string;
  lastSeenAt: string;
}
```

Purpose:

- represent one live surface attachment
- own delivery/replay state
- never act as semantic continuity truth

#### `DialogueThread`

```ts
interface DialogueThread {
  id: string;
  title?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  metadata?: {
    surfaceKind?: "cli" | "ide" | "web" | "notification" | "daemon";
    originChannel?: string;
    labels?: string[];
  };
}
```

Purpose:

- group messages into one surface conversation container
- support replay, rendering, and delivery
- not define work identity
- not define semantic sameness

#### `WorkItem`

```ts
interface WorkItem {
  id: string;
  rawRequest: string;
  currentUnderstanding: string;
  goal: StructuredGoal;
  constraints: Constraint[];
  priority: number;
  status: "active" | "blocked" | "paused" | "achieved" | "abandoned";
  userSpaceId: string;
  workspaceId?: string;
  flowId?: string;
  clarificationStateId?: string;
  createdAt: string;
  updatedAt: string;
}
```

Purpose:

- be the only governed-work noun in mainline architecture
- own execution continuity
- preserve original request while allowing understanding to evolve

#### `PlanGraph`

```ts
interface PlanGraph {
  id: string;
  workItemId: string;
  flowId?: string;
  status: "draft" | "active" | "superseded" | "completed";
  topology: "single" | "serial" | "parallel" | "dag";
  planningDepth: "none" | "light" | "full";
  createdAt: string;
  updatedAt: string;
}
```

Purpose:

- keep planning local to one governed work episode
- make replanning explicit instead of overwriting history

#### `DecisionTicket`

```ts
interface DecisionTicket {
  id: string;
  workItemId: string;
  threadId: string;
  kind: "clarification" | "approval" | "conflict" | "scope_confirmation";
  summary: string;
  questions: string[];
  status: "pending" | "resolved" | "superseded";
  createdAt: string;
  resolvedAt?: string;
}
```

Purpose:

- represent a blocking governed checkpoint
- bridge a thread reply back to one live work item
- keep ordinary chat separate from work blocking

#### `RecallPack`

```ts
interface RecallPack {
  query: string;
  threadId?: string;
  workspaceId?: string;
  userSpaceId?: string;

  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
  procedural: MemoryEntry[];
  prospective: MemoryEntry[];

  relationshipBoundary?: RelationshipBoundary;
  userModelFacts: MemoryEntry[];
  socialHypotheses: MemoryEntry[];
  watchpoints: MemoryEntry[];

  relatedWorkItems: Array<{
    workItemId: string;
    rationale: string;
    confidence: number;
  }>;
}
```

Purpose:

- be the **semantic continuity boundary object**
- replace scattered “maybe this is the same thing” heuristics
- give dialogue/work/proactive layers one governed memory answer surface

### 1.3 Memory families that should carry continuity

The continuity-bearing memory families should be explicit.

#### `RelationshipMemory`

Stores:

- tone preferences
- interruption tolerance
- initiative preferences
- delivery preferences
- boundaries around warmth / familiarity / inference

#### `UserModelMemory`

Stores:

- long-term goals
- stable personal constraints
- recurring preferences
- recurring friction patterns
- durable identity facts relevant to assistant behavior

#### `SocialHypothesisMemory`

Stores:

- inferred relationship patterns
- recurring collaborators / stakeholders
- likely social commitments
- people/relationship hypotheses with provenance and confidence

Important rule:

> social-profile memories are **hypotheses**, not truth objects.

They must be revisable, decaying, and attributable.

#### `WatchpointMemory`

Stores:

- latent obligations
- deferred follow-ups
- recurring unfinished themes
- risk markers and “worth checking later” signals

This is the bridge between retrieval and proactive reflection.

### 1.4 Mandatory invariants

1. `attach` never proves semantic continuity.
2. `thread` never proves work identity.
3. `workspace` narrows scope, but does not by itself prove sameness.
4. `WorkItem` is the only governed-work noun in mainline architecture.
5. semantic sameness is resolved through memory retrieval / recall packing.
6. proactive reflection is agenda-driven, not a blind memory walk.
7. every continuity-bearing memory family must support both storage decay and retrieval decay.

---

## 2. ARCHITECTURE.md rewrite map

This section is the explicit rewrite checklist for the main architecture document.

### 2.1 Core Vocabulary

Must change:

- make `WorkItem` the only governed-work noun
- remove `Intent` as an architecture-level concept
- add `SurfaceSession`
- add `RecallPack`
- redefine `DialogueThread` as transport/presentation container only

### 2.2 Layered Architecture

Must change:

- dialogue layer owns replay / delivery / attachments / thread containers
- L0 becomes **Work Intake Plane** conceptually
- memory is named as the semantic continuity authority
- proactive reflection consumes recall, not ad hoc thread/router continuity

### 2.3 Interaction Modes

Must add explicitly:

- transport continuity vs execution continuity vs semantic continuity
- “chat / work / handoff” remains valid
- but handoff becomes packaging/transfer artifact, not semantic truth source

### 2.4 Work model section

Must change:

- `### Intent` -> `### WorkItem`
- `AmbientIntent` -> `AmbientWorkItem`
- `intentId` examples -> `workItemId`
- clarification examples must preserve original request vs current understanding

### 2.5 Memory section

Must deepen:

- `MemoryService` cannot stop at `string[]` hints forever
- retrieval should converge on `RecallPack`
- deeper continuity-bearing memory families must be named
- decay must be specified for both storage and ranking

### 2.6 Proactive section

Must change:

- background reflection should be framed as agenda-driven recall over layered memory
- relationship/user/social/watchpoint memory should be made first-class inputs
- proactive delivery should support:
  - inline prompt injection during dialogue
  - async candidate/digest delivery outside dialogue

### 2.7 Flow section

Must converge:

- every remaining architectural `Intent` in planning/flow sections should become `WorkItem`
- `Flow + WorkItem + PlanGraph` becomes the stable triad
- merge/attach semantics remain explicit governance objects, not thread magic

---

## 3. Repo-specific migration plan

This is the practical migration path from current code to the converged architecture.

### Phase 0 — documentation convergence

Goal:

- make mainline vocabulary unambiguous before large code churn

Actions:

- update `ARCHITECTURE.md`
- land this design note
- record rationale in `docs/DEVELOPMENT_LOG.md`

Deliverable:

- `WorkItem` is canonical in docs even if code still contains `intent*` names

### Phase 1 — remove continuity authority from dialogue/runtime glue

Goal:

- stop using thread/session attachment as semantic truth

Primary files:

- `packages/core/src/types/dialogue.ts`
- `packages/infra/src/daemon/dialogue-service.ts`
- `packages/infra/src/daemon/server.ts`

Changes:

- demote/remove `activeIntentId` / `activeWorkItemId` from thread truth semantics
- demote `threadByIntentId` from semantic authority to transitional live-routing map only
- treat `attach()` as transport attach only
- treat handoff capsule as transfer artifact, not continuity truth

Exit criterion:

- dialogue layer is only responsible for thread/session/outbox/replay/delivery

### Phase 2 — upgrade memory boundary from hint strings to recall packs

Goal:

- move semantic continuity to one governed boundary

Primary files:

- `packages/runtime/src/memory/service.ts`
- `packages/runtime/src/memory/retrieval.ts`
- `packages/infra/src/daemon/server.ts`
- `packages/infra/src/cli/app.ts`

Changes:

- add structured recall APIs such as:
  - `recallForTurn(...)`
  - `recallForWork(...)`
  - `recallForReflection(...)`
- keep `retrieveForContext(): string[]` as compatibility path only while migrating callers
- make execution context assembly consume `RecallPack` rather than only flat hint lists

Exit criterion:

- memory owns semantic continuity decisions

### Phase 3 — rename work ontology in code

Goal:

- remove `Intent` / `WorkItem` duplication from the implementation surface

Primary files / modules:

- `packages/core/src/types/intent.ts`
- `packages/orchestrator/src/intent/*`
- `packages/persistence/*intent*`
- `packages/infra/src/daemon/*`
- tests that still encode `intent*` assumptions

Changes:

- introduce `work-item.ts` / `WorkItem` store / work-item ids
- migrate public type names:
  - `Intent` -> `WorkItem`
  - `AmbientIntent` -> `AmbientWorkItem`
  - `intentId` -> `workItemId`
- keep temporary compatibility aliases only where migration cost requires them

Exit criterion:

- architecture and code use one governed-work noun

### Phase 4 — deepen proactive memory model

Goal:

- make proactive behavior depend on deeper memory, not only recent signals + preference tags

Primary files:

- `packages/runtime/src/proactive/agenda.ts`
- `packages/runtime/src/proactive/reflection.ts`
- `packages/runtime/src/memory/service.ts`
- persistence for proactive and memory metadata

Changes:

- add durable memory families for:
  - relationship memory
  - user model memory
  - social hypotheses
  - watchpoints
- reflection queries these via recall packs
- inline dialogue-time proactive hints and background proactive delivery share the same memory substrate

Exit criterion:

- proactive cognition is recall-driven and relationship-aware

### Phase 5 — formalize decay and metabolism

Goal:

- prevent stale identity/relationship/proactive memories from becoming permanent dogma

Primary files:

- `packages/runtime/src/memory/*`
- `packages/persistence/src/sqlite/memory-store.sqlite.ts`
- metabolism / evolution hooks

Changes:

- define storage decay policy per tier/family
- define retrieval decay weights per family
- allow contradiction / supersession for user and social hypotheses
- add reinforcement signals when recalled memory actually helped

Exit criterion:

- every continuity-bearing memory family can weaken, expire, or be superseded

### Phase 6 — simplify attach / handoff / restoration around memory truth

Goal:

- make cross-surface continuation understandable and minimal

Primary files:

- `packages/infra/src/daemon/server.ts`
- `packages/infra/src/daemon/dialogue-service.ts`
- attach/handoff CLI surfaces

Changes:

- `attach` = transport only
- handoff = packaging only
- restoration = recall + permission/boundary check + explicit live work binding

Exit criterion:

- continuity is no longer scattered across attach/thread/work/handoff heuristics

---

## 4. Naming migration map

### Canonical mainline names

| Legacy / current-code name | Mainline architecture name |
|---|---|
| `Intent` | `WorkItem` |
| `AmbientIntent` | `AmbientWorkItem` |
| `intentId` | `workItemId` |
| `Intent Planner` | `Work Planner` |
| `Intent Plane` | `Work Intake Plane` |
| `threadByIntentId` | transitional live-routing map only; later `threadByWorkItemId` or removed |

### Important nuance

The architecture does **not** mean:

- “memory replaces live work state”
- “threads disappear”
- “session/attach no longer matter”

It means:

- threads/sessions matter for **transport**
- work items matter for **live execution**
- memory matters for **semantic sameness and context recall**

That split is what removes the old duplication without collapsing distinct runtime responsibilities into one bucket.

---

## 5. Final architectural decision

The final convergence decision is:

> **Nous keeps `WorkItem`, removes `Intent` as a distinct architecture concept, and centralizes semantic continuity in layered memory via recall packs.**

Corollaries:

- dialogue no longer owns semantic continuity
- work no longer guesses arbitrary continuity from thread affinity
- proactive runtime becomes deeper-memory driven
- every continuity-bearing memory must decay

This is the simpler and more truthful architecture for a personal-assistant-first Nous.
