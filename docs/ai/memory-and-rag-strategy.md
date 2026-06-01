# Memory & RAG Strategy

> Phase 4 · Status: Draft v0.1 · 2026-05-30

## 1. Memory taxonomy
| Type | Store | Lifetime | Examples |
|------|-------|----------|----------|
| Working memory | LangGraph state (Postgres checkpoint) | per workflow run | current job, drafts, gate status |
| Episodic memory | Postgres (`opportunities`, `messages`, `events`) | long | full opportunity history/timeline |
| Semantic memory | pgvector (`embeddings`) | long | profile chunks, job chunks, past replies |
| Procedural memory | Postgres (`learning_params`, prompts) | long, versioned | scoring weights, writing guidance |
| Cache | Redis | short (TTL) | LLM response cache, source fetch cache |

## 2. RAG design
- **Corpora indexed in pgvector:**
  1. Master profile chunks (skills, projects, experience bullets, achievements).
  2. Past successful materials + replies (what converted).
  3. Job descriptions (for similarity + dedupe).
- **Chunking:** semantic chunks (~200–400 tokens) with metadata (section, source, date).
- **Embeddings:** one configured embedding model; store vector + normalized text + metadata.
- **Retrieval:** hybrid = vector similarity + metadata filters (e.g., section=experience),
  re-ranked; top-k passed to the generation prompt as grounded context.

## 3. Where RAG is used
| Flow | Retrieval |
|------|-----------|
| Matching | retrieve profile highlights most relevant to the JD |
| Resume tailoring | retrieve profile bullets matching JD requirements (grounding) |
| Reply drafting | retrieve thread history + similar past successful replies |
| Learning | retrieve features of comparable past opportunities |

## 4. Grounding & citation
- Generation prompts receive retrieved chunks tagged with stable `refId`s.
- Outputs must reference `refId`s in `citations[]`; the Critic validates each claim maps
  to a retrieved profile chunk → prevents fabrication (FR-304).

## 5. Freshness & invalidation
- Re-embed profile on edit; re-embed materials when a new version is saved.
- Job embeddings expire with the job retention policy.
- Redis caches keyed by content hash with TTLs; invalidated on profile/config change.

## 6. Privacy
- Only retrieved (minimal) chunks are sent to the LLM — never the full data store.
- Email bodies summarized/redacted where full text isn't needed.

## 7. Vector DB choice
pgvector (in the same Postgres) for v1 — one datastore, transactional consistency with
domain data, no extra service. Revisit a dedicated vector DB only at scale. See
`../adr/ADR-001-why-postgresql.md` and `../database/`.
