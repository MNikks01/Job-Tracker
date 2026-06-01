# Evaluation, Learning & Confidence

> Phase 4 · Status: Draft v0.1 · 2026-05-30

## 1. Evaluation strategy
### Offline (CI) — golden sets
| Capability | Eval | Metric |
|-----------|------|--------|
| Matching | labeled job/profile pairs | rank correlation, precision@k vs. operator labels |
| Resume tailoring | JD + profile fixtures | keyword coverage, **fabrication = 0** (assert), ATS lint |
| Fabrication check | injected-fabrication fixtures | recall of fabricated claims (target 100%) |
| Classification | labeled emails | accuracy/F1 per label |
| Reply drafting | thread fixtures | rubric score (LLM-as-judge) + safety asserts |
| Scheduling | availability fixtures | constraint satisfaction (deterministic) |

- LLM-as-judge for subjective quality, with a fixed rubric + the real Claude model;
  results tracked over time to catch regressions when prompts/models change.
- Hard assertions (fabrication, recipient safety, budget) are non-negotiable gates in CI.

### Online — production telemetry
- Track funnel metrics (overview §4) per source/role/resume-variant.
- Shadow/dry-run mode for new prompts before they affect real actions.

## 2. Learning strategy
- **Signals:** response, interview, rejection, offer, ghosted; operator approvals/edits;
  operator relevance ratings.
- **What learns:**
  - Matching weights (skills/seniority/domain/location/comp subscore weights).
  - Source priority (which sources convert).
  - Writing guidance (procedural memory: phrasings/structures that converted).
  - Resume-variant selection (A/B over time).
- **How:** lightweight, interpretable updates first — weighted logistic/Bayesian update on
  subscore weights; retrieval of "what worked" for writing. **No opaque fine-tuning in v1.**
- **Safety:** every update is versioned, logged, inspectable, and reversible (FR-804);
  operator can pin/rollback.

## 3. Operator feedback loop
- Each approval, edit, or rejection is a labeled training signal stored with the artifact.
- Edits become preferred examples for future generations (few-shot from past accepted work).

## 4. Confidence scoring
- Each agent emits a `confidence ∈ [0,1]`. Sources of confidence:
  - Matching: calibrated from subscore agreement + retrieval similarity.
  - Generation: self-rated + Critic agreement + citation coverage.
  - Classification: model probability / self-consistency.
- **Calibration:** periodically compare predicted confidence vs. realized correctness on
  labeled data; adjust thresholds.
- **Use of confidence:**
  - HITL mode: confidence shown to operator to prioritize review.
  - Semi-autonomous mode: auto-act only when `match ≥ M` **and** `confidence ≥ C`
    **and** Critic passes; otherwise route to human.
  - Low confidence anywhere → escalate rather than guess.

## 5. Guardrail metrics (must stay green)
- Fabrication incidents in production: 0.
- Unapproved outward actions: 0 (HITL).
- Mis-sent messages: 0.
- Budget overruns: 0.
These are alerting SLOs, not just dashboards.
