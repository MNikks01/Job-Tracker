# Low-Level Architecture (LLD)

> Phase 3 · Status: Draft v0.1 · 2026-05-30

## 1. Module/package layout (monorepo — TurboRepo + PNPM)
```
apps/
  dashboard/        # Next.js control plane (UI)
  api/              # tRPC/REST gateway + WebSocket
  orchestrator/     # LangGraph.js agent graphs + worker entrypoints
packages/
  agents/           # sub-agent definitions, prompts, tool bindings
  core/             # domain models, state machine, services (dedupe, idempotency, budget, audit)
  matching/         # scoring (embeddings + rules), ranking
  materials/        # resume + cover-letter generation, fabrication check
  sources/          # job-source adapters (greenhouse, lever, rss, browser)
  mcp-servers/      # gmail, calendar, jobboards, linkedin, postgres, redis, fs, resume
  db/               # Prisma schema, migrations, repositories
  shared/           # types, zod schemas, logger, config, errors
  observability/    # otel, metrics, tracing helpers
infra/
  docker/           # Dockerfiles, compose
  ci/               # GitHub Actions
```
Rationale matches Nikhil's existing TurboRepo+PNPM workflow (resume).

## 2. Core services (within `packages/core`)
| Service | Responsibility |
|---------|----------------|
| `StateMachineService` | Validate + apply Application/Opportunity transitions |
| `DedupeService` | Canonicalize + hash jobs; merge provenance |
| `IdempotencyService` | Guard against duplicate outward actions |
| `ApprovalService` | Create/resolve approvals; bind to audit |
| `AuditService` | Append-only audit records (hash-chained) |
| `BudgetGuard` | Track LLM spend; enforce caps; emit alerts |
| `NotificationService` | Email/push when human input needed |
| `ConfigService` | Typed, validated runtime config |

## 3. Agent execution model
> ⚠️ **As-built note (ADR-009):** this section describes the *conceptual* LangGraph model.
> The shipped implementation uses **plain TypeScript services + BullMQ + PostgreSQL state**
> instead — the "interrupt/Approval Gate" is an application persisted at `pending_approval`
> + an `approval` row (resumed via dashboard/CLI), and "checkpoints" are the durable DB state
> machine, not in-memory graph checkpoints. LangGraph is revisited when workflows become
> genuinely graph-shaped. See ADR-002 (amended) and ADR-009.

- Each workflow is a **LangGraph.js graph** with typed state, checkpointed to Postgres
  (resumable). Nodes are sub-agents or deterministic functions. Edges encode control
  flow incl. the **Approval Gate** (an interrupt node that pauses the graph until a human
  resolves it via the dashboard).
- Sub-agents are stateless callables: `(input, context, tools) -> output + confidence`.
- All side effects go through MCP tools; agents cannot call networks directly.

## 4. Queues (BullMQ / Redis)
| Queue | Producer | Consumer | Notes |
|-------|----------|----------|-------|
| `discovery` | scheduler | discovery worker | per-source jobs, rate-limited |
| `matching` | discovery | matching worker | embeds + scores |
| `materials` | matching/operator | materials worker | gated by selection |
| `apply` | approval | apply worker | idempotent, audited |
| `inbox` | gmail poller | inbox worker | classify + link |
| `reply` | inbox/operator | reply worker | draft; send gated |
| `schedule` | inbox/operator | schedule worker | calendar ops |
| `learning` | outcome events | learning worker | periodic batch |
| `notify` | any | notify worker | fan-out alerts |
| `dlq:*` | system | manual/ops | dead-letter per queue |

Retry policy: exponential backoff (e.g., 5 attempts), jitter; poison messages → DLQ.

## 5. Configuration (typed, validated with zod)
```ts
interface AppConfig {
  autonomy: 'hitl' | 'semi';            // default 'hitl'
  semiThreshold?: { match: number; confidence: number };
  sources: SourceConfig[];               // per-source enable + rate limits
  schedules: { discoveryCron: string; inboxPollSec: number };
  budgets: { monthlyUsdCap: number; alertAtPct: number };
  models: { reasoning: string; cheap: string; embedding: string };
  filters: { locations: string[]; minComp?: number; seniority: string[]; mustHave: string[] };
}
```

## 6. Error taxonomy
- `RetryableError` (network, 5xx, rate-limit) → backoff retry.
- `ManualInterventionError` (CAPTCHA, unknown form, ambiguous link) → NEEDS_MANUAL + notify.
- `GuardrailError` (fabrication, budget cap, recipient mismatch) → block + audit + alert.
- `FatalError` (config/programming) → fail fast, page maintainer.

## 7. Idempotency & dedupe keys
- Job canonical key: `sha256(normalizedTitle | company | location)`.
- Source dedupe: `(source, sourceJobId)` unique.
- Apply idempotency: unique `(companyId, normalizedRole)` on successful APPLIED.
- Send idempotency: `(threadId, draftHash)` to prevent double-send.

## 8. Sequence ownership
Each FR group maps to one graph: `DiscoveryGraph`, `MaterialsGraph`, `ApplyGraph`,
`InboxGraph`, `ScheduleGraph`, `LearningGraph`. See `sequence-diagrams.md`.
