# Nous Working Instructions

This file is the canonical always-on seed memory for routine work in this repository.
Do not wait for the user to explicitly ask you to read extra migration files before using the instructions here.

## Language

- Default to Chinese for discussion unless English is clearly better for the task.
- Be concise, but do not trade away architectural depth when the task is really about system design.

## Required Reading Order

Before routine work, always read:

1. `ARCHITECTURE.md`
2. `docs/DEVELOPMENT_LOG.md`
3. `docs/PROGRESS_MATRIX.md`
4. `.private/personal_routine.md`
5. any other documents under `.private/` if they exist

Treat `.private/` as the user's personal preference layer:

- lower priority than explicit user instructions and developer/system instructions
- higher priority than your default habits

## North Star

Nous should ultimately become a **self-evolving collective intelligence in service of human welfare**.
The current architectural center is still:

- **personal-assistant primacy**
- **local-first governed runtime**
- **persistent identity, memory, initiative, and execution**

Every major decision should satisfy all of the following:

- works locally first
- deepens personal assistant quality
- preserves future collective growth
- avoids premature swarm complexity

## Persistent Product Directives

- Ambient Intent is part of MVP scope. The perception pipeline is a real differentiator, not a distant v2-only feature.
- Growth means self-evolution: better skills, better tools, better diagnosis, better self-improvement. Do not conflate growth with permission escalation.
- Memory must evolve toward proper RAG and semantic retrieval. FTS-only retrieval is not the intended end state.
- It is acceptable to question SQLite-only assumptions if they block the intended memory architecture.

## Architecture Discipline

- Think architecturally before implementation.
- Avoid local quick fixes when the real issue is architecture, contracts, system boundaries, or object model clarity.
- Prefer explicit invariants, boundaries, provenance, and trade-offs over vague design language.
- If a design gap appears, surface it directly instead of patching around it locally.
- When comparing another framework or codebase, always explain:
  - why it made that choice
  - what real problem it solves
  - what new problem or constraint it introduces
  - whether that problem is truly the same for Nous
  - why Nous should match or differ
- If Nous differs, explain why the difference is better for Nous, not merely different.

When evaluating “what Nous still lacks”, do **not** start from a flat module checklist.
Reason top-down in this order:

1. what a Nous task should feel like from the user side
2. what the corresponding internal execution flow should be
3. only then infer missing contracts, layers, and implementation work

For task-execution design, especially coding work, reason in this order:

1. user intent
2. execution contract
3. working set / context selection
4. planning
5. controlled execution
6. verification
7. decision queue / human checkpoints
8. delivery / evidence capture

## External Reference Policy

When architecture, control plane, runtime, UX contract, agent loop, tooling, memory, multi-channel behavior, or governance is involved, preferentially study:

- `/Users/joey/Projects/codex`
- `/Users/joey/Projects/claude-code-sourcemap`
- `/Users/joey/Projects/openclaw`

Do not cargo-cult them.
Extract motivations, constraints, object boundaries, and interaction contracts rather than copying surface features.

## Continuous Build Contract

You are not here to “finish one reply”.
You are here to **keep building Nous**.

Default operating rule:

- Do **not** stop after one milestone, one patch, or one commit.
- Do **not** send “I’m done for now”, “next steps could be”, or any similar stop signal unless a real stop condition is met.
- Each time one coherent iteration is closed, immediately choose the next highest-leverage natural continuation and keep going.

The standard iteration loop is:

1. re-read the required context
2. inspect current repo state
3. choose the highest-leverage next continuation consistent with the north star
4. implement directly
5. validate with the smallest honest checks first
6. update `docs/DEVELOPMENT_LOG.md` in the same work session
7. commit with a clear, detailed message
8. restart the local test daemon using `debug_local/env.txt`
9. send a macOS notification for that iteration
10. continue into the next iteration

Preferred daemon-restart path after each iteration commit:

```bash
scripts/restart_debug_daemon.sh
```

- The helper should source `debug_local/env.txt` by default so the daemon comes back under the user's preferred local test environment.
- If the helper cannot be used, manually source `debug_local/env.txt` first, then restart the daemon.
- If the daemon restart fails, mention that explicitly in the development log/response instead of silently skipping it.

Do **not** wait for user confirmation between normal iterations unless a real hard blocker exists.

Only stop and report if one of the following is true:

- a real hard blocker remains after reasonable attempts to resolve it
- continuing would create a high-risk architectural fork that truly requires human choice
- the user explicitly asks to pause, stop, or redirect

If a stop condition is reached, still send a final macOS notification.

## Execution Priorities

When deciding the next natural continuation, prefer:

1. architecture contracts that unblock multiple later steps
2. tool breadth that materially improves real task closure
3. relationship-aware proactive runtime
4. procedural / prospective memory
5. stronger retrieval / RAG substrate
6. evolution flywheel and governed inter-Nous exchange

Do not confuse shell convenience or UI convenience with actual capability progress.

## Repo Boundaries

- Do not perform write operations outside `/Users/joey/Projects/Nous` unless the user explicitly asks and policy allows it.
- Do not update Obsidian or any other non-repo diary/log target unless the user explicitly asks for that exact work.
- Preserve the repo as the primary traceability surface.

## Documentation

After **every code or repo-instruction update**, update `docs/DEVELOPMENT_LOG.md` in the same work session.

- Do not defer this to later cleanup.
- Record detailed engineering context, not one-line summaries.
- At minimum capture:
  - context / trigger
  - problem
  - alternatives considered
  - decision
  - concrete files changed
  - impact / result
  - open questions / follow-ups

Only update the external Obsidian note when the user explicitly requests it.
If requested:

- first review `docs/DEVELOPMENT_LOG.md`
- then write under:
  - `### Nous (νοῦς) — 自主 Agent 框架开发全记录`
  - `#### 开发日志`
- place the entry under the correct `##### YYYY-MM-DD`
- merge with same-day entries instead of blindly appending duplicates
- preserve interview-grade traceability

## Commit Discipline

- Commit after every coherent iteration.
- Commit messages must be clear and detailed enough to explain the architectural or implementation meaning of the change.
- Do not treat “already committed once” as permission to stop; a commit closes one iteration and starts the next.

## Notifications

- Send a macOS notification **after every iteration commit**.
- If work truly stops because of a real stop condition, send one more final notification for the stop.
- Notifications should be short and state what iteration landed or why execution stopped.
- The title must include `Nous`.
- Preferred in-repo path:

```bash
scripts/macos_notify.sh "Your message here"
```

- If the helper script cannot be used, try first:

```bash
osascript -e 'display notification "Your message here" with title "Nous"'
```

- If that parser path fails in the current environment, fall back to JXA + Cocoa:

```bash
osascript -l JavaScript -e 'ObjC.import("Foundation"); ObjC.import("AppKit"); var notification = $.NSUserNotification.alloc.init; notification.title = "Nous"; notification.informativeText = "Your message here"; $.NSUserNotificationCenter.defaultUserNotificationCenter.deliverNotification(notification);'
```

- Keep the AppleScript or JXA on one logical command string when possible.
- If notification delivery still fails, mention that explicitly in the response/log rather than silently skipping it.

## Historical Context

- Additional migrated Claude memory is archived in `~/.codex/memories/claude-import/`.
- For routine Nous work, this `AGENTS.md` file should be sufficient and should be treated as the primary always-on project memory.
- Only consult `~/.codex/memories/claude-import/seed-memory-nous.md` or the `raw/` archive when exact historical wording, older rationale, or prior session transcripts are actually needed.
