import { randomUUID } from "node:crypto";
import type { DedupedJob } from "./dedupe";

export type JobStatus = "discovered" | "matched" | "archived";

export interface JobRecord extends DedupedJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertResult {
  record: JobRecord;
  created: boolean;
  provenanceAdded: boolean;
}

/**
 * JobRepository — persistence boundary for canonical jobs. The Postgres-backed
 * implementation (via the postgres-mcp typed repo / Prisma) will satisfy this same
 * interface; InMemoryJobRepository is the test/dev double.
 *
 * `upsert` is idempotent by canonicalKey (FR-103/105): re-discovering the same job does
 * not create a duplicate; a new source that found it only adds provenance.
 */
export interface JobRepository {
  findByCanonicalKey(canonicalKey: string): Promise<JobRecord | null>;
  upsert(job: DedupedJob): Promise<UpsertResult>;
  count(): Promise<number>;
  list(): Promise<JobRecord[]>;
}

export class InMemoryJobRepository implements JobRepository {
  private byKey = new Map<string, JobRecord>();

  async findByCanonicalKey(canonicalKey: string): Promise<JobRecord | null> {
    return this.byKey.get(canonicalKey) ?? null;
  }

  async upsert(job: DedupedJob): Promise<UpsertResult> {
    const existing = this.byKey.get(job.canonicalKey);
    const now = new Date().toISOString();

    if (!existing) {
      const record: JobRecord = {
        ...job,
        id: randomUUID(),
        status: "discovered",
        createdAt: now,
        updatedAt: now,
      };
      this.byKey.set(job.canonicalKey, record);
      return { record, created: true, provenanceAdded: true };
    }

    let provenanceAdded = false;
    for (const p of job.provenance) {
      const seen = existing.provenance.some(
        (e) => e.key === p.key && e.sourceJobId === p.sourceJobId,
      );
      if (!seen) {
        existing.provenance.push({ ...p });
        provenanceAdded = true;
      }
    }
    // Backfill missing scalar fields without overwriting existing values.
    existing.description ??= job.description;
    existing.location ??= job.location;
    existing.url ??= job.url;
    existing.postedAt ??= job.postedAt;
    if (provenanceAdded) existing.updatedAt = now;

    return { record: existing, created: false, provenanceAdded };
  }

  async count(): Promise<number> {
    return this.byKey.size;
  }

  async list(): Promise<JobRecord[]> {
    return [...this.byKey.values()];
  }
}
