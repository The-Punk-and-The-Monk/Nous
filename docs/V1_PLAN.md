# Nous V1 Completion Plan

This document turns the current architecture into a **finish line**, not just a direction.

V1 should not mean "we built every dream in the architecture".  
It should mean:

> **A single-user, local-first, persistent Nous that behaves like one continuing agent runtime, can perceive its environment, retrieve useful memory, execute bounded work, and leave the right substrate for later evolution and inter-Nous exchange.**

That definition keeps the North Star intact while preventing the build from dissolving into an endless "future system" backlog.

---

## 1. V1 Hard Boundary

### V1 must ship

1. **Persistent Runtime**
   - daemon is the runtime center
   - CLI is a thin client
   - threads, messages, outbox, and attach semantics are real

2. **Unified Presence, Scope-Aware Cognition**
   - one Nous identity
   - multiple channels can exist in principle
   - context assembly respects project/scope boundaries

3. **Useful Work Loop**
   - submit intent
   - plan tasks
   - execute bounded tool/model work
   - surface progress/results
   - survive client disconnect/reconnect

4. **Ambient Awareness**
   - FS/Git perception
   - attention filtering
   - ambient notification
   - conservative ambient auto-submit for low-risk investigation

5. **Memory Foundation**
   - memory retrieval is no longer FTS-only in architecture direction
   - V1 should land the minimum semantic retrieval substrate needed for "remember and reuse"

6. **Governed Local Assets**
   - `~/.nous` home exists
   - config / logs / skills / artifacts / caches / file-based secrets all have explicit boundaries
   - runtime state stays in structured stores

7. **Evolution Seed, Not Full Autonomy**
   - execution traces and procedure candidates exist
   - skill crystallization can begin locally
   - but unrestricted self-modification is not required for V1 ship

### V1 does not need to fully ship

- full multi-tenant architecture
- mature encrypted secret store
- autonomous code mutation without human review
- rich Web/IDE clients
- large-scale federated network

Those remain important, but they are not allowed to blur the V1 cut line.

---

## 2. Current Status vs. V1

| Area | Status | Notes |
|------|--------|------|
| Daemon + dialogue + outbox | **Shipped for V1** | real daemon, attach, live push, outbox replay, reconnect continuity |
| Context assembly | **Shipped for V1** | cwd/project/git/active-intent + retrieved memory hints feed the system prompt |
| Perception + ambient | **Shipped first V1 slice** | FS/Git perception + attention filter + conservative ambient auto-submit |
| Conflict handling | **Good enough for V1** | resource-level sequencing + heuristic semantic conflict detection |
| Memory / RAG | **Closed for V1 seed** | local semantic-hybrid retrieval now influences context assembly |
| Permission system | **Shipped static boundary** | file-backed policy, CLI inspection/mutation, runtime/tool enforcement |
| Evolution substrate | **Shipped seed** | execution traces, procedure candidates, validation threshold, local procedure materialization |
| Network / inter-Nous | **Shipped seed** | instance identity + communication policy + procedure-summary export/import |
| Secrets boundary | **Shipped V1 path** | file-first SecretStore abstraction with env override |

---

## 3. Remaining Work Packages

## WP1 — Close Sprint 5 Properly: Live Daemon Interaction

### Goal
Make the daemon feel like a continuing Nous, not a request/response shell with persistence around it.

### Must finish
- live push delivery on attached channel
- better REPL continuity across one thread
- stronger daemon status / inspect surfaces
- reconnect replay that is visibly correct
- explicit pending-review / sequencing feedback in thread

### Exit signal
- submit one intent, disconnect client, reconnect later, and see accurate thread/result state without ambiguity

---

## WP2 — Sprint 6 Core: Memory Retrieval That Actually Remembers

### Goal
Close the biggest remaining intelligence gap.

### Must finish
- embedding storage
- semantic retrieval
- hybrid retrieval path (keyword + semantic)
- chunking strategy for memories / docs / prior traces
- retrieval integration into context assembly

### Not required for V1
- perfect memory metabolism
- sophisticated graph reasoning

### Exit signal
- a second run can retrieve semantically relevant information from earlier runs, not just lexical matches

---

## WP3 — Sprint 7 Core: Context + Permission Boundary

### Goal
Make scope-aware cognition operational, not just architectural prose.

### Must finish
- richer context assembly from:
  - cwd / project root
  - git status
  - active intents
  - retrieved memory
  - important local config
- file-backed permission rules
- enforcement layer for tool execution / directory access
- `nous permissions` inspection and update path

### Exit signal
- Nous can explain why it can or cannot act in a scope

---

## WP4 — Sprint 8 Closure: Ambient Intent Worth Shipping

### Goal
Turn perception into a real differentiator instead of a background toy.

### Must finish
- more stable perception log model
- suppression / cooldown policy
- better idle/attention policy
- thread surface for ambient notices
- safe ambient follow-up policy

### Exit signal
- realistic repo change triggers a useful, low-noise ambient intervention

---

## WP5 — Sprint 9 Minimum: Evolution Seed

### Goal
Ship the first governed learning loop without pretending we already have full self-evolution.

### Must finish
- execution trace capture
- procedure candidate record
- validation state
- promote a repeated successful pattern into a local skill/procedure artifact

### Exit signal
- one repeated pattern can be promoted into a governed reusable asset

---

## WP6 — Sprint 10 Minimum: Collective Seed

### Goal
Preserve the North Star without forcing premature swarm complexity into the core runtime.

### Must finish
- instance identity
- communication policy
- a thin exchange path for one bounded asset class:
  - skill pattern
  - or procedure summary
  - or anonymized trace pattern

### Exit signal
- two Nous instances can exchange one governed artifact, even if the network is still minimal

---

## 4. Recommended Execution Order From Here

The order below is not arbitrary. It is meant to prevent architectural drift.

1. **Live daemon push + thread continuity**
2. **Semantic/hybrid memory retrieval**
3. **Permission system + richer context assembly**
4. **Ambient intent stabilization**
5. **Execution trace + procedure candidate pipeline**
6. **Single-asset inter-Nous exchange**

Why this order:

- if memory is not closed, perception and evolution stay shallow
- if permission boundary is not closed, autonomous behavior stays unsafe
- if evolution arrives before trace/validation substrate, "self-improvement" becomes marketing rather than governance
- if network arrives before local governed artifacts, we will only exchange noise

---

## 5. V1 Ship Criteria

V1 is done when all of the following are true:

### Runtime
- `nous daemon start`
- `nous "<intent>"` submits to daemon
- `nous attach <thread>` can observe live thread progress
- work continues after client disconnect

### Memory
- Nous retrieves semantically relevant prior information
- retrieved memory actually influences context assembly

### Context / Safety
- permission rules exist, are inspectable, and are enforced
- tool execution is scope-aware

### Ambient
- perception produces useful low-noise ambient interventions

### Evolution seed
- execution traces and procedure candidates are recorded
- at least one reusable local skill/procedure can be promoted with validation state

### Collective seed
- one governed asset can be exported/exchanged between two instances

---

## 6. V1 Completion Note

As of **2026-03-29**, the local-first V1 cut line is considered reached.

That does **not** mean the destination architecture is complete. It means the repo now satisfies the bounded V1 promise:

- one continuing Nous runtime instead of a one-shot shell
- useful memory/perception loop instead of pure stateless prompting
- explicit permission and storage boundaries
- governed learning seed instead of vague “self-improvement”
- governed inter-Nous seed instead of premature full swarm infrastructure

What remains after V1 is a **post-V1 growth track**, not unfinished V1:

1. interactive approval / decision queue instead of static-only permission enforcement
2. stronger RAG pipeline: chunking, reranking, provenance-aware retrieval, better embeddings
3. richer evolution governance: better fingerprints, better validation, real procedure manifests
4. real inter-Nous transport: relay-assisted discovery, encrypted exchange, consultation flows
5. broader clients: IDE / web / mobile channels on top of the same persistent runtime
