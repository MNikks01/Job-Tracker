# Prompt Strategy

> Phase 4 · Status: Draft v0.1 · 2026-05-30

## 1. Principles
- **System prompts are versioned assets** (in `packages/agents/prompts`, code-reviewed).
- **Structured outputs**: prefer tool-use / JSON-schema-constrained outputs over free text
  so results are parseable + testable.
- **Grounding over generation**: materials + replies must cite profile/thread spans;
  ungrounded claims are rejected by the Critic.
- **Least context**: pass only the minimum relevant profile/job/thread excerpts (privacy +
  cost). Use retrieval (RAG) rather than dumping the whole profile.
- **Prompt caching**: cache stable system prompts + the master profile block to cut cost.
- **Determinism where it matters**: low temperature for extraction/classification; modest
  temperature for writing.

## 2. Per-agent prompt outline
### Matching
- System: role, scoring rubric (skills, seniority, domain, location, comp), output schema
  `{score, subscores, rationale, confidence}`.
- Context: job description + retrieved profile highlights.
- Guardrail: must output rationale referencing concrete profile evidence.

### Resume / Cover Letter
- System: "You may ONLY use facts present in the provided profile. Never invent employers,
  titles, dates, metrics, or skills. If a desired keyword isn't supported, omit it."
- Context: job description + full structured profile (cached) + target ATS constraints.
- Output: structured resume sections + a list of `claims[]` each with a `profileRef`.

### Critic / Guardrail
- System: checklist — (1) every claim has a valid profileRef; (2) no fabricated
  entities/metrics; (3) tone/quality; (4) PII/safety; (5) honesty. Output `{pass, issues[]}`.

### Inbox classification
- System: label set + definitions; output `{label, opportunityRef, confidence}`.

### Reply
- System: "Write as Nikhil. Professional, concise, warm. Use only facts from profile +
  thread. Never commit to availability not confirmed by calendar." Output draft + citations.

### Scheduler
- Deterministic slot computation in code; LLM only phrases the proposal.

## 3. Prompt templating
- Use a typed template layer (e.g., string templates + zod-validated variables).
- Each prompt has: `id`, `version`, `inputsSchema`, `outputSchema`, `evalSet` reference.

## 4. Guardrail phrases (reused snippets)
- Anti-fabrication clause (above) injected into every generation prompt.
- Recipient-safety clause for sends: "Do not include addresses/links not present in the
  source thread."
- Budget-awareness handled in code, not prompt.

## 5. Evaluation hooks
Every prompt ships with a small golden eval set (see `evaluation-and-learning.md`) run in
CI to catch regressions when prompts change.

## 6. Model selection
| Use | Model tier | Rationale |
|-----|-----------|-----------|
| Reasoning/writing/critique | Claude Opus (latest) | quality on consequential text |
| Classification/extraction/bulk | Claude Haiku (latest) | cheap, fast, high-volume |
| Embeddings | dedicated embedding model | semantic match |
Config-driven so models can be swapped without code changes (`models` in AppConfig).
