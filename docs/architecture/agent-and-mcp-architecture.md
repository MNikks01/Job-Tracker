# Agent & MCP Architecture (overview)

> Phase 3 · Status: Draft v0.1 · 2026-05-30
> Deep detail in `../ai/` (agents) and `../mcp/` (MCP servers). This is the architectural
> bridge between them.

## 1. Agent architecture (supervisor pattern)
```mermaid
graph TB
    SUP[Supervisor / Orchestrator]
    SUP --> DA[Discovery]
    SUP --> MA[Matching]
    SUP --> MAT[Materials: Resume + CoverLetter]
    SUP --> AA[Apply]
    SUP --> IA[Inbox]
    SUP --> RA[Reply]
    SUP --> SA[Scheduler]
    SUP --> LA[Learning]
    MAT --> CG[Critic / Guardrail]
    RA --> CG
    AA --> CG
    CG --> SUP
```
- **Supervisor** decides which sub-agent runs next based on workflow state.
- **Critic/Guardrail** is a mandatory reviewer on any path that produces outward content
  (materials, replies, submissions) — enforces honesty + safety + quality.
- Sub-agents are **tool-using** but tools are MCP-mediated only.

## 2. MCP architecture
```mermaid
graph LR
    subgraph Agents
      A1[Agents call tools]
    end
    subgraph MCPLayer[MCP Servers - typed tools + permissions]
      G[Gmail]; C[Calendar]; J[JobBoards]; L[LinkedIn*]
      P[Postgres]; R[Redis]; F[FileSystem]; RS[ResumeStore]
    end
    EXT1[Gmail API]; EXT2[Calendar API]; EXT3[Source APIs/Playwright]
    DBp[(Postgres)]; RDp[(Redis)]; OBJ[(Files)]

    A1 -->|MCP tool call + scope| MCPLayer
    G --> EXT1
    C --> EXT2
    J --> EXT3
    L --> EXT3
    P --> DBp
    R --> RDp
    F --> OBJ
    RS --> OBJ
```

## 3. Why MCP (vs. direct SDK calls)
- **Uniform tool contract** (typed inputs/outputs via JSON Schema/zod).
- **Permission boundary**: each server enforces scopes + rate limits independent of agents.
- **Testability**: servers mockable; agents test against contracts.
- **Reuse**: Gmail/Calendar/JobBoard MCP servers are standalone, reusable assets.
- **Fit**: Nikhil has shipped production MCP servers already (resume).
See `../adr/ADR-004-why-mcp.md`.

## 4. Agent ↔ tool permission matrix (summary)
| Agent | Allowed MCP tools |
|-------|-------------------|
| Discovery | JobBoards.read, LinkedIn.read*, Postgres.write(jobs), Redis |
| Matching | Postgres.read/write(scores), embeddings, Redis |
| Materials | ResumeStore, FileSystem, Postgres.read(profile) |
| Critic | Postgres.read(profile) |
| Apply | JobBoards.apply, Postgres.write(applications), Audit |
| Inbox | Gmail.read, Postgres.write(messages) |
| Reply | Gmail.send (post-approval), Postgres |
| Scheduler | Calendar.read/write, Gmail.send (post-approval) |
| Learning | Postgres.read/write(params) |
Outward tools (Gmail.send, JobBoards.apply, Calendar.write) require an approval token
in HITL mode (enforced by ApprovalService + MCP permission check).
