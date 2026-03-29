# Nous Development Log

This file is the **project-local engineering log** for Nous.

Its purpose is different from `ARCHITECTURE.md`:

- `ARCHITECTURE.md` explains the system design.
- `docs/DEVELOPMENT_LOG.md` records **how and why the codebase evolved over time**.

This file should be updated after meaningful implementation or architecture sessions so the repository itself preserves engineering traceability.

## Logging Rules

Each entry should live under a date heading: `## YYYY-MM-DD`.

For significant sessions, capture:

1. **Context / Trigger** — what caused the work
2. **Problem** — the concrete gap, bug, design tension, or implementation goal
3. **Options considered** — especially when rejecting a tempting shortcut
4. **Decision** — what we chose and why
5. **Changes made** — files, modules, contracts, or behavior touched
6. **Impact** — what became possible, simpler, or safer
7. **Open questions / next steps** — what remains unresolved

## Entry Template

```md
## YYYY-MM-DD

### Session: <short title>
- Context / Trigger:
- Problem:
- Options considered:
  - Option A:
  - Option B:
- Decision:
- Changes made:
  - `path/to/file`
- Impact:
- Open questions / next steps:
```

---

## 2026-03-29

### Session: Establish repository-level development log + add direct OpenAI provider
- Context / Trigger:
  - The repo already had strong architecture documentation and an external Obsidian log, but it lacked a **project-local** engineering log that lives with the code.
  - The runtime already supported `AnthropicProvider`, `ClaudeCliProvider`, and `OpenAICompatProvider`, but it did **not** support a direct official OpenAI provider.
- Problem:
  - Team members or future interview reviewers can inspect the repository and understand the intended architecture, but they cannot easily trace **implementation-level evolution** without opening external notes.
  - The CLI provider-selection path treated OpenAI only as a compatibility proxy case; there was no clean way to use `OPENAI_API_KEY` for direct OpenAI access.
- Options considered:
  - Option A: keep logging only in Obsidian.
    - Rejected because it weakens repo-local traceability and makes the codebase less self-explanatory.
  - Option B: add a minimal `DEVELOPMENT_LOG.md` inside the repo and start using it immediately.
    - Chosen because it creates a lightweight but durable engineering history with almost no runtime complexity.
  - Option C: add direct OpenAI support by copy-pasting `OpenAICompatProvider`.
    - Rejected because it would create duplicate transport logic and increase future maintenance cost.
  - Option D: extract shared OpenAI-chat transport logic, then build `OpenAIProvider` and `OpenAICompatProvider` on top.
    - Chosen because it keeps the provider surface extensible while staying compatible with the current `LLMProvider` abstraction.
- Decision:
  - Create `docs/DEVELOPMENT_LOG.md` as the in-repo development log mechanism.
  - Add a direct `OpenAIProvider` and refactor OpenAI-style chat logic into shared runtime code.
  - Extract CLI provider selection into a dedicated module so provider policy becomes testable and easier to evolve.
- Changes made:
  - Added `docs/DEVELOPMENT_LOG.md`
  - Added `packages/runtime/src/llm/openai.ts`
  - Added `packages/runtime/src/llm/openai-shared.ts`
  - Refactored `packages/runtime/src/llm/openai-compat.ts`
  - Updated `packages/runtime/src/index.ts`
  - Added `packages/infra/src/cli/provider.ts`
  - Updated `packages/infra/src/cli/app.ts`
  - Added `packages/infra/tests/provider.test.ts`
- Impact:
  - The repo now has a built-in engineering history mechanism instead of relying only on external notes.
  - Nous can now select a **direct OpenAI provider** when `OPENAI_API_KEY` is present.
  - Provider selection logic is no longer buried inside the CLI entrypoint and can be tested independently.
  - The current `LLMProvider` abstraction remains stable while gaining a clean path for future OpenAI/Responses evolution.
- Open questions / next steps:
  - The current `LLMProvider` interface is still chat-centric; if Nous later adopts OpenAI Responses as a first-class provider path, core abstractions may need to grow beyond chat-completions semantics.
  - v1 still lacks daemon/dialogue, richer memory retrieval, perception pipeline, and a clearer execution roadmap from the current codebase to the architecture document.

### Session: Start v1 dialogue foundation with persistent thread / message / outbox storage
- Context / Trigger:
  - After mapping the current codebase against `ARCHITECTURE.md`, the biggest v1 gap is still Sprint 5 territory: Nous is a one-shot CLI process, not a persistent daemon with dialogue continuity.
  - Before implementing daemon IPC, the codebase needed a persistent substrate for **threads, messages, and outbox delivery state**.
- Problem:
  - The repo had task/event/memory/intents persistence, but **no dialogue persistence model**.
  - Without message/thread/outbox tables, daemon work would likely become a big-bang refactor instead of an incremental build.
- Options considered:
  - Option A: jump directly to Unix socket daemon implementation.
    - Rejected because it would force transport, lifecycle, and persistence concerns to land at once.
  - Option B: first add persistent dialogue primitives, then layer daemon and client protocol on top.
    - Chosen because it creates a cleaner dependency order: storage contracts first, process model second.
- Decision:
  - Add core dialogue types and a SQLite-backed `MessageStore` that supports:
    - `DialogueThread`
    - `DialogueMessage`
    - `OutboxEntry`
  - Treat the persistent outbox as a first-class storage concern now, even before channel reconnection logic exists.
- Changes made:
  - Added `packages/core/src/types/dialogue.ts`
  - Exported dialogue types from `packages/core/src/index.ts`
  - Added `packages/persistence/src/interfaces/message-store.ts`
  - Added `packages/persistence/src/sqlite/message-store.sqlite.ts`
  - Extended `packages/persistence/src/sqlite/connection.ts` with:
    - `dialogue_threads`
    - `dialogue_messages`
    - `message_outbox`
  - Wired `messages` into `packages/persistence/src/backend.ts`
  - Added `packages/persistence/tests/message-store.test.ts`
- Impact:
  - The codebase now has the first real persistence foundation for the Dialogue layer described in architecture.
  - Future daemon work can build against storage contracts instead of inventing persistence ad hoc inside IPC handlers.
  - The outbox concept is now explicit in code, not just in architecture prose.
- Open questions / next steps:
  - Define daemon/client protocol objects next (`submit_intent`, `send_message`, `subscribe`, `result`, `decision_needed`, etc.).
  - Decide whether `DialogueThread` should explicitly track linked `intentIds` in storage now or wait until the first daemon integration pass.
  - Decide whether `MessageStore` should later own delivery-attempt history, or whether retry/audit should stay in the generic event store.

### Session: Tighten Unified Presence and translate it into code contracts
- Context / Trigger:
  - A key architecture concern emerged: if Nous keeps evolving mainly through provider/runtime/tooling work, it risks implementation drift toward an OpenClaw-like gateway/runtime shape.
  - The architectural antidote is to make **Unified Presence** real, not just rhetorical.
- Problem:
  - The architecture already mentioned daemon + unified presence, but the definition was still too loose and could be misread as “one global brain with no boundaries.”
  - The codebase still lacked explicit contracts for channel attach, thread continuity, and daemon protocol envelopes.
- Options considered:
  - Option A: keep Unified Presence as prose only and defer contracts until daemon implementation.
    - Rejected because the daemon would then grow around implicit assumptions.
  - Option B: tighten the definition in `ARCHITECTURE.md` and add protocol/domain contracts before full socket work.
    - Chosen because it creates a clearer dependency order: philosophy → contracts → implementation.
- Decision:
  - Refine Unified Presence to mean:
    - **unified identity**
    - **unified runtime**
    - **unified continuity**
    - but **scope-aware cognition**
  - Add code-level contracts for:
    - `Channel`
    - `ChannelScope`
    - `ClientEnvelope`
    - `DaemonEnvelope`
    - `AttachPayload`
    - `SubmitIntentPayload`
    - thread/status snapshots
  - Build a first `DialogueService` over persistence contracts so thread/message/outbox behavior can exist before Unix socket plumbing.
- Changes made:
  - Updated `ARCHITECTURE.md` Unified Presence section with:
    - a stricter definition
    - “what is unified vs what is scoped” table
    - protocol-level contract snippet
  - Added `packages/core/src/types/channel.ts`
  - Added `packages/core/src/types/protocol.ts`
  - Exported the new types through `packages/core/src/index.ts`
  - Added `packages/infra/src/daemon/dialogue-service.ts`
  - Added `packages/infra/tests/dialogue-service.test.ts`
  - Exported dialogue service from `packages/infra/src/index.ts`
- Impact:
  - Unified Presence is now harder to misinterpret as “remove all boundaries.”
  - The codebase now has a real pre-daemon dialogue abstraction that can:
    - attach channels
    - create/reuse threads
    - persist inbound human messages
    - enqueue outbound assistant messages
    - produce status/thread snapshots
  - This materially reduces the risk that daemon work turns into an ad hoc gateway shell.
- Open questions / next steps:
  - Add a real daemon process and Unix socket transport that speaks the new envelopes.
  - Bind `submit_intent` in `DialogueService` to live orchestrator execution and progress fan-out.
  - Decide whether channels should become persistent DB records or remain runtime-presence objects with message/thread persistence only.

### Session: Turn daemon/dialogue into a usable v1 workflow
- Context / Trigger:
  - The repo already had dialogue persistence, protocol envelopes, and a daemon skeleton, but it still did not behave like the Sprint 5 target in practice.
  - The critical remaining gap was not “more provider support”; it was making daemon mode feel like a **persistent Nous** instead of a thin request/response wrapper around the old one-shot CLI.
- Problem:
  - Outbox entries were persisted but not actually drained into reconnecting channels.
  - The daemon protocol only supported one-off request/response usage; there was no client session model for attach/live updates.
  - `nous attach` only rendered a snapshot, so it still behaved closer to “inspect database state” than “attach to one running Nous”.
  - Concurrent intent submission still had no Layer 1 safety story, so daemon mode risked silently drifting toward “multiple background jobs with no coordination”.
- Options considered:
  - Option A: stop after persistence + basic daemon RPC, and defer live attach/outbox delivery/conflict handling.
    - Rejected because that would still leave Sprint 5’s core promise mostly rhetorical.
  - Option B: build a minimal but real daemon-side delivery loop, persistent client session, thread REPL, and coarse Layer 1 sequencing now.
    - Chosen because it closes the most important behavioral gap without waiting for later sprints.
- Decision:
  - Add a **stateful daemon client session** abstraction over the existing socket protocol.
  - Teach the daemon to:
    - remember attached channel/thread sessions
    - persist outbound assistant messages
    - drain pending outbox entries into attached channels
    - push progress/result notifications to live attached clients
  - Add a simple **static conflict manager** for MVP Layer 1 safety:
    - explicit file-path overlap when detectable
    - otherwise project/directory-scope overlap fallback
    - default resolution = safe sequencing, not parallel optimism
  - Turn CLI attach/REPL into the primary daemon interaction shape.
- Changes made:
  - Added `packages/infra/src/daemon/conflict-manager.ts`
  - Added `packages/infra/tests/conflict-manager.test.ts`
  - Reworked `packages/infra/src/daemon/server.ts` to:
    - track live socket sessions
    - fan out progress to thread-attached channels
    - drain outbox on attach/reconnect
    - sequence overlapping submissions through the new conflict manager
  - Reworked `packages/infra/src/daemon/client.ts` into a reusable session-based client
  - Extended `packages/infra/src/daemon/dialogue-service.ts` with:
    - `drainPendingDeliveries`
    - `linkIntentToThread`
    - richer outbound metadata
  - Extended `packages/persistence/src/interfaces/message-store.ts` and `packages/persistence/src/sqlite/message-store.sqlite.ts` with `getMessage`
  - Added `packages/infra/src/cli/commands/repl.ts`
  - Updated `packages/infra/src/cli/app.ts` so:
    - `nous` opens a daemon REPL when daemon mode is available
    - `nous attach <threadId>` becomes a live attach workflow by default
    - `nous attach <threadId> --once` keeps the old snapshot behavior
  - Updated `packages/infra/src/cli/commands/daemon.ts` to wait for readiness and surface startup failure more honestly
  - Expanded tests in:
    - `packages/infra/tests/dialogue-service.test.ts`
    - `packages/infra/tests/daemon-controller.test.ts`
    - `packages/persistence/tests/message-store.test.ts`
- Impact:
  - The daemon path now has a much more credible Sprint 5 shape:
    - background intent submission
    - live attachable threads
    - reconnect delivery via persistent outbox
    - basic concurrency sequencing instead of naive overlap
  - Nous is now materially less likely to collapse into an OpenClaw-like stateless gateway pattern, because channel continuity and runtime continuity are being enforced in code.
  - The repo’s v1 center of gravity has shifted from “provider/runtime plumbing” toward “persistent identity + dialogue continuity”.
- Open questions / next steps:
  - End-to-end daemon listening still cannot be validated in the current Codex sandbox because local socket/port listen is blocked (`EPERM`), so the new live path remains unit-tested rather than fully integration-tested here.
  - Context Assembly is still missing from the daemon submission path; attached thread/scope continuity exists, but retrieval/context enrichment is still far below the architecture target.
  - The current Layer 1 conflict logic is intentionally coarse. It is sufficient as an MVP safety rail, but not the final task-level resource-claim system described in architecture.
