# Use Cases

> Phase 1 · Status: Draft v0.1 · 2026-05-30

## UC-01 — Discover and rank a job
- **Actor:** System (scheduled), Operator (reviews)
- **Precondition:** ≥1 Source enabled; master profile exists.
- **Main flow:**
  1. Scheduler triggers discovery for each enabled Source.
  2. Adapter fetches postings within rate limits.
  3. System normalizes + dedupes into Job records with provenance.
  4. Matcher computes match score + rationale + confidence (embeddings + rules).
  5. System inserts Job into ranked review queue (or auto-archives if below threshold).
- **Postcondition:** New Jobs are queued with scores; Operator notified if high-value matches appear.
- **Alt/Exception:** Source down → retry w/ backoff, log, continue others. Rate-limited → defer.

## UC-02 — Generate tailored materials
- **Actor:** System, Operator
- **Precondition:** A queued Job selected (manually or auto for top matches).
- **Main flow:**
  1. Resume agent drafts a role-tailored resume from master profile + job description.
  2. Cover-letter agent drafts a tailored letter.
  3. Fabrication-check agent verifies every claim traces to the master profile.
  4. Materials versioned + attached to the prospective Application.
- **Postcondition:** Draft Application with materials ready for review.
- **Exception:** Fabrication detected → block + flag with the offending claim.

## UC-03 — Approve and submit an application (HITL)
- **Actor:** Operator, System
- **Precondition:** Draft Application with materials exists.
- **Main flow:**
  1. Operator opens approval queue, reviews job + resume + cover letter + rationale.
  2. Operator approves (optionally edits).
  3. System checks idempotency (no prior application to this company/role).
  4. Apply agent submits via Source API or browser automation.
  5. System records submission + immutable audit entry; sets state = APPLIED.
- **Postcondition:** Application submitted and tracked.
- **Alt:** Operator rejects → state = REJECTED_BY_USER (kept for learning). Operator snoozes → re-queued.
- **Exception:** CAPTCHA/unknown form → state = NEEDS_MANUAL, hand off with deep link + context.

## UC-04 — Handle a recruiter email
- **Actor:** System, Operator
- **Precondition:** Gmail monitoring active.
- **Main flow:**
  1. System detects new relevant message; classifies it.
  2. System links message to the matching Opportunity (or creates one).
  3. Reply agent drafts a response using thread + application context.
  4. Operator reviews; system validates recipient + thread; Operator approves.
  5. System sends reply; updates Opportunity timeline.
- **Postcondition:** Reply sent (or queued); timeline updated.
- **Exception:** Ambiguous link → flag for manual association. Classified as offer → escalate/notify.

## UC-05 — Schedule an interview
- **Actor:** System, Operator
- **Precondition:** Message classified as interview invite/request.
- **Main flow:**
  1. Scheduler reads calendar availability (working hours, buffers, TZ).
  2. System proposes 3 candidate slots in a drafted reply.
  3. Recruiter/Operator confirms a slot (via reply parsing or manual select).
  4. System creates calendar event + sends confirmation.
- **Postcondition:** Event booked; Opportunity = INTERVIEW_SCHEDULED.
- **Exception:** No mutual availability → propose wider window / escalate.

## UC-06 — Learn from an outcome
- **Actor:** System
- **Precondition:** Opportunity reaches a terminal/teaching signal (response, rejection, interview, offer, ghosted).
- **Main flow:**
  1. System records outcome + features (source, role, resume variant, score).
  2. Learning job updates feature weights / writing guidance.
  3. Changes logged + made inspectable; future ranking reflects them.
- **Postcondition:** Updated, reversible model parameters/guidance.

## UC-07 — Configure the system
- **Actor:** Operator
- **Main flow:** Operator edits sources, schedules, thresholds, autonomy mode, budget caps via dashboard; system validates + applies.
- **Postcondition:** New config in effect; change audited.

## UC-08 — Enforce budget cap
- **Actor:** System
- **Main flow:** Each LLM call checks running spend; on nearing cap → alert; on reaching cap → pause non-critical LLM work + notify.
- **Postcondition:** Spend stays within cap.

## Application Lifecycle State Machine
```
DISCOVERED → MATCHED → MATERIALS_DRAFTED → PENDING_APPROVAL
PENDING_APPROVAL → APPLIED | REJECTED_BY_USER | SNOOZED | NEEDS_MANUAL
APPLIED → RESPONDED | GHOSTED
RESPONDED → INTERVIEW_SCHEDULED | REJECTED_BY_COMPANY | INFO_REQUESTED
INTERVIEW_SCHEDULED → INTERVIEWED → OFFER | REJECTED_BY_COMPANY
OFFER → ACCEPTED | DECLINED
(any) → ARCHIVED
```
