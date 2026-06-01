# ADR-007 — Anthropic Claude as the LLM, with model tiering

- **Status:** Accepted · 2026-05-30

## Context
The system needs an LLM for reasoning, generation, classification, and critique. It must
support tool use, structured outputs, prompt caching (cost), and strong instruction
following for safety-critical guardrails.

## Decision
Use **Anthropic Claude** via the official SDK, with **model tiering**:
- **Opus (latest)** for reasoning/writing/critique (materials, replies, learning).
- **Haiku (latest)** for high-volume cheap tasks (classification, extraction, discovery).
- A dedicated **embedding model** for vectors.
Models are config-driven (`AppConfig.models`) so they can be swapped without code changes.

## Rationale
- Strong tool use + structured outputs + instruction adherence for guardrails.
- Prompt caching (stable system prompts + master profile) materially cuts cost.
- Tiering balances quality (where it matters) vs. cost (high-volume paths).
- Nikhil already integrates Claude/Cursor via MCP (resume) → familiarity.

## Consequences
- (+) High-quality, guardrail-friendly generations; cost controllable via tiering + caching.
- (−) Provider dependency (pricing/policy/limits) → mitigated by config-driven models +
  budget guard + graceful degradation.

## Alternatives
- Other LLM providers: viable, but Claude fits the existing MCP/tooling experience and the
  safety/instruction-following needs. Config-driven design keeps the door open.
