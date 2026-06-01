# Data Flow Diagrams

> Phase 3 · Status: Draft v0.1 · 2026-05-30

## 1. Level-0 DFD (context)
```mermaid
graph LR
    SRC[Job Sources] -->|postings| P0((System))
    GM[Gmail] -->|messages| P0
    P0 -->|replies| GM
    CAL[Calendar] -->|availability| P0
    P0 -->|events| CAL
    OP[Operator] -->|approvals/config| P0
    P0 -->|drafts/notifications/analytics| OP
    P0 -->|applications| SRC
    LLM[Claude] <-->|prompts/responses| P0
```

## 2. Level-1 DFD (primary pipeline)
```mermaid
graph TB
    SRC[Sources] --> P1[1.0 Discover & Normalize]
    P1 --> D1[(Jobs)]
    D1 --> P2[2.0 Match & Rank]
    PROF[(Profile)] --> P2
    EMB[(Embeddings)] --> P2
    P2 --> D2[(Ranked Queue)]
    D2 --> P3[3.0 Generate Materials]
    PROF --> P3
    P3 --> P3b[3.1 Fabrication Check]
    P3b --> D3[(Materials)]
    D3 --> P4[4.0 Approval Gate]
    OP[Operator] --> P4
    P4 -->|approved| P5[5.0 Submit Application]
    P5 --> SRC
    P5 --> D4[(Applications)]
    P5 --> D5[(Audit Log)]
```

## 3. Level-1 DFD (communications)
```mermaid
graph TB
    GM[Gmail] --> P6[6.0 Poll & Classify]
    P6 --> P7[7.0 Link to Opportunity]
    D4[(Applications)] --> P7
    P7 --> D6[(Messages)]
    D6 --> P8[8.0 Draft Reply]
    P8 --> P9[9.0 Approval Gate]
    OP[Operator] --> P9
    P9 -->|approved| P10[10.0 Send Reply]
    P10 --> GM
    P7 -->|interview?| P11[11.0 Propose Slots]
    CAL[(Calendar)] --> P11
    P11 --> P9
    P9 -->|confirmed| P12[12.0 Create Event] --> CAL
```

## 4. Data classification (what flows where)
| Data | Sensitivity | Leaves infra? |
|------|-------------|----------------|
| Master profile facts | Personal | Only relevant excerpts → LLM |
| Job postings | Public | n/a |
| Email content | Sensitive | Excerpts → LLM for classify/draft |
| OAuth tokens | Secret | Never to LLM/logs |
| Generated materials | Personal | To target ATS on submit |
| Audit log | Sensitive | Stays in Postgres |
| Embeddings | Derived | Stay in pgvector |

## 5. Retention
- Raw source payloads: 30 days (then drop, keep normalized Job).
- Email bodies: store minimal needed for context; configurable retention.
- Audit log: indefinite (append-only).
- Materials: versioned, kept for learning/audit.
