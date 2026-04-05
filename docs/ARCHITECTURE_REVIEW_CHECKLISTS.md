# Nous Architecture Review Checklists

Date: 2026-04-05  
Status: active review instrument

This document turns architecture analysis into a repo-native repeatable surface instead of a one-off chat exercise.

---

## 1. System Architecture Review Checklist

Use this checklist when reviewing whether the overall Nous system shape matches the repo's architectural intent.

| Dimension | Review questions | Evidence targets |
|---|---|---|
| North-star alignment | Does the design still reinforce personal-assistant primacy, local-first governance, persistent identity/memory/initiative/execution? | `ARCHITECTURE.md`, `docs/PROGRESS_MATRIX.md`, runtime/daemon contracts |
| User-side continuity | Does the system preserve the right continuity concept across surfaces/time, or is it overfitting thread/work terminology? | `ARCHITECTURE.md`, `docs/INTENT_CONTINUITY_CONVERGENCE.md`, continuity code/tests |
| Execution contract | Is the path from chat/work/handoff → intent/task/decision/delivery explicit and coherent? | `ARCHITECTURE.md`, daemon/orchestrator code, integration tests |
| Context + memory | Is semantic/context continuity owned by explicit memory/retrieval contracts rather than thread illusion? | `ARCHITECTURE.md`, memory service/runtime code |
| Governance + safety | Are approval, restoration, interruption, and policy boundaries explicit rather than hidden in heuristics? | daemon/runtime code, architecture sections on decisions/interrupt/permissions |
| Matching / judgment layer | Are heuristic, semantic, and hybrid judgments modeled explicitly, or buried in local controller logic? | architecture docs, classifier/restoration/preference logic |
| Observability + recovery | Can the system explain why a judgment was made and recover from interruption/restore paths safely? | process surface, dialogue/daemon/runtime code, tests |
| Evolvability | Can new channels, matchers, and memory families be added without rewriting control flow? | package boundaries, config seams, exported contracts |

### System review verdict scale
- **Strong** — contract exists, is explicit, and has code/doc alignment
- **Partial** — direction is right, but ownership/config/governance is incomplete
- **Gap** — contract is missing or buried in implicit behavior

---

## 2. Code Architecture Review Checklist

Use this checklist when reviewing the organization of live source code.

| Dimension | Review questions | Evidence targets |
|---|---|---|
| Responsibility boundaries | Does each package/module have a clear role (core/runtime/infra/orchestrator/persistence), or are concerns leaking? | package layout + source imports |
| Dependency direction | Do stable contracts stay inward while volatile infra/config/controller logic stays outward? | source imports, package boundaries |
| State ownership | Are live states owned by explicit objects/stores, or split across helpers/flags? | types, stores, daemon/runtime state |
| Orchestration clarity | Can the main execution/judgment flow be traced from entrypoint to delivery? | daemon server, controller, orchestrator |
| Side-effect boundaries | Are DB/network/LLM/config/file-system boundaries isolated enough for testing? | runtime/infra sources, config loaders |
| Contract surfaces | Are the code paths governed by explicit types/config rather than hidden literals? | `@nous/core` exports, config types, runtime APIs |
| Judgment logic placement | Are heuristics and semantic-match decisions centralized and configurable, or scattered through helpers? | classifier/restoration/preference code |
| Testability | Do tests prove behavior at the correct seams (unit + integration), especially around matching/governance? | relevant tests in `packages/*/tests` |
| Change cost | If a naming or matching rule changes, how many files/layers need edits? | grep results, dependency spread |

### Code review verdict scale
- **Strong** — clean ownership + explicit contracts + low drift
- **Partial** — workable but scattered or insufficiently governed
- **Gap** — fragile, duplicated, or hidden inside implementation details

---

## 3. Review execution rule

For each review pass:
1. state the finding
2. classify it as Strong / Partial / Gap
3. cite the file(s)
4. record the architectural implication
5. state whether the result needs:
   - documentation only
   - terminology correction
   - contract change
   - code change
   - test change
