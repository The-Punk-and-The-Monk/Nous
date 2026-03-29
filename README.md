# Nous

**The organizing intelligence for autonomous agents.**

Nous is an Agent framework designed from OS-level principles: explicit state machines, heartbeat-based lifecycle management, event sourcing, capability-based security, and minimal human interruption.

> *Nous (νοῦς) — In ancient Greek philosophy, the active intellect that organizes chaos into order.*

## Status

Early design phase. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical design.
Implementation progress is tracked in [docs/DEVELOPMENT_LOG.md](./docs/DEVELOPMENT_LOG.md).

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
  tools/          # evolved or user-provided tools
  skills/         # skill assets
```

Project-local overrides can live in `<project>/.nous/`.

## Local E2E Harness

For real daemon socket verification outside restricted sandboxes:

```bash
python3 scripts/e2e_daemon.py demo
```

You can also point it at a compiled or installed binary:

```bash
python3 scripts/e2e_daemon.py --nous-cmd "~/.local/bin/nous" demo
```

## License

MIT
