# Nous Architecture Review Results

Date: 2026-04-05  
Reviewer lane: Ralph mainline execution

This document executes `docs/ARCHITECTURE_REVIEW_CHECKLISTS.md` against the current repo.

---

## Executive Summary

The repo's **system architecture direction is strong**, and this Ralph slice exposed two main follow-through requirements:

1. **continuity terminology is still mixed** across `work continuity`, `semantic continuity`, and emerging `context continuity`
2. **judgment/matching logic needed a first-class governed layer**

The **code architecture is structurally healthy at the package level**, but the live matcher logic is still scattered across:
- `packages/infra/src/intake/interaction-mode-classifier.ts`
- `packages/infra/src/daemon/server.ts`
- `packages/runtime/src/memory/context-continuity.ts`

This review therefore drove a concrete follow-through: the repo now has a shared matcher-policy/config surface in `packages/core/src/types/matching.ts`, with live consumers in interaction-mode classification, context-continuity restoration, memory retrieval, conflict analysis, and relationship-preference detection.

---

## 1. System Architecture Review

| Dimension | Verdict | Findings | Evidence |
|---|---|---|---|
| North-star alignment | Strong | The architecture consistently reinforces personal-assistant primacy, local-first governance, and persistent runtime identity instead of drifting into pure workflow automation. | `ARCHITECTURE.md:152-166`, `ARCHITECTURE.md:196-204` |
| User-side continuity | Partial | The architecture already distinguishes dialogue/thread continuity from semantic/work continuity, but naming is mixed enough that the governing top-level concept is not always obvious. | `ARCHITECTURE.md:347-350`, `ARCHITECTURE.md:2177-2197`, `docs/INTENT_CONTINUITY_CONVERGENCE.md` |
| Execution contract | Strong | `chat / work / handoff` is now explicit in architecture and code, and work governance is constrained to work-mode rather than all messages. | `ARCHITECTURE.md:2149-2165`, `packages/infra/src/intake/interaction-mode-classifier.ts`, `packages/infra/tests/interaction-mode-classifier.test.ts` |
| Context + memory | Strong | Memory is explicitly described as the owner of semantic continuity and restoration is governed rather than thread-derived. | `ARCHITECTURE.md:1571-1593`, `ARCHITECTURE.md:1661-1757`, `packages/runtime/src/memory/context-continuity.ts` |
| Governance + safety | Partial | Restoration and interruption contracts are explicit, and this slice added matcher policy/config, but there is still more room to objectify judgment provenance beyond rationale strings. | `ARCHITECTURE.md:4254-4308`, `packages/core/src/types/matching.ts`, `packages/infra/src/daemon/server.ts`, `packages/runtime/src/memory/context-continuity.ts` |
| Matching / judgment layer | Partial | The architecture discusses semantic layers and retrieval/matching clearly, and the repo now exposes a shared matcher policy/config contract. Remaining gap: richer semantic evaluators still exist only for some seams. | `ARCHITECTURE.md:2291-2418`, `packages/core/src/types/matching.ts`, `packages/runtime/src/matching/policy.ts`, live code in infra/runtime |
| Observability + recovery | Partial | Process/delivery surfaces are strong, but judgment provenance is still mostly textual rationale strings rather than reusable policy-trace objects. | `packages/infra/src/daemon/server.ts`, `packages/infra/src/intake/interaction-mode-classifier.ts` |
| Evolvability | Partial | Package boundaries are good, but future matcher evolution would still require editing multiple modules because there is no unified policy/config seam. | `packages/core`, `packages/runtime`, `packages/infra` |

### System review conclusion

The current system architecture is **conceptually ahead of the code in one specific area**:

> Nous already thought in terms of retrieval/matching/governance layers; this slice turns that into an explicit matcher-governance substrate, but richer semantic evaluators still need to spread further than the current bounded seams.

---

## 2. Code Architecture Review

| Dimension | Verdict | Findings | Evidence |
|---|---|---|---|
| Responsibility boundaries | Strong | Package split is clear: `core` for contracts, `runtime` for memory/tool/runtime logic, `infra` for daemon/config/control surfaces, `orchestrator` for execution flow. | package tree; `packages/*/src` |
| Dependency direction | Strong | `infra` depends on `runtime` and `core`; `runtime` depends on `core`/`persistence`; stable abstractions mostly remain inward. | package manifests/imports |
| State ownership | Partial | Persistent states are explicit, but judgment-related state is still partly encoded in booleans and local helpers (`restorationAllowed`, direct marker checks, pattern arrays). | `packages/infra/src/intake/interaction-mode-classifier.ts`, `packages/infra/src/daemon/server.ts` |
| Orchestration clarity | Strong | The daemon remains a readable execution spine; entry → routing → work/chat handling can be traced. | `packages/infra/src/daemon/server.ts` |
| Side-effect boundaries | Strong | Config loading, persistence, LLM calls, and delivery are reasonably bounded behind services/loaders. | `packages/infra/src/config/home.ts`, runtime services |
| Contract surfaces | Strong | Matcher behavior is now represented as shared contracts/config in `@nous/core`, and infra/runtime consume the same policy surface. | `packages/core/src/types/matching.ts`, `packages/infra/src/config/home.ts` |
| Judgment logic placement | Partial | Interaction mode, context restoration, retrieval, conflict analysis, and relationship preference detection now share one policy vocabulary, but the logic is still spread across several modules because the repo uses multiple execution layers. | `packages/infra/src/intake/interaction-mode-classifier.ts`, `packages/infra/src/daemon/server.ts`, `packages/runtime/src/memory/context-continuity.ts`, `packages/runtime/src/memory/retrieval.ts`, `packages/infra/src/daemon/conflict-manager.ts` |
| Testability | Strong | Policy-mode coverage now exists for interaction mode, context continuity, retrieval ranking, and conflict analysis. | `packages/infra/tests/interaction-mode-classifier.test.ts`, `packages/runtime/tests/work-continuity-restoration.test.ts` (covers context continuity restoration), `packages/runtime/tests/memory-retrieval.test.ts`, `packages/infra/tests/conflict-manager.test.ts` |
| Change cost | Partial | Central policy/config reduces some blast radius, but continuity terminology still crosses docs + runtime + infra and remains an architecture-wide concern. | grep results on continuity/matching code |

### Code review conclusion

The codebase is **not suffering from general architecture collapse**. The main issue is narrower:

> the matcher/judgment behavior is real, important, and cross-cutting — and the repo now has an explicit code architecture layer for it, even though richer semantic evaluation is still only partially rolled out.

---

## 3. Continuity Terminology Decision

### Decision

> **Yes: `context continuity` should become the governing top-level term.**

### Why

`work continuity` is too narrow for what the architecture is actually protecting. The continuity contract in Nous spans:
- semantic recall
- ongoing execution state
- relationship and preference carryover
- cross-surface restoration boundaries

So the architecture needs a top-level term that is broader than “work”.

### Correct hierarchy

- **context continuity** — the top-level continuity contract across memory, state, relation, and execution-relevant carryover
- **work continuity** — a narrower sub-concept: governed restoration/continuation of active or recoverable work
- **transport continuity** — thread/session/attach/replay continuity

### Impact areas

#### Must update
- active architecture wording in `ARCHITECTURE.md`
- active continuity framing in `docs/INTENT_CONTINUITY_CONVERGENCE.md`
- live runtime/infra exports or file naming where a module actually serves the broader continuity layer

#### May remain historical
- prior development-log entries documenting earlier phases
- old critique text when it is clearly archival/historical

#### Must not collapse
- work-restoration-specific code should still retain a narrower work-specific concept where that precision matters

---

## 4. Live Judgment / Matching Logic Inventory

| Seam | Current shape | Current mode | Configurable? | Review result |
|---|---|---|---|---|
| Interaction mode classification | Pattern arrays + structured signals + optional semantic evaluator | Hybrid | Yes | Shared matcher policy landed |
| Work/context restoration activation | Structured-memory restoration gate under configurable matcher policy | Hybrid | Yes | Safety gates preserved; policy now configurable |
| Relationship preference ingestion | Direct marker detection + rule-family toggles under matcher policy | Hybrid | Yes | Semantic depth still bounded |
| Memory retrieval ranking | Lexical + semantic + scope/provenance scoring under configurable threshold/weights | Hybrid | Yes | Policy now explicit |
| Conflict analysis | Resource-claim heuristics + semantic opposition/dependency rules under matcher policy | Hybrid | Yes | Policy now explicit |

### Immediate implementation priority

For this Ralph slice, the highest-value live seams to govern are:
1. interaction mode classification
2. restoration activation / restoration matching
3. relationship preference detection

---

## 5. Required follow-through from this review

1. Add a first-class matcher-policy contract/config surface.
2. Wire the live seams above into that surface.
3. Rename active broad continuity language toward `context continuity`.
4. Keep `work continuity` only where the concept is explicitly work-restoration-specific.
