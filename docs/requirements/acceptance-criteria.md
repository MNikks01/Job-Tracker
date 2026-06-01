# Acceptance Criteria

> Phase 1 · Status: Draft v0.1 · 2026-05-30
> Gherkin-style. Each maps to FRs and to tests in the implementation phase.

## Discovery
**AC-D1 (FR-101/103)**
- Given two enabled sources returning an overlapping posting
- When a discovery cycle runs
- Then exactly one canonical Job exists for that posting, with both sources recorded as provenance.

**AC-D2 (FR-104)**
- Given a source with a 60 req/min limit
- When discovery runs
- Then the system issues ≤ 60 requests/min and never exceeds the configured limit.

## Matching
**AC-M1 (FR-201/203)**
- Given a new Job and an existing master profile
- When matching runs
- Then the Job has an integer score 0–100, a non-empty rationale, and a confidence in [0,1].

**AC-M2 (FR-202)**
- Given a Job whose location violates a hard location filter
- When matching runs
- Then the Job is auto-archived with reason "location filter", regardless of semantic score.

## Materials
**AC-B1 (FR-302/304)**
- Given a generated resume variant
- When the fabrication-check runs
- Then every bullet's claimed skill/role/date is traceable to the master profile, or the material is blocked and flagged.

**AC-B2 (FR-305)**
- Given two generations for the same Job
- Then both are stored as distinct versions and the latest is marked current.

## Apply (HITL)
**AC-C1 (FR-401)**
- Given an application in PENDING_APPROVAL and HITL mode
- When no approval exists
- Then the system never submits it.

**AC-C2 (FR-404)**
- Given a prior APPLIED application to (CompanyX, RoleY)
- When a new application to the same (CompanyX, RoleY) reaches submission
- Then submission is blocked unless an explicit re-approval flag is set.

**AC-C3 (FR-405)**
- Given an approved submission
- Then an immutable audit record exists with actor, timestamp, payload hash, and approval reference.

**AC-C4 (FR-407)**
- Given a CAPTCHA or unrecognized form during automation
- Then the application moves to NEEDS_MANUAL with a context link, and nothing is guessed/submitted.

## Inbox & Replies
**AC-E1 (FR-602/603)**
- Given a new recruiter email about an active application
- Then it is classified and linked to the correct Opportunity within one monitoring cycle.

**AC-E2 (FR-604/605)**
- Given a drafted reply
- When the operator approves
- Then the system verifies recipient + thread id match the source message before sending; mismatch blocks the send.

## Scheduling
**AC-F1 (FR-702)**
- Given calendar availability and an interview request
- Then proposed slots fall within configured working hours, respect buffers, and are in the recruiter's stated time zone.

## Learning
**AC-G1 (FR-803/804)**
- Given ≥ N recorded outcomes
- When the learning job runs
- Then ranking weights change in an inspectable, logged, reversible way.

## Non-Functional
**AC-N1 (NFR-06)** Recruiter-reply drafts are ready ≤ 15 min after receipt (P50).
**AC-N2 (NFR-08)** When spend reaches the cap, non-critical LLM work pauses and the operator is alerted.
**AC-N3 (NFR-01)** No OAuth token or secret appears in any log line (verified by a log-scan test).
**AC-N4 (NFR-10)** Every outward action (apply/send/schedule) has a corresponding audit record.

## Definition of Done (global)
- Code + tests merged; coverage ≥ 70% on touched core logic.
- FRs satisfied + acceptance criteria green.
- Docs + CLAUDE.md updated; ADR added if a notable decision was made.
- No secrets in logs; audit entries present for outward actions.
