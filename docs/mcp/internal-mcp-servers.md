# MCP Servers — Postgres, Redis, File System, Resume Storage

> Phase 5 · Status: Draft v0.1 · 2026-05-30
> Internal (non-outward) servers. Still typed, permissioned, audited for mutations.

## A. `postgres-mcp`
### Purpose
Mediated access to the domain database + pgvector. Agents never run arbitrary SQL; they
call typed repository tools.
### Tools (typed repos, not raw SQL)
| Tool | Type | Description |
|------|------|-------------|
| `db.jobs.upsert` / `db.jobs.query` | mutate/read | Jobs |
| `db.applications.transition` | mutate | Apply state-machine transition (validated) |
| `db.opportunities.get` / `.timeline` | read | Opportunity + history |
| `db.messages.insert` / `.link` | mutate | Email records |
| `db.materials.saveVersion` / `.getCurrent` | mutate/read | Resume/cover versions |
| `db.embeddings.upsert` / `.search` | mutate/read | pgvector similarity search |
| `db.audit.append` | mutate(append-only) | Audit records |
| `db.config.get` / `.set` | read/mutate | Runtime config |
### Permissions
Scoped per table-group; `transition` enforces the state machine; `audit.append` is the
only writer to the audit table (append-only, hash-chained). No `delete` tools for audit.
### Rate limits / errors
Connection-pool bounded; `RetryableError` on transient DB errors; `GuardrailError` on
invalid transitions.

## B. `redis-mcp`
### Purpose
Queues (BullMQ), cache, distributed locks, rate-limit buckets.
### Tools
| Tool | Type | Description |
|------|------|-------------|
| `cache.get` / `cache.set` | read/mutate | TTL cache (content-hash keys) |
| `lock.acquire` / `lock.release` | mutate | Distributed locks (idempotency) |
| `queue.enqueue` | mutate | Enqueue a job (usually via core, not agents) |
### Permissions
Internal only; agents mostly use cache + lock. Queue ops generally restricted to core.
### Errors
`RetryableError` on transient Redis failures; lock contention surfaced explicitly.

## C. `filesystem-mcp`
### Purpose
Sandboxed working files (rendered resume PDFs, attachments, temp artifacts).
### Tools
| Tool | Type | Description |
|------|------|-------------|
| `fs.write` / `fs.read` / `fs.list` | mutate/read | Within a configured sandbox root only |
| `fs.renderPdf` | mutate | Render resume HTML/markdown → PDF |
### Permissions / security
- Hard-jailed to `STORAGE_ROOT`; path traversal rejected.
- No execution; no access outside sandbox; size limits.
### Errors
`GuardrailError` on path escape; `RetryableError` on IO transient.

## D. `resume-mcp`
### Purpose
Authoritative master profile + generated material versions (source of truth for grounding).
### Tools
| Tool | Type | Description |
|------|------|-------------|
| `resume.getProfile` | read | Structured master profile |
| `resume.updateProfile` | mutate | Edit profile (operator-driven; audited; re-embeds) |
| `resume.saveVariant` | mutate | Persist a tailored variant version |
| `resume.getVariant` | read | Fetch a variant by id |
### Permissions
- `getProfile` widely readable by Materials/Critic/Matching.
- `updateProfile` restricted to operator-initiated flows; triggers re-embedding.
### Grounding role
Critic validates generated claims against `resume.getProfile`; this server is the single
source of truth for "what is true about Nikhil."
### Errors
`GuardrailError` on schema-invalid profile edits.
