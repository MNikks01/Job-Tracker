# Sprint 1 — Foundation + Discovery

> Phase 13 · 2 weeks · Goal: a job can be discovered, normalized, deduped, and stored;
> the system has scaffolding, DB, CI, observability, audit, and budget guard. Read-only
> review list visible in the dashboard shell.

## Sprint goal (demo-able)
"Run discovery against Greenhouse + an RSS feed; see normalized, deduped jobs listed in
the dashboard, with logs/metrics and an audit/budget skeleton in place."

## Committed tasks (~34 pts)
| ID | Task | Pts | Depends on | Owner |
|----|------|-----|------------|-------|
| T-001 | Monorepo skeleton | 3 | — | |
| T-002 | TS/lint/format/hooks | 2 | T-001 | |
| T-003 | Docker Compose (pg/redis/api/worker/dashboard) | 5 | T-001 | |
| T-004 | Prisma schema + migration | 5 | T-003 | |
| T-005 | Typed config + ConfigService | 3 | T-001 | |
| T-006 | Logger + OTel + secret scrubber | 3 | T-001 | |
| T-007 | BullMQ queues + worker + DLQ | 5 | T-003 | |
| T-008 | CI pipeline | 5 | T-002 | |
| T-009 | AuditService (hash-chained) | 5 | T-004 | |
| T-010 | BudgetGuard | 5 | T-005 | |
| T-101 | SourceAdapter interface + registry | 3 | T-005 | |
| T-102 | Greenhouse adapter | 5 | T-101 | |
| T-104 | RSS/Atom adapter | 3 | T-101 | |
| T-105 | Normalizer → Job + provenance | 5 | T-102 | |
| T-106 | DedupeService | 5 | T-105 | |
| T-107 | Discovery worker + scheduler + rate limit | 5 | T-007,T-106 | |
| T-701 | Dashboard shell | 5 | T-003 | |

> Note: total exceeds a strict 34; treat T-103 (Lever) and polish as stretch. Re-point at planning.

## Acceptance for the sprint
- AC-D1 (dedupe) and AC-D2 (rate limit) green.
- CI runs on PRs; secret scan active; no secrets in logs (test passes).
- Audit + budget services unit-tested.
- `docker compose up` → discovery populates jobs → visible in dashboard list.

## Risks / notes
- Start API/feed-only (no Playwright this sprint).
- Keep audit + budget in from day one (cheap now, costly later).
