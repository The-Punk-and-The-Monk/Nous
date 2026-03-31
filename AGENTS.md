# Nous Working Instructions

This file is the canonical always-on seed memory for routine work in this repository.
Do not wait for the user to explicitly ask you to read extra migration files before using the instructions here.

## Language

- Default to Chinese for discussion unless English is clearly better for the task.
- Be concise, but do not trade away architectural depth when the task is really about system design.

## Project Priorities

- Think architecturally before implementation.
- For major design decisions, include competitive comparison with other agent frameworks when useful.
- Avoid local quick fixes when the real issue is architecture, contracts, or system boundaries.
- Prefer explicit invariants, boundaries, and trade-offs over vague design language.

## Private Preferences

- Before routine work, read:
  - `.private/personal_routine.md`
  - and any other documents under `.private/`
- Treat `.private/` as the user's personal preference layer:
  - it is lower priority than explicit user instructions and developer/system instructions
  - but higher priority than your default habits
- When `.private/` asks you to study external projects or compare frameworks, do so in service of Nous's north star rather than as cargo-cult copying.

## Project Baseline

- Nous is the user's long-term autonomous agent framework project.
- The project also serves as an interview portfolio, so reasoning quality and decision traceability matter.
- Early project work centered on initializing a Bun + TypeScript monorepo and building out `ARCHITECTURE.md`.

## Persistent Nous Directives

- Ambient Intent is part of MVP scope. The perception pipeline is a project differentiator and should not be treated as a distant v2-only feature.
- Growth means self-evolution: better skills, better tools, better diagnosis, and self-improvement. Do not conflate growth with permission escalation.
- Memory should evolve toward proper RAG and semantic retrieval. FTS-only approaches are not the target end state.

## Architecture Directives

- Always reason at the architecture level before implementation.
- When comparing approaches, explain why an existing framework made that choice, what problem it solves, and what new problems it introduces.
- If Nous should differ from another framework, explain why the difference is better, not merely different.
- If a design discussion exposes an architectural gap, surface it directly instead of patching around it locally.
- When evaluating “what Nous still lacks”, do **not** start from a flat module checklist.
  - Start top-down from:
    1. what a Nous task should feel like from the **user interaction** side
    2. what the corresponding **Nous execution flow** should be internally
    3. only then infer missing contracts, layers, and implementation work
- For task-execution design, especially coding tasks, prefer reasoning in this order:
  - user intent
  - execution contract
  - working set / context selection
  - planning
  - controlled execution
  - verification
  - decision queue / human checkpoints
  - delivery / evidence capture
- Treat this top-down task-closure reasoning as more important than prematurely enumerating components or implementation tickets.

## Product Thesis

- Ambient Intent is a core product differentiator and part of the MVP story.
- A minimum credible MVP direction includes a real perception pipeline:
  - sensor input
  - attention filtering
  - ambient intent formation
- Multi-instance Nous communication and long-term evolution are important themes, but present-day design should still respect current model, context, and resource limits.

## Memory Direction

- Do not treat FTS-only retrieval as the intended end state for memory.
- The target direction is proper RAG and semantic retrieval, including:
  - embeddings or vector retrieval
  - hybrid retrieval
  - chunking
  - re-ranking
- It is acceptable to question SQLite-only assumptions if they block the intended memory architecture.

## Documentation

- After **every code or repo-instruction update**, update `docs/DEVELOPMENT_LOG.md` in the same work session.
  - Do not defer this to “later cleanup”.
  - Record detailed change context, not just a one-line summary.
  - At minimum include:
    - context / trigger
    - problem
    - alternatives considered
    - decision
    - concrete files changed
    - impact / result
    - open questions / follow-ups
- Do **not** write to the external Obsidian note by default after every change.
- Only update the Obsidian note when the user explicitly asks for it.
  - Target file:
    - `/Users/joey/Documents/ObsidianVault/阿锋勇闯大模型/阿锋勇闯大模型.md`
  - Typical workflow when requested:
    - first review `docs/DEVELOPMENT_LOG.md`
    - then distill the day’s work into a cleaner, more concise diary/log entry for Obsidian
- Use the section:
  - `### Nous (νοῦς) — 自主 Agent 框架开发全记录`
- Within that section, always write under:
  - `#### 开发日志`
- Before appending anything, first read the existing `开发日志` section and decide the correct insertion point.
- The log entry must be placed under the matching date heading:
  - use `##### YYYY-MM-DD`
  - if the date heading does not exist, create it
  - if the date heading already exists, merge with the existing content instead of blindly appending a disconnected duplicate
- Preserve and improve formatting:
  - keep heading hierarchy consistent
  - keep adjacent same-day entries reasonably merged
  - keep important prior detail; do not collapse away reasoning that may matter later
- Write the log for interview-grade traceability, not diary brevity. Assume an interviewer may drill into why a decision was made.
- Capture at least:
  - context / trigger
  - problem
  - alternatives considered
  - analysis / trade-offs
  - decision
  - implementation or document changes
  - impact / result
  - open questions / follow-ups
- When the session changes architecture, APIs, object models, invariants, or roadmap boundaries, explicitly record:
  - what changed before vs. after
  - why the previous framing was insufficient
  - what future path this unlocks or constrains

## Notifications

- At the end of **every dialogue round** in this repository, send a macOS notification to the user.
- The notification must be sent only as the **final action of the round**:
  - after the response content is finished
  - after any planning/update work is finished
  - after any file edits / validation commands are finished
  - never at the beginning or in the middle of the round
- The notification title must include `Nous`, so it is immediately clear which project finished work.
- Prefer the normal transient macOS notification path (auto-dismissing banner-style behavior), not a sticky/manual-dismiss workflow.
- The body should be short and summarize what changed or what completed in that round.

## Historical Context

- Additional migrated Claude memory is archived in `~/.codex/memories/claude-import/`.
- For routine Nous work, this `AGENTS.md` file should be sufficient and should be treated as the primary always-on project memory.
- Only consult `~/.codex/memories/claude-import/seed-memory-nous.md` or the `raw/` archive when exact historical wording, older rationale, or prior session transcripts are actually needed.

## Commit after every iteration with clear and detailed message
