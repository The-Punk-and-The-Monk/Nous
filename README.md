# Nous

**The organizing intelligence for autonomous agents.**

Nous is an Agent framework designed from OS-level principles: explicit state machines, heartbeat-based lifecycle management, event sourcing, capability-based security, and minimal human interruption.

> *Nous (νοῦς) — In ancient Greek philosophy, the active intellect that organizes chaos into order.*

## Status

Early design phase. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical design.

## Project Structure

```
packages/
  core/           # Core abstractions: Intent, Task, Agent, Event, Memory types
  orchestrator/   # Orchestration plane: Intent Planner, Task Scheduler, Agent Router
  runtime/        # Agent runtime: ReAct loop, tool sandbox, heartbeat
  persistence/    # Persistence plane: Event Store, Task Queue DB, Memory Store
  infra/          # Infrastructure: Channel Adapters, Process Supervisor, Observability
```

## License

MIT
