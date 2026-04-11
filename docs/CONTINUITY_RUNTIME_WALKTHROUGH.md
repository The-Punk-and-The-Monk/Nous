# Continuity / Interaction Mode Runtime Walkthrough

Status: active explanatory document
Audience: maintainers, interview preparation, architecture readers

This document explains the current mainline runtime contract for:

- `chat / work / handoff`
- `transport / execution / semantic continuity`
- where "memory continuity" actually fits today
- which code paths implement each decision

It is intentionally narrower than `ARCHITECTURE.md`: this file is about the live runtime path and the current code-level seams.

## 1. Canonical vocabulary

Current mainline separates continuity into three peer layers:

1. **Transport continuity**
   - channel / attach / thread / outbox / replay
2. **Execution continuity**
   - `Intent` / `PlanGraph` / `Task` / `Decision` / pause-resume-cancel
3. **Semantic continuity**
   - layered memory / retrieval / promoted structured restoration / future `RecallPack`

Those three layers together form the broader **context continuity** contract.

If older language says **memory continuity**, the more precise current reading is:

> **memory governance** = the storage, provenance, promotion, retrieval, decay, and packing rules that make semantic continuity possible.

So `memory continuity` is best read as a substrate concern, not a fourth peer continuity layer.

## 2. The first boundary: `chat / work / handoff`

The mainline rule is:

> Every incoming thread message is classified as `chat`, `work`, or `handoff` before it is allowed to become governed work.

Primary code surface:

- `packages/infra/src/intake/interaction-mode-classifier.ts`
- current daemon caller: `packages/infra/src/daemon/server.ts`

### `chat`

`chat` means:

- conversational repair
- preference notes
- lightweight recall
- freeform follow-up that does not clearly govern work

Current path:

1. `NousDaemon.handleThreadMessage()` calls `interactionModeClassifier.classify(...)`
2. if mode is `chat`, daemon stores the user turn as conversation memory
3. daemon may also extract relationship-preference memory
4. daemon calls `handleChatModeMessage(...)`
5. chat reply uses the normal LLM, but the system prompt explicitly forbids work-governance language by default

Relevant code:

- `packages/infra/src/daemon/server.ts`:
  - `handleThreadMessage(...)`
  - `handleChatModeMessage(...)`
  - `storeConversationTurnMemory(...)`
  - `storeRelationshipPreferenceMemory(...)`

### `work`

`work` means:

- start a concrete task
- revise or constrain active work
- resume / pause / cancel active work
- answer a work-blocking clarification or decision
- restore previously promoted governed work

Current path:

1. classifier returns `work`
2. daemon either:
   - restores governed work from promoted structured memory, or
   - starts a fresh intent path
3. daemon builds execution context
4. daemon calls `orchestrator.submitIntentBackground(...)`
5. orchestrator parses the request into `Intent + contract + executionDepth + clarificationQuestions`
6. daemon decides whether to:
   - create clarification decision
   - create conflict-resolution decision
   - or schedule intent execution

Relevant code:

- `packages/infra/src/daemon/server.ts`
- `packages/orchestrator/src/orchestrator.ts`
- `packages/orchestrator/src/intent/parser.ts`

### `handoff`

`handoff` means:

- do not silently continue work based on thread illusion
- instead package current context into an explicit transferable artifact

This is not "resume work on another surface" by magic.
It is "make the transfer object explicit and inspectable first."

Current path:

1. classifier returns `handoff`
2. daemon builds a `HandoffCapsule`
3. daemon sends an assistant message carrying the capsule in metadata
4. daemon stores the capsule id on thread metadata
5. daemon does **not** create a new `Intent` merely because a handoff happened

Relevant code:

- `packages/core/src/types/interaction.ts` (`HandoffCapsule`)
- `packages/infra/src/daemon/server.ts`
  - `handleHandoffModeMessage(...)`
  - `buildHandoffCapsule(...)`
- `packages/infra/src/daemon/dialogue-service.ts`
  - `setHandoffCapsuleForThread(...)`

## 3. Message entry path in live code

The concrete message-entry chain is:

1. `DialogueService.sendMessage(...)` or `DialogueService.submitIntent(...)`
2. inbound message stored onto a `DialogueThread`
3. daemon callback fires
4. `NousDaemon.handleThreadMessage(...)`
5. pending-decision branch or interaction-mode branch
6. downstream route:
   - chat
   - handoff
   - work start
   - work restoration
   - decision response / clarification resume

Key files:

- `packages/infra/src/daemon/dialogue-service.ts`
- `packages/infra/src/daemon/server.ts`

## 4. Transport continuity: how it is actually implemented

Transport continuity is the layer that preserves:

- which thread a message belongs to
- which surface/channel is attached
- what still needs to be replayed or delivered

It does **not** decide semantic truth or work identity.

### Main objects

- `DialogueThread`
- `DialogueMessage`
- `OutboxEntry`
- `Channel`
- `SurfaceSession` in architecture language

### Main code surfaces

- `packages/core/src/types/dialogue.ts`
- `packages/infra/src/daemon/dialogue-service.ts`

### Important mechanics

1. **Attach / detach**
   - `DialogueService.attach(...)` attaches a channel and can return pending outbox entries for replay.
2. **Inbound storage**
   - `submitIntent(...)` / `sendMessage(...)` store the inbound human message on the thread before higher-level routing happens.
3. **Outbox replay**
   - pending outbound items are stored separately from the human-readable thread transcript.
4. **Thread metadata as projection**
   - `activeIntentId` and `handoffCapsuleId` can be projected onto thread metadata
   - but thread metadata is not the source of semantic truth

### Why this matters

This is the concrete reason thread reuse is only a **transport fact**:

- thread says where the message lives
- thread says what can be replayed
- thread says what surface was involved
- thread does **not** prove same responsibility, same work, or same meaning

## 5. Execution continuity: how work stays governable

Execution continuity is the layer that keeps work objects alive across time.

### Main objects

- `Intent`
- `PlanGraph`
- `Task`
- `Decision`
- pending pause / cancellation / revision directives

### Entry point

The key runtime entry is `NousDaemon.startIntentExecution(...)`.

Current steps:

1. build execution context
2. announce trust receipt / turn snapshot
3. call `orchestrator.submitIntentBackground(...)`
4. store the request as intent memory
5. if clarification is needed, create a clarification decision
6. run conflict analysis
7. either queue a decision or schedule execution

Relevant code:

- `packages/infra/src/daemon/server.ts`
  - `startIntentExecution(...)`
  - `scheduleIntentExecution(...)`
- `packages/orchestrator/src/orchestrator.ts`
  - `submitIntentBackground(...)`
  - `respondToClarification(...)`
  - `applyIntentScopeUpdate(...)`

### Intent formation

`Orchestrator.submitIntentBackground(...)` calls `IntentParser.analyze(...)`.

That parser returns:

- structured goal
- constraints
- human checkpoint policy
- task contract
- execution depth
- clarification questions

Relevant code:

- `packages/orchestrator/src/intent/parser.ts`

This is the code reason execution continuity belongs to `Intent`, not to thread:

- `Intent` holds the governable contract
- thread only holds the transport container

### Work-blocking decisions

When there is already pending work coordination, the daemon does not guess blindly.
It routes the new turn through `ThreadInputRouter`.

That router distinguishes:

- `decision_response`
- `pause_current_intent`
- `cancel_current_intent`
- `new_intent`
- `mixed`
- `unclear`

Relevant code:

- `packages/infra/src/intake/thread-input-router.ts`

This is part of execution continuity because work must remain revisable, pausable, cancellable, and resumable without collapsing back into raw chat history.

## 6. Semantic continuity: how prior meaning re-enters the current turn

Semantic continuity answers:

- what prior facts matter now?
- what earlier work is relevant now?
- when may old work be revived safely?

### Layer A: retrieval for normal context assembly

Before work execution, the daemon builds execution context with:

- environment facts
- project facts
- active intents
- retrieved memory hints
- permission summary

Primary path:

1. `NousDaemon.buildExecutionContextForScope(...)`
2. `memory.retrieveForContext(...)`
3. `ContextAssembler.assemble(...)`
4. `buildUserStateGrounding(...)`
5. orchestrator receives this grounding during intent analysis

Relevant code:

- `packages/infra/src/daemon/server.ts`
- `packages/runtime/src/context/assembly.ts`
- `packages/infra/src/intake/grounding.ts`

### Layer B: retrieval scoring

The current retrieval engine is `HybridMemoryRetriever`.

It ranks memory using a configurable mix of:

- lexical score
- semantic score
- scope score
- provenance score
- retention score

Relevant code:

- `packages/runtime/src/memory/retrieval.ts`
- matcher config:
  - `packages/core/src/types/matching.ts`

This is why semantic continuity is not "vector DB magic":

- retrieval is policy-driven
- scope and provenance matter
- retention and decay matter

### Layer C: promoted structured restoration

Semantic continuity becomes strong enough to restore work only after promotion into structured memory.

Promotion path:

- `MemoryService.promoteContextContinuity(...)`
- compatibility alias:
  - `promoteWorkContinuation(...)`

This stores a semantic memory entry tagged as:

- `context_continuity`
- `structured`
- `continuity_kind:work`
- `double_gate_candidate`

Relevant code:

- `packages/runtime/src/memory/service.ts`

### Layer D: live restoration gate

The restoration gate is:

- `evaluateContextContinuityRestoration(...)`

It requires both:

1. **structured promotion**
2. **live gate pass**
   - scene match
   - permission
   - boundary acceptance

Relevant code:

- `packages/runtime/src/memory/context-continuity.ts`

This is the reason a vague sentence like:

> "Continue that auth thing from yesterday."

does **not** automatically become work.

It only restores work when:

- promoted structured continuity memory exists
- current scope/thread/intent checks align
- permission/boundary checks pass

## 7. Where `Handoff` fits relative to continuity

`handoff` is not its own fourth peer continuity layer.
It is a **bridge mechanism** across continuity layers.

Concretely:

- transport continuity keeps the current thread/surface alive
- execution continuity keeps work objects governable
- semantic continuity decides meaning and relevance
- handoff packages enough state so transfer is explicit instead of implicit

So handoff is best understood as:

> **an explicit transfer protocol, not a synonym for continuity itself**

That is why the capsule contains:

- source surface
- source thread
- source intent
- summary
- relevant facts
- pending questions
- suggested next action

## 8. End-to-end examples

### Example A: explicit chat

Input:

> "Can you say that shorter?"

Path:

1. `handleThreadMessage(...)`
2. classifier -> `chat`
3. user turn stored as conversation memory
4. `handleChatModeMessage(...)`
5. assistant replies without creating an intent

Regression evidence:

- `packages/infra/tests/daemon-interaction-mode.test.ts`

### Example B: explicit handoff

Input:

> "Please hand this off to IDE as a capsule."

Path:

1. classifier -> `handoff`
2. `buildHandoffCapsule(...)`
3. assistant message metadata includes `handoffCapsule`
4. thread metadata stores `handoffCapsuleId`
5. no active intent is created by the handoff itself

Regression evidence:

- `packages/infra/tests/daemon-interaction-mode.test.ts`
- `packages/infra/tests/dialogue-service.test.ts`

### Example C: explicit work restoration

Input:

> "Continue that auth thing from yesterday."

Path:

1. daemon checks `looksLikeContextRestorationRequest(...)`
2. daemon retrieves semantic memory candidates
3. daemon runs `evaluateContextContinuityRestoration(...)`
4. if allowed:
   - send restoration notification
   - build restored work request
   - start governed work execution
5. if not allowed:
   - stay in chat

Regression evidence:

- `packages/infra/tests/daemon-interaction-mode.test.ts`
- `packages/runtime/tests/work-continuity-restoration.test.ts`
- `packages/infra/tests/interaction-mode-classifier.test.ts`

## 9. Practical reading rule

When reading or explaining current Nous mainline:

- **Thread** = transport continuity container
- **Intent** = execution continuity authority
- **Memory + retrieval + promoted restoration** = semantic continuity authority
- **HandoffCapsule** = explicit transfer bridge
- **Memory governance** = the substrate that keeps semantic continuity trustworthy

If a sentence treats thread reuse as proof of same work, or treats memory as a fourth peer continuity layer, it is using the older, less precise framing.
