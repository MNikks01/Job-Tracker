# User Stories

> Phase 1 · Status: Draft v0.1 · 2026-05-30
> Format: `As a <role>, I want <capability>, so that <benefit>.` Each story lists
> linked FR IDs and a story-point estimate (Fibonacci).

## Epic A — Discovery & Matching
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-A1 | As the operator, I want jobs pulled automatically from my chosen sources, so that I don't have to browse boards. | FR-101..105 | 8 |
| US-A2 | As the operator, I want each job scored against my profile with a reason, so that I trust the ranking. | FR-201..204 | 8 |
| US-A3 | As the operator, I want irrelevant jobs auto-filtered (but recoverable), so that my queue stays high-signal. | FR-205 | 3 |
| US-A4 | As the operator, I want duplicate postings merged, so that I don't review the same job twice. | FR-103 | 3 |

## Epic B — Materials
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-B1 | As the operator, I want a tailored resume per role grounded in real facts, so that I'm relevant but honest. | FR-301..305 | 13 |
| US-B2 | As the operator, I want a tailored cover letter, so that I stand out without writing each one. | FR-303 | 5 |
| US-B3 | As the operator, I want the system to block any fabricated claim, so that I never misrepresent myself. | FR-304 | 5 |

## Epic C — Apply (HITL)
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-C1 | As the operator, I want to approve/edit/reject applications in a queue, so that nothing goes out without me. | FR-401,402 | 8 |
| US-C2 | As the operator, I want approved applications submitted automatically, so that I save time. | FR-403,407 | 13 |
| US-C3 | As the operator, I want a guarantee I never double-apply, so that I look professional. | FR-404 | 3 |
| US-C4 | As the operator, I want an audit record per submission, so that I can verify what happened. | FR-405 | 3 |
| US-C5 | As the operator, I want an optional auto-apply mode above a threshold, so that obvious fits go faster. | FR-406 | 8 |

## Epic D — Tracking
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-D1 | As the operator, I want every application's status in one place, so that nothing slips. | FR-501,502 | 5 |
| US-D2 | As the operator, I want stalled applications flagged, so that I can follow up. | FR-503 | 3 |

## Epic E — Inbox & Replies
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-E1 | As the operator, I want recruiter emails detected and linked to the right application, so that context is unified. | FR-601..603 | 8 |
| US-E2 | As the operator, I want context-aware replies drafted for me, so that I respond fast and well. | FR-604 | 8 |
| US-E3 | As the operator, I want recipient/thread verified before any send, so that I never mis-send. | FR-605 | 3 |

## Epic F — Scheduling
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-F1 | As the operator, I want interview slots proposed from my real availability, so that I avoid conflicts. | FR-701,702 | 8 |
| US-F2 | As the operator, I want a confirmed slot to create the event and reply, so that booking is one tap. | FR-703 | 5 |

## Epic G — Learning & Analytics
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-G1 | As the operator, I want outcomes recorded per opportunity, so that the system can learn. | FR-801,802 | 5 |
| US-G2 | As the operator, I want ranking/writing to improve from outcomes, so that results compound. | FR-803,804 | 13 |
| US-G3 | As the operator, I want funnel analytics, so that I know what's working. | FR-902 | 5 |

## Epic H — Control Plane & Ops
| ID | Story | FRs | Pts |
|----|-------|-----|-----|
| US-H1 | As the operator, I want a dashboard for review and approvals, so that I run everything from one screen. | FR-901,902 | 13 |
| US-H2 | As the operator, I want notifications when I'm needed, so that I'm not babysitting. | FR-903 | 3 |
| US-H3 | As the operator, I want to configure sources/thresholds/budgets, so that I stay in control. | FR-904 | 5 |
| US-H4 | As the maintainer, I want logs, traces, and metrics, so that I can debug and trust the system. | NFR-09 | 5 |
| US-H5 | As the operator, I want a hard budget cap on LLM spend, so that costs never surprise me. | NFR-08 | 3 |
