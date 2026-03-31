# Nous Progress Matrix

This document is the repo-local progress tracking matrix for Nous.

It complements:
- `ARCHITECTURE.md` — target design and roadmap
- `docs/DEVELOPMENT_LOG.md` — engineering trace of what changed and why

This file answers a different question:

> **Where does each major module currently stand relative to the architecture and roadmap?**

## How to use this file

- Update it in **daily summaries**, not every tiny edit.
- Track progress from **two dimensions**:
  1. **Module maturity** — how far each subsystem has progressed in architecture vs implementation
  2. **Roadmap phase / sprint progress** — how far the project has advanced against the planned build order
- Be honest about asymmetry:
  - some modules may be architecturally advanced but lightly implemented
  - some modules may be implemented enough for MVP but still below long-term target

## Status scale

### Maturity labels
- **High** — subsystem is structurally strong and already usable in the current product shape
- **Medium** — important pieces exist, but major roadmap gaps remain
- **Early** — only initial substrate / skeleton exists
- **Conceptual** — mostly architecture, little or no real implementation yet

### Progress estimate
- Rough qualitative estimate only; meant for steering, not vanity metrics.

---

## 2026-03-31

### Daily snapshot

#### A. What moved materially today

| Area | Yesterday | Today | What changed |
|---|---|---|---|
| Sprint 6 / Memory retrieval | first retrieval loop only | stronger first retrieval loop + richer producers + first prospective lifecycle | added lexical FTS candidate expansion, chunk-aware selection, provenance/thread/scope-biased ranking, better packed context hints, canonical producers for perception / conversation / prospective memory, and a first due-reminder / scheduled / done lifecycle for prospective commitments |
| Sprint 7 / Context | basic rich context | context boundary much more explicit | context now includes git status detail, local `.nous` config files, scope labels, and a human-readable permission boundary summary |
| Sprint 8 / Perception | heuristic skeleton | first low-noise usable slice + agenda-backed reflection seed | idle-first attention, redundant git-status suppression, workspace-scoped ambient notice threads, path-specific safe follow-up suggestions, persisted reflection agenda/candidate state, a daemon reflection tick, and governed candidate delivery with cooldown / daily quota policy |

#### B. Module maturity deltas

| Module | New reading | Why |
|---|---|---|
| Context Assembly | **Medium-High → stronger Medium-High (~70%)** | It now carries richer project state plus explicit “why can/can’t I act here?” boundary context, which materially improves explainability and scope-awareness |
| Memory | **Medium (~35%) → stronger Medium (~55%)** | Still not true vector/graph RAG, but no longer just whole-entry heuristic recall; retrieval now has a more honest packing/ranking policy, more real producers feeding the substrate, and the first prospective reminder lifecycle feeding proactive runtime |
| Perception / Proactive Cognition | **Early (~30%) → medium-early but materially more real (~58%)** | Still far from the full relationship-learning / memory-rover target, but Nous now has persisted agenda objects, reflection runs, queued proactive candidates, and a background daemon tick instead of only inline heuristic promotion |

#### C. Sprint / phase read after today's work

| Sprint / Phase | Current status | Notes |
|---|---|---|
| Sprint 6 | **Advanced seed, with first prospective runtime seam** | The practical V1 retrieval loop is much stronger, and prospective memory now has a first real runtime lifecycle; long-term vector / graph / metabolism target is still ahead |
| Sprint 7 (context slice) | **Substantially done** | The main remaining Sprint 7 gap is tool breadth, not context boundary clarity |
| Sprint 8 | **Meaningfully entered agenda/runtime territory** | The perception loop is no longer just “promote then maybe notify”; there is now a persisted agenda queue, reflection scheduler seed, and candidate delivery policy |
| Phase 0: MVP | **~74%** | The “feels like one continuing assistant with memory + governed awareness” story is more credible than yesterday, though tool breadth / deeper memory / growth still lag |

#### D. Steering implication

After this round, the next highest-leverage gaps are no longer “basic context realism.” They are:

1. **more real tool breadth**
2. **relationship-aware Memory Rover / reflective proactive runtime**
3. **procedural memory + richer prospective producer families**

## 2026-03-30

### Daily snapshot

#### A. Module maturity matrix

| Module | Current maturity | Relative progress | What is already real | Main missing pieces / gap to target |
|---|---|---:|---|---|
| Core / Domain Model / State Machines | High | 85% | Strong typed object model, explicit state machines, intent/task/decision/dialogue/channel/memory contracts | Future proactive/runtime objects not yet implemented in code |
| Persistence / SQLite Substrate | High | 80% | Event/task/intent/message/decision/memory stores; good test coverage; dialogue/outbox persistence | vector/graph substrate, proactive-object persistence |
| Runtime / Agent Execution | Medium-High | 65% | multi-provider runtime, ReAct loop, interruption, rollback contract, capability guards | tool breadth still small; evolved tools not real |
| Orchestration / Governance | High | 80% | intent parsing, planning, scheduler, clarification resume, DecisionQueue, pause/resume, approval-after-risky-boundary, rollback governance | richer semantic conflict analysis; deeper personal-assistant initiative integration |
| Dialogue / Daemon / Unified Presence | High | 85% | daemon, Unix socket, attach, REPL, thread continuity, outbox, reconnect delivery | more channel types, richer delivery policy/fallbacks |
| Context Assembly | Medium-High | 60% | environment/project context, active intents, memory hints | deeper user-state / relationship / prospective context |
| Memory | Medium | 35% | 5-tier direction, memory store, first hybrid retrieval loop, MemoryService draft+first implementation, metadata/provenance schema | real embeddings, sqlite-vec ANN, graph retrieval, metabolism, procedural/prospective runtime |
| Perception / Proactive Cognition | Early in code, advanced in architecture | 30% | FS/Git sensors, heuristic attention, ambient promotion skeleton | background reflector, memory rover, proactive candidates, relationship-aware delivery |
| Evolution / Growth | Early | 25% | trust/maturity basics, local procedure seed store, early procedure exchange seed | execution trace flywheel, gap detection, skill crystallization, self-mutation |
| Network / Collective Intelligence | Early | 20% | identity/encryption/policy groundwork, relay client skeleton, inter-Nous seed exchange, network config | real relay/discovery loop, shared pool, live consultations, collective insights |

#### B. Roadmap / sprint progress matrix

| Sprint / Phase | Planned focus | Current status | Notes |
|---|---|---|---|
| Sprint 1 | Core + Persistence | Done | Stable foundation |
| Sprint 2 | Runtime (ReAct) | Done | Base runtime complete; control semantics now stronger than original sprint scope |
| Sprint 3 | Orchestration | Done | Parsing/planning/scheduling are in place |
| Sprint 4 | CLI + Interface | Done | CLI entry and basic interface path are in place |
| Sprint 5 | Daemon + Dialogue | Essentially done | Persistent daemon, thread continuity, outbox, attach, multi-turn, conflict sequencing all exist |
| Sprint 6 | Memory RAG | In progress | Entered; now at “memory substrate + first retrieval loop”, not yet true RAG |
| Sprint 7 | Context + Tools + Permission | Partially done | Context + permission are solid; tool breadth lags target |
| Sprint 8 | Perception Pipeline | Partially done | MVP skeleton exists; full proactive cognition still ahead |
| Sprint 9 | Evolution Engine | Early | Seeds exist, but not yet a real self-improvement flywheel |
| Sprint 10 | Relay + Network | Early | Boundary/protocol groundwork exists; production network not real yet |
| Phase 0: MVP | Single-user core loop | ~65% | Strong substrate, but memory/proactive/tool breadth still gate “feels truly usable” |
| Phase 1: Dogfooding | Nous promotes Nous | Not started in earnest | Some groundwork exists, but real production dogfooding stack is not there yet |
| Phase 2: Community / Co-builders | Community + federated growth | Conceptual only | Architecture is ahead of implementation |

#### C. Overall reading of the project state

Current project shape:

> **governance and persistent-runtime capability are ahead of intelligence-layer completeness**.

In practical terms, the strongest parts of Nous today are:
- core object model
- persistence substrate
- daemon/dialogue continuity
- orchestration + governance

The most important lagging parts relative to the north star are:
- memory intelligence
- proactive cognition / personal-assistant behavior
- evolution loop
- collective intelligence runtime

The current asymmetry can be summarized as:

> **governance ability > execution ability > intelligence depth > self-evolution / collective growth**

That is not a failure; it means the project has built a serious substrate first. But it also means the next major gains in user-perceived value will come less from more governance and more from:
- better memory
- better proactive cognition
- broader real-world task capability

#### D. Today's notable architectural advances

Today materially strengthened the architecture in ways not fully visible in raw feature count:

1. **Memory architecture advanced**
   - landed `MemoryService` direction and first implementation
   - fixed metadata / provenance framing
   - clarified memory as “substrate + first retrieval loop”, not fake-RAG

2. **Personal-assistant thesis advanced**
   - architecture explicitly re-centered around:
     - personal-first assistant quality
     - federated collective intelligence second

3. **Proactive cognition architecture advanced**
   - added:
     - `ProactiveCandidate`
     - `RelationshipBoundary`
     - `ReflectionAgenda` / `Memory Rover`
   - this gives the project a real landing zone for “体贴、温柔、靠谱的个人助手” rather than a rule-triggered task bot

#### E. Next steering implication

If the goal is to make Nous feel genuinely usable soon, the next highest-leverage areas are:

1. **Memory** — true retrieval substrate and prospective memory
2. **Proactive cognition** — from skeleton to governed runtime objects / delivery path
3. **Tool breadth** — real-world tasks need more than a strong controller and 5 basic tools
