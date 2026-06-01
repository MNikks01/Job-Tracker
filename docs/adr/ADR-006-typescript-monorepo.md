# ADR-006 — TypeScript/Node monorepo (TurboRepo + PNPM)

- **Status:** Accepted · 2026-05-30

## Context
Choice of primary language + repo structure. The maintainer (Nikhil) is a Senior Full-Stack
Engineer whose core stack is Node.js/TypeScript/React, with production TurboRepo + PNPM +
Docker experience (resume). The agent/ML ecosystem is strongest in Python, but
maintainability by the actual owner matters more for a personal tool.

## Decision
Build in **TypeScript on Node 20+**, organized as a **TurboRepo + PNPM monorepo** (apps +
packages), with the dashboard in **Next.js**.

## Rationale
- **Maintainer fit:** Nikhil can build, extend, and debug it fluently → highest chance of
  the system actually being maintained.
- TypeScript covers backend (LangGraph.js, MCP SDK, BullMQ), tools, and the Next.js
  dashboard in one language.
- Mirrors his proven workflow (TurboRepo/PNPM/Docker/GitHub Actions) → low setup risk.

## Consequences
- (+) One language end-to-end; reuses existing expertise + patterns.
- (−) Some ML/eval tooling is more mature in Python; mitigated by Anthropic SDK + light,
  interpretable learning (no heavy training in v1).

## Alternatives
- Python + LangGraph: strongest AI ecosystem, but worse maintainer fit for this owner.
- TS without LangGraph: more control, more reinvention (see ADR-002). Rejected.
