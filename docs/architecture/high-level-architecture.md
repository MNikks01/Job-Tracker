# High-Level Architecture (HLD)

> Phase 3 · Status: Draft v0.1 · 2026-05-30

> ⚠️ **As-built note:** orchestration shipped as plain TS services + BullMQ + DB state, **not**
> LangGraph (ADR-009); tools are in-process adapters with MCP servers wrapping the same modules
> for external clients (ADR-008). The model below is the conceptual target.

## 1. Architectural style
- **Event-driven, queue-backed, agentic.** A scheduler and event bus drive long-running
  workflows; an LLM orchestrator (LangGraph.js) coordinates specialized sub-agents that
  act only through **MCP tool servers**. A **Next.js dashboard** is the human control
  plane. PostgreSQL (+pgvector) is the system of record; Redis backs queues + cache.
- **Human-in-the-loop** is a first-class architectural control: outward actions pass
  through an Approval Gate.

## 2. Logical layers
1. **Sources layer** — adapters per job source (API/RSS/GraphQL/browser).
2. **Tool layer (MCP servers)** — Gmail, Calendar, Job Boards, LinkedIn, Postgres,
   Redis, File System, Resume Storage. The *only* way agents touch the outside world.
3. **Agent layer** — orchestrator + sub-agents (Discovery, Matching, Resume, Cover
   Letter, Apply, Inbox, Reply, Scheduler, Learning, Critic/Guardrail).
4. **Domain/services layer** — business logic, state machine, idempotency, dedupe,
   budget guard, audit.
5. **Data layer** — PostgreSQL (+pgvector), Redis, object/file storage.
6. **Control plane** — Next.js dashboard + REST/tRPC API + WebSocket.
7. **Cross-cutting** — auth/secrets, observability, notifications, scheduling.

## 3. C4 — System Context (Mermaid)
```mermaid
graph TB
    Operator["👤 Nikhil (Operator)"]
    Recruiter["👤 Recruiter (external)"]
    subgraph System["Autonomous AI Job Search Agent"]
      Core["Agent Core + Control Plane"]
    end
    LLM["Anthropic Claude API"]
    Gmail["Gmail API"]
    Cal["Google Calendar API"]
    Boards["Job Sources (Greenhouse/Lever/RSS/etc.)"]

    Operator -->|reviews, approves, configures| Core
    Core -->|notifications, drafts| Operator
    Core -->|reasoning/generation| LLM
    Core -->|read mail / send replies| Gmail
    Core -->|availability / events| Cal
    Core -->|discover / apply| Boards
    Recruiter -->|emails| Gmail
    Cal -->|invites| Recruiter
```

## 4. C4 — Container diagram (Mermaid)
```mermaid
graph TB
    subgraph Client
      DASH["Next.js Dashboard (control plane UI)"]
    end
    subgraph Backend["Node/TypeScript services"]
      API["API Gateway (tRPC/REST + WS)"]
      ORCH["Agent Orchestrator (LangGraph.js)"]
      WORK["Worker Pool (BullMQ consumers)"]
      SCHED["Scheduler (cron/queues)"]
      BUDGET["Budget Guard"]
      AUDIT["Audit + Approval service"]
    end
    subgraph Tools["MCP Servers"]
      M1["Gmail MCP"]; M2["Calendar MCP"]; M3["Job Boards MCP"]
      M4["LinkedIn MCP*"]; M5["Postgres MCP"]; M6["Redis MCP"]
      M7["FileSystem MCP"]; M8["Resume Storage MCP"]
    end
    subgraph Data
      PG[("PostgreSQL + pgvector")]
      RD[("Redis")]
      OBJ[("Object/File store")]
    end
    LLM["Claude API"]

    DASH <-->|tRPC/WS| API
    API --> ORCH
    API --> AUDIT
    ORCH --> WORK
    SCHED --> WORK
    WORK --> ORCH
    ORCH -->|LLM calls via Budget Guard| BUDGET --> LLM
    ORCH -->|tool calls| Tools
    M5 --> PG
    M6 --> RD
    M7 --> OBJ
    M8 --> OBJ
    WORK --> PG
    WORK --> RD
    AUDIT --> PG
```
`*` LinkedIn MCP is feature-flagged and compliance-gated; may be feed/API-only.

## 5. Runtime topology (local-first)
- A single `docker-compose.yml` brings up: `api`, `orchestrator/worker`, `dashboard`,
  `postgres`, `redis`, and each MCP server as its own small service (or in-process
  plugins behind the orchestrator for v1 simplicity). Prometheus + Grafana optional.

## 6. Key qualities & how the architecture delivers them
| Quality | Mechanism |
|---------|-----------|
| Safety/HITL | Approval Gate between draft and outward action; audit service |
| Honesty | Critic/Guardrail agent + fabrication check before materials are usable |
| Idempotency | Dedupe keys, idempotency table, unique (company,role) constraint |
| Resilience | BullMQ retries w/ backoff, resumable LangGraph state, DLQ |
| Cost control | Budget Guard wraps all LLM calls; caching; model tiering |
| Observability | Structured logs + OpenTelemetry traces + Prometheus metrics |
| Security | MCP permission model, encrypted secrets, scoped OAuth |
| Portability | Containerized; config-driven; local ↔ AWS parity |

## 7. Technology mapping
See `../../CLAUDE.md` Technology Stack and `../adr/` for rationale. Summary: Node 20+,
TypeScript, LangGraph.js, Anthropic SDK, MCP, Playwright, BullMQ, PostgreSQL 16 +
pgvector, Redis 7, Next.js + Tailwind + TanStack Query, Docker, GitHub Actions,
Prometheus/Grafana.
