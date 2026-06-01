# ADR-009 — Orchestration via plain services + BullMQ + DB state (not LangGraph, yet)

- **Status:** Accepted · 2026-05-31
- **Amends:** ADR-002 (Use LangGraph.js for agent orchestration)

## Context
ADR-002 selected **LangGraph.js** for durable, resumable, human-in-the-loop workflows, with
an interrupt node as the approval gate and graph checkpoints for resumability. During
implementation the loop was instead built as **plain TypeScript services** — `DiscoveryService`,
`prepareMaterials`, `queue:build` / `queue:approve`, `apply:run` — coordinated by **BullMQ**
(scheduling/queues) with **PostgreSQL as the durable state**: the application **state machine**,
`approval` rows (the HITL gate), and the hash-chained `audit_log`.

No LangGraph code exists. ADR-002 therefore describes an orchestrator that isn't in the
codebase — a documentation-vs-implementation drift this ADR reconciles (mirroring ADR-008 for MCP).

## Decision
Keep **plain services + BullMQ + DB-backed state** as the orchestration model for now.

- **HITL "interrupt"** = persist the application at `pending_approval` + open an `approval` row;
  it is "resumed" when a human approves via the dashboard/CLI. This is durable across process
  restarts because the state lives in Postgres, not in an in-memory graph checkpoint.
- **Resumability / idempotency** come from the state machine + idempotency keys + at-least-once
  BullMQ with idempotent consumers — not from graph checkpoints.
- **Control flow** is explicit code, which is simple to read, test, and audit.

## Rationale
- It's what actually shipped and is **tested** (state machine, approval domain, audit chain,
  discovery/materials/apply paths — 91 tests).
- The durability/resumability ADR-002 wanted is provided by Postgres regardless of framework.
- Fewer dependencies and no framework lock-in for a single-operator system.
- LangGraph's real value — dynamic, LLM-driven branching across many agent steps — isn't needed
  by the current mostly-linear pipeline with a single human gate.

## Consequences
- (+) Shipped, tested, durable HITL with an inspectable DB trail.
- (−) ADR-002 is now **aspirational**: the architecture docs that show LangGraph graphs +
  interrupt nodes describe the *conceptual* model; the *concrete* implementation is
  services + BullMQ + DB state. The architecture docs note this pointer.
- **Revisit LangGraph** when workflows become genuinely graph-shaped — e.g. an LLM-driven agent
  that dynamically chooses among many tools/branches per step, or multi-agent loops that need
  checkpointed mid-graph state beyond what the application state machine captures. At that point
  adopt LangGraph for those graphs and supersede this ADR.

## Related
- ADR-002 (LangGraph — amended here) · ADR-008 (MCP rollout — same honest reconciliation pattern)
- ADR-003 (Playwright) is **documented but deferred / not implemented** — the apply path is
  API + dry-run only; browser automation has not been built (see ADR-003 status note).
