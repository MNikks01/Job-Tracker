# Autonomous AI Job Search Agent

A private, self-hosted, **human-in-the-loop** AI agent that runs Nikhil Meshram's job
search end-to-end: discover → match → tailor → apply (with approval) → track → reply →
schedule → learn. Honesty-first, ToS-compliant, single-user.

> **Status:** Documentation complete (`docs/`, `CLAUDE.md`). Implementation in progress —
> **Sprint 1 (Foundation + Discovery)**. See `tasks/` and `docs/implementation/roadmap.md`.

## Docs
Start with [`CLAUDE.md`](./CLAUDE.md) (project operating manual) and [`docs/`](./docs):
- `docs/project-overview.md`, `docs/requirements/`, `docs/architecture/`, `docs/ai/`,
  `docs/mcp/`, `docs/database/`, `docs/security/`, `docs/infrastructure/`, `docs/product/`,
  `docs/implementation/`, `docs/adr/`.

## Stack
TypeScript/Node 20+ · TurboRepo + PNPM monorepo · LangGraph.js + Anthropic Claude ·
MCP tool servers · Playwright (optional) · BullMQ + Redis · PostgreSQL 16 + pgvector ·
Next.js dashboard. (ADRs in `docs/adr/`.)

## Monorepo layout (current)
```
packages/
  shared/    # types, zod config, logger (redacting), errors, hashing
  core/      # dedupe, hash-chained audit, budget guard
  sources/   # SourceAdapter + Greenhouse/RSS adapters + normalizer
  pipeline/  # discovery pipeline (adapter -> normalize -> dedupe)
```

## Develop
```bash
corepack enable && corepack prepare pnpm@9.12.0 --activate
pnpm install
pnpm test          # vitest (unit + integration)
pnpm exec tsc -b   # typecheck (project references)

cp .env.example .env   # then fill in secrets (never commit .env)
docker compose up -d   # Postgres+pgvector + Redis (data layer)
```

## Principles (non-negotiable)
1. Human-in-the-loop by default — no outward action without approval + audit.
2. Honesty — never fabricate; a Critic agent blocks unsupported claims.
3. Compliance — APIs/feeds first; browser automation optional; LinkedIn off by default.
4. Auditable & budget-bounded.
