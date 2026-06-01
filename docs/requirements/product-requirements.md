# Product Requirements Document (PRD)

> Phase 1 · Status: Draft v0.1 · Owner: Nikhil Meshram · 2026-05-30

## 1. Problem Statement
Running a serious job search while employed is a part-time job itself. The repetitive
work (search, tailor, write, apply, track, follow up) crowds out the high-value work
(deciding what to apply to, how to present, how to negotiate). Nikhil needs an agent
that does the mechanical work to a high standard and asks for approval before anything
leaves his name.

## 2. Target User
Primary: Nikhil — senior engineer, time-poor, technically self-sufficient, wants
leverage without losing control. See personas in `../project-overview.md` §5.

## 3. Product Principles
1. **Human-in-the-loop by default.** The agent proposes; the human disposes.
2. **Honesty over volume.** Never fabricate; never spam.
3. **Explainable.** Every match score and decision has a readable rationale.
4. **Reversible & auditable.** Everything is logged; nothing irreversible happens silently.
5. **Personal & private.** Runs on the user's own infra.
6. **Compounding.** The system learns from outcomes and improves.

## 4. Features (prioritized)

### P0 — MVP (must have)
| ID | Feature | Description |
|----|---------|-------------|
| F-01 | Job discovery | Pull jobs from configured compliant sources on a schedule |
| F-02 | Canonical job store | Normalize + dedupe jobs into one schema |
| F-03 | Match & rank | Score job↔profile fit with explanation + confidence |
| F-04 | Master profile | Structured store of Nikhil's facts (from resume) |
| F-05 | Resume tailoring | Generate role-specific, fact-grounded resume variant |
| F-06 | Cover letter | Generate tailored cover letter |
| F-07 | Approval queue | Review/approve/reject/edit before applying |
| F-08 | Apply (HITL) | Submit application via API/form after approval |
| F-09 | Application tracking | Lifecycle state machine per application |
| F-10 | Dashboard | Web control plane (review, approve, view status) |
| F-11 | Notifications | Alert when human input needed |

### P1 — Communications & scheduling
| ID | Feature | Description |
|----|---------|-------------|
| F-12 | Gmail monitoring | Detect + classify recruiter emails, link to applications |
| F-13 | Reply drafting | Draft context-aware replies (send after approval) |
| F-14 | Calendar scheduling | Read availability, propose + create interview events |
| F-15 | Thread timeline | Unified conversation view per opportunity |

### P2 — Intelligence & analytics
| ID | Feature | Description |
|----|---------|-------------|
| F-16 | Outcome capture | Record responses/rejections/interviews/offers |
| F-17 | Learning loop | Tune matching + writing from outcomes |
| F-18 | Analytics | Funnel, conversion, source/role performance |
| F-19 | Resume A/B | Compare variant performance |
| F-20 | Semi-autonomous mode | Auto-apply above confidence threshold |

## 5. User Experience (high level)
- **Daily review flow:** Notification → open dashboard → see ranked, pre-drafted
  applications → approve/edit/reject in batch → agent executes approved ones.
- **Inbox flow:** Recruiter emails → agent drafts reply → Nikhil approves/edits/sends.
- **Scheduling flow:** Interview request → agent proposes slots from calendar → Nikhil
  confirms → event created + reply sent.
- See `../product/` for screens, flows, wireframes.

## 6. Non-Goals
Multi-user, CAPTCHA solving, evasion, mass applying, dishonest content.

## 7. Release Criteria (per phase)
- **MVP:** A job can travel discovery → match → tailored docs → approval → submitted →
  tracked, with zero unapproved submissions.
- **P1:** A recruiter email produces a linked, drafted reply and a calendar proposal.
- **P2:** The system reports funnel analytics and demonstrably adjusts ranking from
  at least one outcome signal.

## 8. Metrics
Mirror `../project-overview.md` §4 (funnel + quality/safety).

## 9. Dependencies & Risks
See BRD §8 and `../project-overview.md` §10.
