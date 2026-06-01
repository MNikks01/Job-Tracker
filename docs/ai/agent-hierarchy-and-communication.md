# AI Agent Hierarchy & Communication

> Phase 4 · Status: Draft v0.1 · 2026-05-30

## 1. Hierarchy (supervisor + specialists + critic)
```
Supervisor (Orchestrator)
├── Discovery Agent
├── Matching Agent
├── Materials Agents
│   ├── Resume Agent
│   └── Cover Letter Agent
├── Apply Agent
├── Inbox Agent
├── Reply Agent
├── Scheduler Agent
├── Learning Agent
└── Critic / Guardrail Agent  (cross-cutting reviewer)
```

## 2. Agent registry
| Agent | Goal | Inputs | Outputs | Tools (MCP) | Model tier |
|-------|------|--------|---------|-------------|------------|
| Supervisor | Route workflow, manage state, enforce gates | workflow state | next action | — | reasoning |
| Discovery | Find + normalize jobs | source config | Job[] | JobBoards, LinkedIn*, Postgres | cheap |
| Matching | Score + rank fit | Job, profile, embeddings | score, rationale, confidence | Postgres(pgvector) | cheap+embedding |
| Resume | Tailor resume (grounded) | Job, profile | resume variant | ResumeStore, FileSystem | reasoning |
| Cover Letter | Tailor letter | Job, profile | cover letter | FileSystem | reasoning |
| Critic/Guardrail | Verify honesty/safety/quality | draft, profile | pass/block + reasons | Postgres(profile) | reasoning |
| Apply | Submit application | approved app | submission result | JobBoards, Audit | cheap |
| Inbox | Classify + link email | email | classification, link | Gmail, Postgres | cheap |
| Reply | Draft reply | thread, context | draft reply | Gmail (post-approval) | reasoning |
| Scheduler | Propose + book slots | availability, request | slots, event | Calendar, Gmail | cheap |
| Learning | Improve from outcomes | outcomes, features | weight/guidance updates | Postgres | reasoning(batch) |

`*` LinkedIn tool compliance-gated/feature-flagged.

## 3. Communication patterns
- **Control:** Supervisor ↔ specialists via LangGraph typed state (not free-form chat);
  each node returns a structured result `{ output, confidence, notes, toolCalls }`.
- **Hand-offs:** explicit edges; the Critic sits on every outward-content edge.
- **Approval interrupts:** Supervisor pauses the graph (checkpoint to Postgres) and emits
  `approval.requested`; resumes on `approval.granted`.
- **No agent-to-agent network calls** — all side effects via MCP tools.
- **Shared memory:** Postgres (durable) + Redis (ephemeral/cache); see memory doc.

## 4. Structured I/O contract (every agent)
```ts
interface AgentResult<TOut> {
  output: TOut;
  confidence: number;       // 0..1, calibrated; see confidence-scoring
  rationale: string;        // human-readable
  citations?: string[];     // profile/job spans grounding the output
  needsHuman?: boolean;     // request escalation
  toolCalls: ToolCallLog[];
}
```

## 5. Failure handling per agent
| Failure | Handling |
|---------|----------|
| Tool/network error | Retryable → backoff; exceed → escalate |
| Low confidence (< threshold) | Route to Critic / request human |
| Guardrail violation | Block output, audit, notify |
| Hallucination/fabrication | Critic blocks; never reaches outward action |
| Budget cap hit | Pause non-critical agents; notify |
| Ambiguity (e.g., email link) | needsHuman = true; queue for manual |

## 6. Why this topology
Supervisor pattern keeps control explicit + auditable (vs. emergent multi-agent chatter),
which matters for a system that takes real-world actions in a user's name. The Critic as
a mandatory gate operationalizes the honesty + safety guardrails. See
`../adr/ADR-002-why-langgraph.md`.
