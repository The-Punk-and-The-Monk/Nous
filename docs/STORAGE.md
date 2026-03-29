# Nous Storage Model

This document defines **where different classes of Nous data should live** and, more importantly, **why**.

The short version:

> Filesystem is the externalized boundary layer.  
> Database/indexes are the live cognitive and governance layer.

If Nous is aiming toward a persistent runtime and eventually a self-evolving collective intelligence, storage cannot be an implementation afterthought. It determines what is inspectable, what is queryable, what is governable, and what can be safely shared.

---

## 1. Design Rule

Use the right substrate for the right job:

| Use case | Primary store |
|----------|---------------|
| Human-editable declarations | Filesystem |
| Runtime coordination state | SQLite / structured stores |
| Retrieval-heavy knowledge | SQLite + vector + graph indexes |
| Large blobs / artifacts | Filesystem |
| Rebuildable cache | Filesystem |
| Sensitive credentials | Secret store / encrypted local storage |

Another way to say it:

- **Humans need to read/edit it** → file
- **The system needs to query/rank/relate it** → DB/index
- **It is large and blob-like** → file
- **It is highly sensitive** → secret store
- **It needs both governance and publication** → DB + file dual-layer

---

## 2. What Should Live in the Filesystem

### 2.1 Config

Examples:

- `config.json`
- `providers.json`
- `sensors.json`
- `ambient.json`
- `permissions.json`
- `memory.json`
- `logging.json`

Why:

- user-editable
- diffable
- easy to override
- appropriate for `~/.nous` and `<project>/.nous`

### 2.2 Logs

Examples:

- daemon log
- provider error log
- crash log
- perception log
- audit export log

Why:

- operator-facing
- append-oriented
- easy to inspect with `tail`, `grep`, or log rotation

Important:

> Logs are for operations and debugging, not the canonical source of truth for runtime state.

### 2.3 Skills / Procedures / Templates / Tool Manifests

Examples:

- published skill manifests
- procedure templates
- tool manifests
- reusable prompt assets

Why:

- inspectable
- versionable
- exportable
- suitable for later sharing across Nous instances

### 2.4 Artifacts / Attachments / Exports

Examples:

- screenshots
- generated reports
- exported bundles
- backups
- snapshots
- attachment blobs

Why:

- blob-heavy
- naturally file-shaped
- easier to archive, sign, compress, or move

### 2.5 Cache

Examples:

- HTTP fetch cache
- LLM response cache
- embedding cache
- repo scan cache

Why:

- disposable
- rebuildable
- easier to evict by directory policy than by relational cleanup

---

## 3. What Should Not Be Reduced to Files

These belong in SQLite / structured persistence:

- dialogue threads
- dialogue messages
- message outbox
- intents
- tasks
- conflict analysis records
- structured event history
- memory entries
- provenance graph relations
- evolution proposals
- validation state

Why:

- explicit state machines
- concurrent mutation
- query-heavy access
- ranking / retrieval requirements
- causal and relational structure

If these are stored primarily as scattered files, Nous will lose:

- reliable scheduling
- resumability
- auditability
- retrieval quality
- governance clarity

---

## 4. Dual-Layer Objects

Some entities should exist in **two layers**:

### 4.1 Skills / Procedures

- **DB layer**: provenance, trust, rollout state, validation history, usage metrics
- **File layer**: manifest, executable template, prompt/tool contract

Rule:

> DB governs, files publish.

### 4.2 Artifacts

- **DB layer**: metadata, scope, provenance, ownership, references
- **File layer**: actual artifact blob

### 4.3 Observability

- **DB layer**: canonical structured event history
- **File layer**: human-facing logs

---

## 5. Secret Handling

Secret handling needs a **stage-aware rule**, not a fake-final answer.

### Target architecture

Long term, Nous should prefer:

1. OS keychain / platform secret manager
2. encrypted local secret files
3. plaintext files only as a bootstrap fallback

### V1 rule

V1 is allowed to use **file-based secrets** because:

- users already understand the model
- LLM provider credentials are easier to manage this way today
- usability matters more than premature secret infrastructure complexity

But this should still be structured correctly:

- secrets live under `~/.nous/secrets/`
- secrets are separated from normal config
- code reads secrets through a **SecretStore abstraction**
- current implementation may be `FileSecretStore`
- future implementation can swap to keychain / encrypted storage without changing provider resolution code

So the rule is:

> **V1 uses file-backed secrets for usability, but the architecture must behave as if secrets already belong behind a store boundary.**

For now, `secrets/` may contain provider credentials such as API keys and auth tokens.  
It should **not** become a general-purpose runtime state folder.

---

## 6. Default `~/.nous` Layout

```text
~/.nous/
  config/
    config.json
    providers.json
    sensors.json
    ambient.json
    permissions.json
    memory.json
    logging.json

  daemon/
    nous.sock
    nous.pid
    daemon.json

  state/
    nous.db
    indexes/
    checkpoints/

  logs/
    daemon/
    provider/
    perception/
    crash/
    audit/

  skills/
    manifests/
    procedures/
    templates/

  tools/
    bin/
    manifests/

  artifacts/
    attachments/
    reports/
    exports/
    snapshots/

  cache/
    llm/
    embedding/
    http/
    repo/

  secrets/
    providers.json
    handles.json
    encrypted/

  tmp/
```

`<project>/.nous/` is a **scope-local override boundary**, not a separate persistent identity. It can hold project-local config and optional project assets, but it should not fragment Nous into isolated per-project minds.

---

## 7. Architectural Summary

The storage model should preserve three things at once:

1. **Local-first transparency** — users can inspect and govern important assets
2. **Runtime integrity** — live state and cognition remain queryable and reliable
3. **Future collective intelligence** — exported skills/artifacts are shareable without turning raw runtime state into a transport format

That is why the right model is not "all files" or "all database".

It is:

> **Filesystem for externalization. Database for cognition and governance.**
