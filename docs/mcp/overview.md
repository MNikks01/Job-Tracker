# MCP Design — Overview

> Phase 5 · Status: Draft v0.1 · 2026-05-30
> Per-server specs in this folder. All servers are TypeScript, built with the MCP SDK,
> each exposing typed tools (zod/JSON-Schema), a permission model, and rate limits.

## 1. Server catalog
| Server | Purpose | Outward? | Compliance note |
|--------|---------|----------|-----------------|
| `gmail-mcp` | Read mail, draft, send (gated) | Yes (send) | OAuth, least scope |
| `calendar-mcp` | Availability, create events (gated) | Yes (write) | OAuth |
| `jobboards-mcp` | Discover + apply via source adapters | Yes (apply) | APIs/feeds first; Playwright optional |
| `linkedin-mcp` | LinkedIn jobs (feature-flagged) | Yes | **ToS-gated; off by default** |
| `postgres-mcp` | Structured domain data + pgvector | No | internal |
| `redis-mcp` | Queues, cache, locks | No | internal |
| `filesystem-mcp` | Read/write working files | No | sandboxed path |
| `resume-mcp` | Master profile + material versions | No | internal |

## 2. Common conventions
- **Tool naming:** `domain.action` (e.g., `gmail.listMessages`, `jobboards.apply`).
- **Every tool:** typed input + output schemas, idempotency key where it mutates,
  structured errors (`RetryableError | ManualInterventionError | GuardrailError`).
- **Permissions:** each tool declares a scope; the orchestrator passes a capability token.
  Outward/mutating tools additionally require a valid **approval token** in HITL mode.
- **Rate limits:** token-bucket per server + per upstream; configurable; 429 → backoff.
- **Auditing:** every mutating tool call emits an audit event (actor, args hash, result).
- **Observability:** each call traced (OpenTelemetry) + counted (Prometheus).
- **No secrets in args/results/logs**; tokens fetched from the secrets manager internally.

## 3. Permission model (capability + approval)
```ts
interface Capability { server: string; tools: string[]; readOnly: boolean; }
interface ApprovalToken { id: string; opportunityId: string; action: string; expiresAt: string; }
```
- Read tools: need a matching Capability.
- Mutating outward tools (`gmail.send`, `calendar.createEvent`, `jobboards.apply`):
  need Capability **and** a non-expired ApprovalToken bound to the same action +
  opportunity (skippable only in `semi` mode above thresholds, still audited).

## 4. Security model (summary; full in ../security/)
- OAuth tokens stored encrypted; refreshed server-side; never returned to agents.
- Least-privilege Google scopes (read mail metadata/body as needed; send; calendar).
- Per-tool allow-list; deny by default.
- Browser automation (Playwright) runs in an isolated container; no credential reuse
  beyond the target session; never solves CAPTCHAs.

## 5. Interface spec format
Each server doc provides: tool list, input/output schemas (TypeScript/zod), permissions,
rate limits, errors, and example calls.
