import type { DedupedJob, JobRepository } from "@jobagent/core";
import { childLogger } from "@jobagent/shared";

export interface PersistStats {
  total: number;
  created: number;
  updated: number; // existing job that gained new provenance
  unchanged: number;
}

/**
 * Persist deduped canonical jobs idempotently (FR-103/105). Safe to re-run: existing jobs
 * are not duplicated; a job re-surfaced by a new source only gains provenance.
 */
export async function persistDiscovery(
  jobs: DedupedJob[],
  repo: JobRepository,
): Promise<PersistStats> {
  const log = childLogger({ component: "persist" });
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const job of jobs) {
    const res = await repo.upsert(job);
    if (res.created) created += 1;
    else if (res.provenanceAdded) updated += 1;
    else unchanged += 1;
  }

  const stats: PersistStats = { total: jobs.length, created, updated, unchanged };
  log.info(stats, "discovery persisted");
  return stats;
}
