# Sprint 3 — Apply (HITL) + Tracking

> Phase 13 · 2 weeks · Goal: an approved application is submitted via API (with a Playwright
> fallback), idempotently, with an immutable audit record and full lifecycle tracking.

## Sprint goal (demo-able)
"Approve an application in the queue → it submits to a real source via API → an audit
record is written → its lifecycle state is tracked → double-apply is impossible → a
CAPTCHA/unknown form routes to NEEDS_MANUAL instead of guessing."

## Committed tasks (~37 pts)
| ID | Task | Pts | Depends on |
|----|------|-----|------------|
| T-401 | ApprovalService + tokens + LangGraph interrupt | 8 | T-009,T-303 |
| T-402 | State machine (Application/Opportunity) | 5 | T-004 |
| T-403 | IdempotencyService (no double-apply) | 3 | T-402 |
| T-404 | jobboards.apply (API adapter) + audit | 8 | T-401,T-403 |
| T-405 | Playwright apply adapter + NEEDS_MANUAL | 8 | T-404 |
| T-406 | Stalled-application detection | 3 | T-402 |
| T-703 | Pipeline Kanban + Conversations (tracking UI) | 5 | T-702,T-402 |
| T-706 | NotificationService (approval needed) | 3 | T-401 |

## Acceptance for the sprint
- AC-C1 (no unapproved submit), AC-C2 (no double-apply), AC-C3 (audit), AC-C4 (NEEDS_MANUAL) green.
- Approval interrupt pauses + resumes a workflow across a restart (durable checkpoint).
- AC-N4 (every outward action audited) verified.

## Risks / notes
- Critic gate from Sprint 2 MUST be green before any apply path ships (safety-before-action).
- Test idempotency + audit hash-chain thoroughly; these are the system's integrity backbone.
- Browser automation: per-source toggle default OFF; isolated container; never solve CAPTCHA.

---
## Beyond Sprint 3
Sprints 4–6 (Gmail+Replies, Scheduling+Analytics, Learning+Hardening) are detailed in
`backlog.md` Epics 5–8 and `../docs/implementation/roadmap.md`. They'll get full sprint
files at their planning time, following the same template.
