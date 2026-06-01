# ADR-008 — MCP servers: in-process tools now, protocol boundary incrementally

- **Status:** Accepted · 2026-05-31
- **Supplements:** ADR-004 (Use MCP as the tool boundary)

## Context
ADR-004 committed to MCP as *the* tool boundary — agents touch the outside world only via
MCP servers. During the build, tools were first implemented as **direct in-process typed
adapters/repositories** (`GreenhouseAdapter`, `PgJobRepository`, `LlmClient`, the apply
adapter, etc.) called straight from the worker/orchestrator. This was the fastest path to a
working, tested end-to-end loop.

This created a real gap between the documented architecture (everything via MCP) and the
implementation (in-process calls).

## Decision
Adopt a **two-consumer** view of the tool layer, and roll MCP out incrementally:

1. **The orchestrator (same process)** calls tools via the **typed adapters/repositories
   directly.** The contract (typed inputs/outputs) and the permission gate (approval tokens
   + state machine) already live in those modules, so an extra protocol hop adds latency and
   moving parts without new safety for the in-process caller.
2. **External MCP clients** (Claude Desktop, Cursor, Claude Code) and the "uniform,
   inspectable boundary" goal are served by **MCP servers that wrap the same modules.** A
   reference server (`apps/mcp-jobs`, tools `jobs.search` + `matches.top`, backed by the
   existing `db` repositories) is built and **verified over real MCP/stdio**. The remaining
   servers from `docs/mcp/` (gmail, calendar, jobboards, etc.) follow the identical pattern
   and are added as their underlying adapters mature / OAuth lands.

## Rationale
- Keeps the safety-critical path (HITL gate, audit) simple and already-tested.
- Still delivers MCP's real value — external-client access + a reusable, inspectable
  boundary — without blocking the core loop on protocol plumbing.
- Matches the maintainer's MCP experience and the project's documented intent (ADR-004),
  now with an explicit, honest rollout plan instead of an implicit gap.

## Consequences
- (+) Working loop now; MCP available where it actually matters (external clients).
- (+) One module per tool, two entry points (direct + MCP) — no logic duplication.
- (−) Until all servers exist, the "everything via MCP" invariant from ADR-004 is a goal,
  not yet a guarantee, for in-process calls. Tracked in CLAUDE.md.
- **stdio discipline:** MCP stdio servers must keep stdout pure JSON-RPC (no logger to
  stdout) — enforced by convention in the server entrypoints.
