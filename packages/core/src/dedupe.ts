import type { CanonicalJob } from "@jobagent/shared";

export interface DedupeResult {
  /** Unique jobs keyed by canonicalKey, with merged provenance. */
  jobs: DedupedJob[];
  duplicatesMerged: number;
}

export interface DedupedJob extends CanonicalJob {
  /** All (source, sourceJobId) origins that produced this canonical job. */
  provenance: { key: string; sourceJobId: string }[];
}

/**
 * DedupeService (FR-103): collapse postings that share a canonicalKey into a single
 * canonical job, preserving every source as provenance. Pure + deterministic.
 * Earlier entries win for scalar fields; later entries only contribute provenance.
 */
export function dedupeJobs(input: CanonicalJob[]): DedupeResult {
  const byKey = new Map<string, DedupedJob>();
  let duplicatesMerged = 0;

  for (const job of input) {
    const existing = byKey.get(job.canonicalKey);
    if (!existing) {
      byKey.set(job.canonicalKey, { ...job, provenance: [{ ...job.source }] });
      continue;
    }
    duplicatesMerged += 1;
    const already = existing.provenance.some(
      (p) => p.key === job.source.key && p.sourceJobId === job.source.sourceJobId,
    );
    if (!already) existing.provenance.push({ ...job.source });
    // Backfill missing scalar fields from later duplicates (don't overwrite present ones).
    existing.description ??= job.description;
    existing.location ??= job.location;
    existing.url ??= job.url;
    existing.postedAt ??= job.postedAt;
  }

  return { jobs: [...byKey.values()], duplicatesMerged };
}
