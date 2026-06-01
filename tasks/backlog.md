# Backlog

> Phase 13 · Status: Draft v0.1 · 2026-05-30
> Source of truth for executable tasks. IDs `T-###`. Each links FR/AC + sprint. Pts = Fibonacci.
> Status: ☐ todo · ◐ in-progress · ✓ done. (Implementation has NOT started — approval gate pending.)

## Epic 0 — Foundation (Sprint 1)
| ID | Task | FR/NFR | Pts | St |
|----|------|--------|-----|----|
| T-001 | Init TurboRepo + PNPM workspace, apps/packages skeleton | NFR-11 | 3 | ✓ |
| T-002 | Base TS config, ESLint/Prettier, commit hooks | NFR-11 | 2 | ◐ (eslint/hooks pending) |
| T-003 | Docker Compose: postgres(pgvector), redis, api, worker, dashboard | NFR-12 | 5 | ◐ (pg+redis done; app svcs later) |
| T-004 | Prisma schema from docs/database/schema.sql + first migration | FR-6xx data | 5 | ◐ (schema authored; migrate deferred) |
| T-005 | Typed config (zod) + ConfigService + .env.example | FR-904 | 3 | ✓ |
| T-006 | Logger (pino) + OpenTelemetry + secret scrubber | NFR-09 | 3 | ◐ (pino+redaction done; OTel later) |
| T-007 | BullMQ queues + worker bootstrap + DLQ | NFR-04 | 5 | ◐ (worker+repeatable done; DLQ later) |
| T-008 | CI: lint/typecheck/test/secret-scan/build | NFR-11 | 5 | ◐ (typecheck/test/gitleaks done) |
| T-009 | AuditService (append-only, hash-chained) + tests | NFR-10 | 5 | ✓ |
| T-010 | BudgetGuard (spend tracking, cap, alerts) | NFR-08 | 5 | ✓ |

## Epic 1 — Discovery (Sprint 1)
| ID | Task | FR | Pts | St |
|----|------|----|-----|----|
| T-101 | SourceAdapter interface + registry + per-source config | FR-104 | 3 | ✓ |
| T-102 | Greenhouse adapter (discover) | FR-101 | 5 | ✓ |
| T-103 | Lever adapter (discover) | FR-101 | 3 | ✓ |
| T-104 | RSS/Atom adapter | FR-101 | 3 | ✓ |
| T-105 | Normalizer → canonical Job + provenance | FR-102/105 | 5 | ✓ |
| T-106 | DedupeService (canonical key + content hash) | FR-103 | 5 | ✓ (canonical key; content-hash secondary later) |
| T-107 | Discovery worker + scheduler + rate limiting | FR-101/104 | 5 | ◐ (worker+schedule done; rate-limit exec later) |

## Epic 2 — Matching (Sprint 2)
| ID | Task | FR | Pts | St |
|----|------|----|-----|----|
| T-201 | Profile ingest from MERN_Nikhil.pdf → structured profile + seed | A2 | 5 | ☐ |
| T-202 | Chunk + embed profile (pgvector) | FR-201 | 5 | ☐ |
| T-203 | Job embedding + ANN index | FR-201 | 3 | ☐ |
| T-204 | Rule filters (location/seniority/must-have/comp) | FR-202 | 5 | ☐ |
| T-205 | Matching agent: subscores + score + rationale + confidence | FR-201/203 | 8 | ☐ |
| T-206 | Ranked review queue + auto-archive below threshold | FR-204/205 | 3 | ☐ |

## Epic 3 — Materials + Critic (Sprint 2)
| ID | Task | FR | Pts | St |
|----|------|----|-----|----|
| T-301 | Resume agent (grounded, ATS-friendly) + claims[] | FR-302 | 8 | ☐ |
| T-302 | Cover-letter agent | FR-303 | 5 | ☐ |
| T-303 | Critic/Guardrail: claim→profileRef validation | FR-304 | 8 | ☐ |
| T-304 | Material versioning + PDF render (filesystem-mcp) | FR-305 | 5 | ☐ |
| T-305 | Fabrication eval set + CI gate (recall 100%) | eval | 3 | ☐ |

## Epic 4 — Apply HITL + Tracking (Sprint 3)
| ID | Task | FR | Pts | St |
|----|------|----|-----|----|
| T-401 | ApprovalService + approval tokens + interrupt wiring | FR-401/402 | 8 | ☐ |
| T-402 | State machine (Application/Opportunity) + transitions | FR-501 | 5 | ☐ |
| T-403 | IdempotencyService (no double-apply) | FR-404 | 3 | ☐ |
| T-404 | jobboards.apply via API adapter + audit | FR-403/405 | 8 | ☐ |
| T-405 | Playwright apply adapter + NEEDS_MANUAL fallback | FR-403/407 | 8 | ☐ |
| T-406 | Stalled-application detection | FR-503 | 3 | ☐ |

## Epic 5 — Gmail + Replies (Sprint 4)
| ID | Task | FR | Pts | St |
|----|------|----|-----|----|
| T-501 | Google OAuth flow + encrypted token store | NFR-01 | 8 | ☐ |
| T-502 | gmail-mcp: list/get/thread/labels | FR-601 | 5 | ☐ |
| T-503 | Inbox agent: classify + link to opportunity | FR-602/603 | 8 | ☐ |
| T-504 | Reply agent: draft + citations | FR-604 | 5 | ☐ |
| T-505 | gmail.sendReply with recipient/thread validation | FR-605 | 3 | ☐ |

## Epic 6 — Scheduling (Sprint 5)
| ID | Task | FR | Pts | St |
|----|------|----|-----|----|
| T-601 | calendar-mcp: availability + proposeSlots (deterministic) | FR-701/702 | 5 | ☐ |
| T-602 | createEvent (gated) + confirm reply | FR-703 | 5 | ☐ |
| T-603 | Scheduler agent + TZ/buffer/working-hours handling | FR-702 | 3 | ☐ |

## Epic 7 — Analytics + Dashboard (Sprints 1–5, incremental)
| ID | Task | FR | Pts | St |
|----|------|----|-----|----|
| T-701 | Dashboard shell (Next.js + Tailwind + TanStack + WS) | FR-901 | 5 | ☐ |
| T-702 | Approval Queue + Application Detail | FR-901 | 8 | ☐ |
| T-703 | Pipeline Kanban + Conversations | FR-902 | 5 | ☐ |
| T-704 | Analytics (funnel/conversion/cost) | FR-902 | 5 | ☐ |
| T-705 | Settings (sources/profile/autonomy/budget) | FR-904 | 5 | ☐ |
| T-706 | NotificationService (email/push) | FR-903 | 3 | ☐ |

## Epic 8 — Learning + Hardening (Sprint 6)
| ID | Task | FR/NFR | Pts | St |
|----|------|--------|-----|----|
| T-801 | Outcome capture + features | FR-801/802 | 5 | ☐ |
| T-802 | Learning agent: weight/guidance updates (versioned, reversible) | FR-803/804 | 8 | ☐ |
| T-803 | Eval harness in CI (matching/classification/reply rubric) | eval | 5 | ☐ |
| T-804 | Semi-autonomous mode (thresholds) | FR-406 | 5 | ☐ |
| T-805 | Security checklist pass + pen-test of guardrails | NFR-* | 5 | ☐ |
| T-806 | Grafana dashboards + alerts | NFR-09 | 3 | ☐ |
| T-807 | (Optional) AWS deploy (ECS/RDS/ElastiCache) | NFR-12 | 8 | ☐ |
