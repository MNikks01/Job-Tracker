# Business Requirements Document (BRD)

> Phase 1 · Status: Draft v0.1 · Owner: Nikhil Meshram · 2026-05-30

## 1. Purpose
Define the business rationale, objectives, scope, and success criteria for the
Autonomous AI Job Search Agent ("the Agent"). This document frames *why* the system
exists and *what business outcomes* it must deliver, independent of implementation.

## 2. Business Background
Nikhil is an employed Senior Full-Stack Engineer conducting a passive-to-active job
search. A high-quality search (volume of tailored, relevant applications + timely
follow-ups) competes directly with a full-time job for time. Manual job searching is
repetitive and low-leverage: searching boards, re-tailoring resumes, writing cover
letters, filling forms, and tracking dozens of threads. The opportunity is to automate
the mechanical 80% while preserving human judgment on the consequential 20%.

## 3. Business Objectives
| ID | Objective | Measure of Success |
|----|-----------|--------------------|
| BO-1 | Increase qualified interview pipeline | ≥ 1 qualified interview/week within 8 weeks of use |
| BO-2 | Reduce time spent on job search | ≥ 10 hrs/week of manual effort displaced |
| BO-3 | Improve application quality/relevance | ≥ 70% of applications to roles Nikhil rates ≥ 7/10 fit |
| BO-4 | Faster recruiter follow-up | Median reply draft ready ≤ 15 min after recruiter email |
| BO-5 | Zero reputational incidents | 0 mis-sent or fabricated communications |

## 4. Scope
**In scope:** single-user job search automation across discovery, matching, tailoring,
HITL applying, tracking, inbox monitoring, reply drafting, scheduling, and learning.

**Out of scope:** multi-user SaaS, automated CAPTCHA solving, bot-detection evasion,
mass/spam applying, any dishonest representation, acting for third parties.

## 5. Stakeholders
| Stakeholder | Interest |
|-------------|----------|
| Nikhil (Operator/Owner/Maintainer) | Pipeline, control, low cost, low risk |
| Recruiters/Hiring managers (external) | Honest, relevant, human-quality contact |
| Platform providers (Gmail, job boards) | ToS compliance, rate respect |
| Anthropic (LLM provider) | Acceptable-use compliance |

## 6. Business Rules
- BR-1: No outward action without an approval record (HITL default).
- BR-2: All generated content must be factually grounded in the master profile.
- BR-3: Respect per-source rate limits and ToS; APIs/feeds preferred over scraping.
- BR-4: One application per (company, role) unless explicitly re-approved.
- BR-5: All personal data remains in Nikhil-controlled infrastructure.
- BR-6: Spending on LLM/API must stay within a configurable monthly budget cap.

## 7. Cost / Benefit
- **Costs:** LLM API usage, optional cloud infra, development/maintenance time.
- **Benefits:** reclaimed time, larger + higher-quality pipeline, faster follow-ups,
  data-driven insight into what works (which resumes/roles convert).

## 8. Assumptions & Dependencies
See `../project-overview.md` §9. Key dependency: Anthropic API + Google OAuth + ≥1
compliant job source.

## 9. Acceptance (business level)
The system is business-accepted when, over a 4-week trial, it sustains the funnel
targets in `../project-overview.md` §4 with zero safety incidents.
