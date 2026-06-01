# Indexes, Migrations, Backup & Vector DB

> Phase 6 · Status: Draft v0.1 · 2026-05-30

## 1. Indexes
| Table | Index | Why |
|-------|-------|-----|
| job | `UNIQUE(canonical_key)` | dedupe |
| job | `btree(status, created_at)` | discovery queue scans |
| job | `btree(company)` | per-company throttle/dedupe |
| job_source | `PK(source_id, source_job_id)` | source dedupe |
| match | `UNIQUE(job_id)`, `btree(score DESC)` | ranked review queue |
| application | `UNIQUE(company_key, normalized_role)` | no double-apply |
| application | `btree(state, updated_at)` | tracking + stalled detection |
| message | `UNIQUE(gmail_message_id)`, `btree(thread_id)`, `btree(opportunity_id)` | linkage |
| approval | `btree(status, expires_at)` | pending queue + expiry |
| audit_log | `btree(occurred_at)`, `btree(opportunity_id)` | audit queries |
| outcome | `btree(opportunity_id)`, `btree(kind, observed_at)` | learning |
| profile_chunk | `ivfflat(embedding vector_cosine_ops)` | ANN retrieval |
| job_embedding | `ivfflat(embedding vector_cosine_ops)` | similarity/dedupe |
| material_embedding | `ivfflat(embedding vector_cosine_ops)` | "what converted" retrieval |

> Note: build IVFFlat (or HNSW) indexes after initial data load; tune `lists`/`m` to corpus
> size. Run `ANALYZE`. Choose HNSW if recall/latency needs justify it.

## 2. Migrations
- **Tooling:** Prisma Migrate (canonical schema in `packages/db/schema.prisma`).
- **Workflow:** schema change → `prisma migrate dev` (local) → reviewed migration committed
  → `prisma migrate deploy` in CI/CD → applied on release.
- **Rules:** forward-only, additive-first (add column nullable → backfill → enforce);
  no destructive change without a backup + an explicit data migration step; every migration
  reversible or paired with a documented rollback.
- **Seed:** `seed.ts` loads the master profile (from MERN_Nikhil.pdf parse) + default config
  + disabled sources.

## 3. Backup & recovery
| Aspect | Approach |
|--------|----------|
| Local | nightly `pg_dump` (custom format) to object store; keep 7 daily + 4 weekly |
| Cloud (AWS RDS) | automated snapshots + PITR (point-in-time recovery), 7–35 day window |
| Audit integrity | hash-chained `audit_log`; periodic chain verification job |
| Files/objects | versioned bucket (rendered PDFs, raw payloads) with lifecycle expiry |
| Restore drills | documented restore runbook; test quarterly |
| Secrets | NOT in DB backups; managed separately (see security) |

## 4. Vector database design
- **Choice:** pgvector inside the same PostgreSQL (one datastore; transactional consistency
  with domain rows; no extra ops). ADR-001.
- **Collections (logical):** `profile_chunk`, `job_embedding`, `material_embedding`.
- **Distance:** cosine. **Dim:** set to the chosen embedding model.
- **Index:** IVFFlat (start) or HNSW (if needed) per table.
- **Hybrid retrieval:** vector ANN + SQL metadata filters (section, recency) in one query.
- **Re-embedding:** on profile/material change; embedding model version tracked in metadata
  so a model upgrade can trigger a controlled re-index.
- **Scale trigger:** revisit a dedicated vector store (e.g., Qdrant) only if corpus/latency
  outgrows pgvector — unlikely for a single-user system.

## 5. Data lifecycle
- Raw source payloads: 30-day retention, then drop (normalized Job kept).
- Email plaintext: minimal retention per config; snippets + metadata kept.
- Outcomes/audit/learning params: retained long-term.
