# Intent / Continuity Convergence Plan

Status: mainline architecture correction
Date: 2026-04-02

This document records the correction after the short-lived `WorkItem` naming experiment.

## Decision

> **Mainline keeps `Intent` as the only governed execution object.**

`WorkItem` is removed as a parallel noun because:

1. in code it was only an `Intent` type alias
2. it added no new runtime boundary
3. it implied every meaningful user interaction is “a work item”, which is too narrow for Nous

The interaction contract remains:

- not every message becomes an intent
- only **work-mode** inputs become intents
- chat and handoff remain separate interaction modes

---

## Why the `WorkItem` experiment was wrong

The `WorkItem` rename tried to solve a real problem:

- thread is not work truth
- memory should increasingly own semantic continuity
- execution continuity should belong to an explicit governed object

But `WorkItem` was the wrong fix because it changed the noun without changing the runtime boundary.

In practice it created a worse state:

- `Intent` still existed everywhere in code
- `WorkItem` only existed as aliasing / duplicate naming
- docs drifted away from the live implementation
- the name “work item” overfit coding-task execution and underfit broader assistant intent

So the correction is:

- keep the continuity architecture work
- remove the duplicate noun
- converge back on `Intent`

---

## The continuity model we keep

We keep the three-way continuity split, but we express it with `Intent`, not `WorkItem`.

### 1. Transport continuity

Owned by the dialogue layer.

Objects:

- `Channel`
- `SurfaceSession`
- `DialogueThread`
- `MessageOutbox`
- replay / delivery cursors

Questions answered:

- which surface is attached?
- what thread is this message in?
- what needs replay or delivery?

### 2. Execution continuity

Owned by the governed intent layer.

Objects:

- `Intent`
- `PlanGraph`
- `Task`
- `Decision`
- pause / cancel / revision directives
- `Flow` as optional parent governance grouping

Questions answered:

- what is actively being executed?
- what is blocked?
- what can be paused / resumed / cancelled?
- which decision belongs to which live intent?

### 3. Semantic continuity

Owned by memory / retrieval.

Objects:

- layered memory
- promoted continuation memories
- future `RecallPack`
- relationship / user / social / watchpoint memory families

Questions answered:

- is this new message related to a prior responsibility?
- should this revive an older intent?
- what prior facts belong in context now?

---

## Canonical object model

### `Intent`

```ts
interface Intent {
  id: string;
  raw: string;
  workingText?: string;
  goal: StructuredGoal;
  constraints: Constraint[];
  priority: number;
  humanCheckpoints: CheckpointPolicy;
  contract?: TaskContract;
  executionDepth?: ExecutionDepthDecision;
  clarificationQuestions?: string[];
  status:
    | "active"
    | "paused"
    | "awaiting_clarification"
    | "awaiting_decision"
    | "achieved"
    | "abandoned";
  source: "human" | "ambient";
  flowId?: string;
  planGraphId?: string;
  createdAt: string;
  achievedAt?: string;
}
```

### `AmbientIntent`

```ts
interface AmbientIntent extends Intent {
  source: "ambient";
  triggerSignalIds: string[];
  confidence: number;
  requiresApproval: boolean;
}
```

### `Flow`

`Flow` remains useful, but it is **not** the execution truth.

It is a parent grouping / governance object above intents.

Current assessment:

- keep `Flow`
- do **not** make it the primary execution-continuity identity
- use it as a persisted grouping / thread-binding / merge-governance helper

### `PlanGraph`

`PlanGraph` remains intent-local.

The main execution shape is still:

> **Intent-local DAGs, not a single unified global graph**

---

## What changes in code and docs

### Remove

- `WorkItem` type alias exports
- `AmbientWorkItem` alias exports
- duplicate `workItem` field in `TaskIntake`
- duplicate `activeWorkItemId` thread metadata field
- `sourceWorkItemId` naming in handoff metadata
- `workItemId` naming where the real object is already an intent

### Keep

- `Intent`
- `AmbientIntent`
- `Intent Plane`
- `Intent Planner`
- `intentId`
- `sourceIntentId`
- `sourceIntentIds`
- `primaryIntentId` / `relatedIntentIds`

### Clarify

- `Flow` is optional higher-level governance/grouping, not the main runtime identity
- semantic continuity still belongs in memory/retrieval, not thread metadata
- attach/handoff remain transport/packaging operations, not semantic truth sources

---

## Repo-specific migration plan

### Phase 0 — remove the duplicate noun

Targets:

- `packages/core/src/types/intent.ts`
- `packages/core/src/index.ts`
- `packages/core/src/types/task-intake.ts`
- `packages/core/src/types/dialogue.ts`
- tests that assert `WorkItem` or `activeWorkItemId`

Goal:

- make `Intent` the only active governed-work noun in code-facing APIs

### Phase 1 — clean active docs

Targets:

- `ARCHITECTURE.md`
- `README.md`
- this document

Goal:

- active architecture/docs speak in `Intent`
- historical logs may still mention the abandoned `WorkItem` experiment

### Phase 2 — keep continuity work, not the naming detour

Targets:

- memory / retrieval / restoration docs and code
- dialogue metadata authority cleanup
- flow / plan graph semantics

Goal:

- preserve the real continuity improvements
- stop paying the abstraction tax of a duplicate noun

---

## Final rule

When reasoning about the current Nous architecture:

- **Thread** = communication continuity
- **Intent** = execution continuity
- **Memory** = semantic continuity

That is the correct split.

`WorkItem` should not survive as a second first-class concept.
