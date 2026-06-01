# ADR-002 — LangGraph.js for agent orchestration

- **Status:** Accepted (design) · **Amended by [ADR-009](./ADR-009-orchestration-without-langgraph.md)** — *not implemented as written* · 2026-05-30
- ⚠️ **Reconciliation:** the shipped orchestration uses plain TypeScript services + BullMQ +
  PostgreSQL-backed state (state machine, approval rows, hash-chained audit), **not** LangGraph.
  This ADR remains the documented target for when workflows become genuinely graph-shaped; see
  ADR-009 for the rationale and the trigger to revisit.

## Context
The system runs multi-step, stateful, resumable workflows with a human-approval interrupt
in the middle (HITL). We need durable state, explicit control flow, and the ability to
pause/resume a workflow across hours/days. Options: LangGraph.js, a hand-rolled state
machine + queue, CrewAI/AutoGen-style frameworks.

## Decision
Use **LangGraph.js** for the agent graphs, with checkpoints persisted to PostgreSQL.

## Rationale
- First-class **durable state + interrupts** map exactly to our Approval Gate.
- Explicit graph (supervisor + nodes) → auditable, testable control flow vs. emergent
  multi-agent chatter (important when actions affect the user's reputation).
- TypeScript-native → fits the stack and Nikhil's expertise.
- Works cleanly alongside MCP tools + BullMQ workers.

## Consequences
- (+) Resumable HITL workflows, clear control flow, checkpointing.
- (−) Framework learning curve; some coupling to its state model.
- We keep deterministic steps (slot computation, validation) as plain functions, not LLM
  nodes, to reduce cost and increase reliability.

## Alternatives
- Hand-rolled orchestration: maximal control but reinvents checkpointing/interrupts.
- CrewAI/AutoGen: more "autonomous chatter," less explicit control — worse fit for a
  safety-critical, HITL system.
