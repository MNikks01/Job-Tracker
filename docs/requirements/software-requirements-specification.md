# Software Requirements Specification (SRS)

> Phase 1 · IEEE-830-inspired · Status: Draft v0.1 · 2026-05-30

## 1. Introduction
### 1.1 Purpose
Specify the functional and non-functional software requirements for the Autonomous AI
Job Search Agent, sufficient to drive architecture, design, and implementation.

### 1.2 Scope
Single-user, self-hostable agentic system that automates job discovery, matching,
material tailoring, HITL applying, tracking, recruiter-email handling, scheduling, and
outcome-based learning. See `business-requirements.md` and `product-requirements.md`.

### 1.3 Definitions
| Term | Meaning |
|------|---------|
| Agent | The orchestrated set of LLM-driven workers performing tasks |
| HITL | Human-in-the-loop: human approval required before an outward action |
| Source | A job data provider (API, feed, board) |
| Job | A canonical, normalized job posting record |
| Application | An instance of applying to a Job |
| Opportunity | A Job + Application + conversation thread, end to end |
| Match score | 0–100 fit score of a Job vs. the master profile |
| Confidence | Agent's self-assessed certainty for a given output |
| Master profile | Structured source of truth for Nikhil's facts |

### 1.4 References
`../project-overview.md`, `../architecture/`, `../ai/`, `../mcp/`, `../security/`.

## 2. Overall Description
### 2.1 Product perspective
A locally hosted, container-based system: an orchestrator (LangGraph.js) driving
specialized sub-agents that call tools exposed via MCP servers, backed by PostgreSQL
(+pgvector) and Redis, with a Next.js dashboard as the human control plane.

### 2.2 User classes
Operator (Nikhil), Maintainer (Nikhil), external Recruiters (indirect).

### 2.3 Operating environment
Node.js 20+, Docker Compose, PostgreSQL 16 + pgvector, Redis 7, Anthropic API,
Google OAuth (Gmail, Calendar). Optional AWS deployment.

### 2.4 Constraints
See `../project-overview.md` §8. Notably ToS compliance, HITL default, honesty.

## 3. Functional Requirements

> IDs are stable and referenced by user stories, use cases, tests, and tasks.

### 3.1 Discovery (FR-1xx)
- **FR-101** The system SHALL pull jobs from each enabled Source on a configurable schedule.
- **FR-102** The system SHALL normalize raw postings into the canonical Job schema.
- **FR-103** The system SHALL deduplicate jobs by (normalized title, company, location, source id) and a content hash.
- **FR-104** The system SHALL respect each Source's rate limits and ToS; sources are individually toggleable.
- **FR-105** The system SHALL record provenance (source, fetched_at, raw payload reference) for each Job.

### 3.2 Matching (FR-2xx)
- **FR-201** The system SHALL compute a match score (0–100) for each new Job vs. the master profile.
- **FR-202** The match SHALL combine semantic similarity (embeddings) and rule-based filters (location, seniority, must-have skills, comp floor).
- **FR-203** The system SHALL produce a human-readable rationale and a confidence value per match.
- **FR-204** The system SHALL rank unprocessed Jobs into a prioritized review queue.
- **FR-205** Jobs below a configurable threshold SHALL be auto-archived (not deleted) with reason.

### 3.3 Profile & materials (FR-3xx)
- **FR-301** The system SHALL maintain a structured master profile derived from the resume.
- **FR-302** The system SHALL generate an ATS-friendly, role-tailored resume variant per application, grounded ONLY in master-profile facts.
- **FR-303** The system SHALL generate a tailored cover letter per application.
- **FR-304** The system SHALL run a fabrication-check pass; any unsupported claim SHALL block the material and flag for review.
- **FR-305** Generated materials SHALL be versioned and stored.

### 3.4 Apply (FR-4xx)
- **FR-401** The system SHALL place each application in an approval queue before submission (HITL default mode).
- **FR-402** The system SHALL allow approve / edit / reject / snooze per application.
- **FR-403** On approval, the system SHALL submit via the Source's API or browser automation.
- **FR-404** The system SHALL enforce idempotency: never submit the same (company, role) twice without explicit re-approval.
- **FR-405** The system SHALL record an immutable audit entry (who/what/when + approval link) per submission.
- **FR-406** In semi-autonomous mode (optional), the system SHALL auto-submit only Jobs above a confidence + match threshold, and SHALL still audit-log them.
- **FR-407** On automation failure (CAPTCHA, unknown form), the system SHALL hand off to the human with context rather than guessing.

### 3.5 Tracking (FR-5xx)
- **FR-501** The system SHALL maintain an application lifecycle state machine (see use cases).
- **FR-502** The system SHALL provide current status and full history per Opportunity.
- **FR-503** The system SHALL surface stalled applications (no movement in N days).

### 3.6 Inbox & replies (FR-6xx)
- **FR-601** The system SHALL monitor Gmail for messages relevant to active Opportunities.
- **FR-602** The system SHALL classify messages (recruiter outreach, interview invite, rejection, offer, request-for-info, other).
- **FR-603** The system SHALL link messages to the correct Opportunity (or create one).
- **FR-604** The system SHALL draft a context-aware reply; sending requires approval (HITL).
- **FR-605** The system SHALL validate recipient + thread before any send.

### 3.7 Scheduling (FR-7xx)
- **FR-701** The system SHALL read Nikhil's calendar availability.
- **FR-702** The system SHALL propose interview slots honoring working hours, buffers, and time zones.
- **FR-703** On confirmation, the system SHALL create a calendar event and send the confirming reply.

### 3.8 Learning (FR-8xx)
- **FR-801** The system SHALL capture outcomes per Opportunity (no-response, response, interview, offer, rejection).
- **FR-802** The system SHALL attribute outcomes to features (source, role type, resume variant, score).
- **FR-803** The system SHALL adjust ranking/weights and writing guidance from accumulated outcomes.
- **FR-804** All learning adjustments SHALL be inspectable and reversible.

### 3.9 Control plane (FR-9xx)
- **FR-901** The dashboard SHALL present the review/approval queue with rationales.
- **FR-902** The dashboard SHALL present Opportunity timelines and analytics.
- **FR-903** The system SHALL notify Nikhil (e.g., email/push) when input is required.
- **FR-904** The system SHALL expose configuration (sources, thresholds, schedules, autonomy mode, budgets).

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Security | Secrets encrypted at rest (AES-256/KMS); OAuth tokens never logged. |
| NFR-02 | Security | Least-privilege OAuth scopes; per-tool permission model. |
| NFR-03 | Privacy | All personal data stays in user-controlled infra; only profile-relevant text sent to LLM. |
| NFR-04 | Reliability | Idempotent, resumable jobs; at-least-once with dedupe. |
| NFR-05 | Availability | Local mode best-effort; designed to recover cleanly after restart. |
| NFR-06 | Performance | Recruiter-reply draft ≤ 15 min after receipt; discovery cycle ≤ 30 min. |
| NFR-07 | Scalability | Handle ≥ 5k tracked jobs, ≥ 1k applications without redesign. |
| NFR-08 | Cost | Configurable monthly LLM budget cap with hard stop + alerts. |
| NFR-09 | Observability | Structured logs, agent-decision traces, Prometheus metrics, Grafana dashboards. |
| NFR-10 | Auditability | Immutable audit log for every outward action. |
| NFR-11 | Maintainability | TypeScript, modular MCP tools, ≥ 70% coverage on core logic, ADRs. |
| NFR-12 | Portability | Runs via Docker Compose locally and on AWS with config changes only. |
| NFR-13 | Compliance | Per-source ToS adherence; honesty guardrails enforced in code. |
| NFR-14 | Usability | Approvals doable on mobile in < 30s each. |

## 5. External Interfaces
- **LLM:** Anthropic Messages API (Claude). 
- **Google:** Gmail API, Google Calendar API (OAuth 2.0).
- **Job Sources:** per-source adapters (REST/RSS/GraphQL/browser).
- **Dashboard:** REST/tRPC + WebSocket for live updates.
- **Notifications:** email (SMTP) and/or push.

## 6. Data Requirements
See `../database/`. Core entities: Profile, Job, Application, Material, Message,
Opportunity, Event, Outcome, AuditLog, Embedding, Config, Source.

## 7. Acceptance
See `acceptance-criteria.md`. Each FR maps to ≥ 1 acceptance criterion and ≥ 1 test.
