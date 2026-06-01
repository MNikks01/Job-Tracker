# ADR-004 — MCP as the tool boundary

- **Status:** Accepted · 2026-05-30

## Context
Agents must touch external systems (Gmail, Calendar, job boards) and internal stores
(Postgres, Redis, files). We need a uniform, typed, permissioned, testable tool layer with
a clear security boundary. Nikhil has shipped production MCP servers (resume).

## Decision
Expose **all** agent side-effects through **MCP servers** (Model Context Protocol). Agents
never call networks/SDKs directly.

## Rationale
- **Uniform contract:** typed tools (JSON Schema/zod), consistent error model.
- **Security boundary:** per-server permissions, rate limits, and approval-token checks live
  in the server, independent of agent prompts (defense vs. prompt injection).
- **Testability:** servers mockable; agents tested against contracts.
- **Reuse:** Gmail/Calendar/JobBoard MCP servers are standalone, reusable, portfolio-worthy.
- **Experience fit:** the maintainer has built MCP servers in production already.

## Consequences
- (+) Clean separation, strong guardrails, reusable tools.
- (−) Some boilerplate per server; an extra layer to maintain.
- Internal stores are also wrapped (typed repos) rather than raw SQL from agents — slightly
  more code, much safer.

## Alternatives
- Direct SDK calls from agents: less code, but no uniform permission/audit boundary and a
  weaker prompt-injection posture. Rejected.
