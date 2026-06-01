# ADR-001 — PostgreSQL + pgvector as the single datastore

- **Status:** Accepted · 2026-05-30
- **Deciders:** Nikhil (architect/maintainer)

## Context
We need relational domain data (jobs, applications, audit, approvals) *and* vector search
for RAG (profile/job/material embeddings). Options: separate relational DB + dedicated
vector DB (Pinecone/Qdrant/Weaviate), or one Postgres with pgvector.

## Decision
Use a single **PostgreSQL 16** instance with the **pgvector** extension for both relational
data and embeddings.

## Rationale
- One datastore → simpler ops, backups, and **transactional consistency** between domain
  rows and their embeddings.
- Single-user scale comfortably fits pgvector (thousands of vectors).
- Nikhil already runs PostgreSQL/Prisma in production (resume) → low operational risk.
- Avoids an extra paid/managed service and network hop.

## Consequences
- (+) Simpler architecture, fewer moving parts, ACID across data + vectors.
- (−) pgvector ANN tuning needed (IVFFlat/HNSW); not as feature-rich as dedicated stores.
- **Revisit if:** corpus or latency outgrows pgvector → introduce Qdrant (ADR to supersede).

## Alternatives considered
- Dedicated vector DB: more capable at scale but adds ops + cost + consistency complexity —
  unjustified for a single-user system.
