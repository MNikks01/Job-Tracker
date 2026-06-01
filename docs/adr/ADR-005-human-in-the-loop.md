# ADR-005 — Human-in-the-loop by default; semi-autonomous opt-in

- **Status:** Accepted · 2026-05-30

## Context
The system performs outward actions in Nikhil's name (applications, emails, calendar
invites). Mistakes are reputational and sometimes irreversible. Fully autonomous apply/send
maximizes throughput but maximizes risk and ToS exposure.

## Decision
Default autonomy = **HITL**: the agent drafts everything but pauses at an **Approval Gate**
before any outward action. Provide an **opt-in semi-autonomous** mode that auto-acts only
when `match ≥ M` **and** `confidence ≥ C` **and** the Critic passes — still fully audited.
Fully autonomous (no gate) is **not** offered by default.

## Rationale
- Trust + safety are the product's differentiator vs. spray-and-pray bots.
- HITL bounds the blast radius of model errors and prompt injection.
- Semi-auto gives throughput for obvious fits without abandoning control.

## Consequences
- (+) Near-zero risk of unapproved/embarrassing actions; clear audit trail.
- (−) Requires daily operator attention; lower raw throughput than full auto.
- Implementation: Approval Gate is a LangGraph interrupt + ApprovalService + audit binding;
  outward MCP tools require a valid approval token.

## Alternatives
- Full autonomy: higher throughput, unacceptable risk/ToS exposure for v1. Rejected as default.
