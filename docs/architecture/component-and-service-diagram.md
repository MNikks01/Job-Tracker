# Component & Service Diagrams

> Phase 3 · Status: Draft v0.1 · 2026-05-30

## 1. Component diagram (Mermaid)
```mermaid
graph LR
    subgraph ControlPlane
      UI[Dashboard UI]
      APIGW[API Gateway]
    end
    subgraph AgentCore
      ORCH[Orchestrator]
      subgraph SubAgents
        AD[Discovery Agent]
        AM[Matching Agent]
        AR[Resume Agent]
        AC[CoverLetter Agent]
        AA[Apply Agent]
        AI[Inbox Agent]
        AP[Reply Agent]
        AS[Scheduler Agent]
        AL[Learning Agent]
        AG[Critic/Guardrail Agent]
      end
    end
    subgraph CoreServices
      SM[StateMachine]
      DD[Dedupe]
      ID[Idempotency]
      AP2[Approval]
      AU[Audit]
      BG[BudgetGuard]
      NO[Notification]
    end
    subgraph MCP
      G[Gmail]; C[Calendar]; J[JobBoards]; L[LinkedIn*]
      P[Postgres]; R[Redis]; F[FileSystem]; RS[ResumeStore]
    end
    DB[(PostgreSQL+pgvector)]
    RC[(Redis)]

    UI --> APIGW --> ORCH
    ORCH --> SubAgents
    SubAgents --> MCP
    ORCH --> CoreServices
    AA --> AP2 --> AU
    ORCH --> BG
    P --> DB
    R --> RC
    CoreServices --> DB
```

## 2. Service responsibilities
| Service/Component | Responsibility | Key deps |
|-------------------|----------------|----------|
| Dashboard UI | Review/approve/configure/analytics | API GW (tRPC/WS) |
| API Gateway | AuthZ, validation, routing, WS push | Orchestrator, Core, DB |
| Orchestrator | Run LangGraph workflows, gate approvals | Agents, MCP, BudgetGuard |
| Discovery Agent | Fetch+normalize jobs | JobBoards/LinkedIn MCP |
| Matching Agent | Score+rank jobs | Postgres(pgvector), embeddings |
| Resume/Cover Agent | Generate materials | ResumeStore, FileSystem, LLM |
| Critic/Guardrail | Fabrication + quality + safety checks | Postgres (profile) |
| Apply Agent | Submit applications | JobBoards MCP / Playwright |
| Inbox Agent | Detect+classify+link emails | Gmail MCP |
| Reply Agent | Draft replies | Gmail MCP, LLM |
| Scheduler Agent | Availability + events | Calendar MCP |
| Learning Agent | Outcome attribution + weight updates | Postgres |
| Approval/Audit | HITL gate + immutable log | Postgres |
| BudgetGuard | Spend tracking + caps | Redis, Postgres |

## 3. Deployment/service diagram (Mermaid)
```mermaid
graph TB
    subgraph dockernet[Docker network]
      d[dashboard:3000]
      a[api:4000]
      o[orchestrator-worker]
      pg[(postgres:5432)]
      rd[(redis:6379)]
      mcp[mcp-servers]
      prom[prometheus:9090]
      graf[grafana:3001]
    end
    d --> a --> o
    o --> mcp
    o --> pg
    o --> rd
    a --> pg
    prom --> a
    prom --> o
    graf --> prom
```
