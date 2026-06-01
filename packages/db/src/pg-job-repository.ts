import type { Pool } from "pg";
import type { DedupedJob, JobRecord, JobRepository, UpsertResult } from "@jobagent/core";

/**
 * Postgres-backed JobRepository (T-004) against the canonical schema
 * (docs/database/schema.sql). Satisfies the same interface as InMemoryJobRepository, so the
 * DiscoveryService is unchanged. Upsert is idempotent by canonical_key with provenance
 * tracked in job_source (FR-103/105).
 *
 * NB: uses parameterized SQL via `pg` directly (a pragmatic bridge). Prisma remains the
 * ORM of record (ADR-001/006) for richer app queries; this thin repo avoids the engine
 * download for the discovery path.
 */
export class PgJobRepository implements JobRepository {
  constructor(private readonly pool: Pool) {}

  async findByCanonicalKey(canonicalKey: string): Promise<JobRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, canonical_key, title, company, location, remote, description, status,
              created_at, updated_at
         FROM job WHERE canonical_key = $1`,
      [canonicalKey],
    );
    return rows[0] ? this.rowToRecord(rows[0]) : null;
  }

  async upsert(job: DedupedJob): Promise<UpsertResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const jobRes = await client.query(
        `INSERT INTO job (canonical_key, title, company, location, remote, description, posted_at, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'discovered')
         ON CONFLICT (canonical_key) DO UPDATE SET
           description = COALESCE(job.description, EXCLUDED.description),
           location    = COALESCE(job.location, EXCLUDED.location),
           remote      = COALESCE(job.remote, EXCLUDED.remote),
           posted_at   = COALESCE(job.posted_at, EXCLUDED.posted_at),
           updated_at  = now()
         RETURNING id, status, created_at, updated_at, (xmax = 0) AS created`,
        [
          job.canonicalKey,
          job.title,
          job.company,
          job.location ?? null,
          job.remote ?? null,
          job.description ?? null,
          job.postedAt ?? null,
        ],
      );
      const jobRow = jobRes.rows[0];
      const jobId: string = jobRow.id;
      const created: boolean = jobRow.created;

      let provenanceAdded = false;
      for (const p of job.provenance) {
        const srcRes = await client.query(
          `INSERT INTO source (key, enabled) VALUES ($1, true)
             ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
           RETURNING id`,
          [p.key],
        );
        const sourceId: string = srcRes.rows[0].id;
        const jsRes = await client.query(
          `INSERT INTO job_source (job_id, source_id, source_job_id, url)
             VALUES ($1,$2,$3,$4)
           ON CONFLICT (source_id, source_job_id) DO NOTHING
           RETURNING source_id`,
          [jobId, sourceId, p.sourceJobId, job.url ?? null],
        );
        if ((jsRes.rowCount ?? 0) > 0) provenanceAdded = true;
      }

      await client.query("COMMIT");
      return {
        record: {
          ...job,
          id: jobId,
          status: "discovered",
          createdAt: this.iso(jobRow.created_at),
          updatedAt: this.iso(jobRow.updated_at),
        },
        created,
        provenanceAdded: created || provenanceAdded,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM job`);
    return Number(rows[0]?.n ?? 0);
  }

  async list(): Promise<JobRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, canonical_key, title, company, location, remote, description, status,
              created_at, updated_at
         FROM job ORDER BY created_at DESC LIMIT 1000`,
    );
    return rows.map((r) => this.rowToRecord(r));
  }

  private rowToRecord(r: Record<string, unknown>): JobRecord {
    return {
      id: String(r.id),
      canonicalKey: String(r.canonical_key),
      title: String(r.title),
      company: String(r.company),
      location: (r.location as string | null) ?? undefined,
      remote: (r.remote as boolean | null) ?? undefined,
      description: (r.description as string | null) ?? undefined,
      url: undefined,
      postedAt: undefined,
      source: { key: "", sourceJobId: "" },
      provenance: [],
      fetchedAt: this.iso(r.created_at),
      status: (r.status as JobRecord["status"]) ?? "discovered",
      createdAt: this.iso(r.created_at),
      updatedAt: this.iso(r.updated_at),
    };
  }

  private iso(v: unknown): string {
    return v instanceof Date ? v.toISOString() : String(v);
  }
}
