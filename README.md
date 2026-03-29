# Nous

**The organizing intelligence for autonomous agents.**

Nous is an Agent framework designed from OS-level principles: explicit state machines, heartbeat-based lifecycle management, event sourcing, capability-based security, and minimal human interruption.

> *Nous (νοῦς) — In ancient Greek philosophy, the active intellect that organizes chaos into order.*

## Status

The local-first V1 runtime slice is now in place:

- persistent daemon + dialogue threads + outbox replay
- scope-aware context assembly
- ambient perception + conservative auto-submit
- semantic-hybrid memory retrieval
- file-backed permission boundary + secret boundary
- evolution seed (execution trace → validated procedure)
- inter-Nous seed (identity + policy + governed procedure-summary exchange)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical design.
Implementation progress is tracked in [docs/DEVELOPMENT_LOG.md](./docs/DEVELOPMENT_LOG.md).
Current finish-line planning is tracked in [docs/V1_PLAN.md](./docs/V1_PLAN.md).

## Project Structure

```
packages/
  core/           # Core abstractions: Intent, Task, Agent, Event, Memory types
  orchestrator/   # Orchestration plane: Intent Planner, Task Scheduler, Agent Router
  runtime/        # Agent runtime: ReAct loop, tool sandbox, heartbeat
  persistence/    # Persistence plane: Event Store, Task Queue DB, Memory Store
  infra/          # Infrastructure: Channel Adapters, Process Supervisor, Observability
```

## Runtime Home

Nous now treats `~/.nous` as its default user-level home directory.

Typical layout:

```
~/.nous/
  config/         # JSON config files
  daemon/         # socket / pid / daemon state
  state/          # sqlite database
  logs/           # runtime logs
  artifacts/      # exported bundles / reports / snapshots
  network/        # instance identity + import/export exchange bundles
  tools/          # evolved or user-provided tools
  skills/         # skill assets
  secrets/        # file-backed secrets for v1
```

Project-local overrides can live in `<project>/.nous/`.

For v1, provider secrets can live in:

```text
~/.nous/secrets/providers.json
```

Environment variables still override file-based secrets.

## Local E2E Harness

For real daemon socket verification outside restricted sandboxes:

```bash
python3 scripts/e2e_daemon.py demo
```

For a single attached connection that receives daemon push messages:

```bash
python3 scripts/e2e_daemon.py live
```

You can also point it at a compiled or installed binary:

```bash
python3 scripts/e2e_daemon.py --nous-cmd "~/.local/bin/nous" demo
```

## Inter-Nous Seed Commands

Minimal governed exchange is now available through the CLI:

```bash
nous network status
nous network enable
nous network procedures
nous network export <fingerprint>
nous network import <bundlePath>
nous network log
```

The current V1 exchange unit is a **validated procedure summary**.  
This is intentionally narrower than the future relay/P2P architecture: V1 proves identity, policy, and governed artifact exchange before full networking arrives.

## License

MIT
