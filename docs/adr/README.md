# Architecture Decision Records (ADRs)

> Phase 12 · Format: lightweight MADR. Status values: Proposed | Accepted | Superseded.

| ADR | Title | Status |
|-----|-------|--------|
| 001 | Use PostgreSQL + pgvector as the single datastore | Accepted |
| 002 | Use LangGraph.js for agent orchestration | Accepted (design) — **amended by 009; not implemented** |
| 003 | Use Playwright for browser automation (conservative, optional) | Accepted (design) — **deferred; not implemented** |
| 004 | Use MCP as the tool boundary | Accepted (impl details in 008) |
| 005 | Human-in-the-loop by default; semi-autonomous opt-in | Accepted |
| 006 | TypeScript/Node monorepo (TurboRepo + PNPM) | Accepted |
| 007 | Anthropic Claude as the LLM, with model tiering | Accepted |
| 008 | MCP servers: in-process tools now, protocol boundary incrementally (supplements 004) | Accepted |
| 009 | Orchestration via plain services + BullMQ + DB state (amends 002) | Accepted |

Add an ADR for every notable decision; never silently change an accepted one — supersede it.
