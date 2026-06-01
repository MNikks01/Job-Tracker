import { childLogger, isAppError, type CanonicalJob } from "@jobagent/shared";
import { dedupeJobs, type DedupedJob } from "@jobagent/core";
import { normalizePostings, type SourceAdapter } from "@jobagent/sources";

export interface DiscoveryStats {
  sourcesRun: number;
  sourcesFailed: number;
  rawPostings: number;
  canonicalJobs: number;
  duplicatesMerged: number;
}

export interface DiscoveryOutput {
  jobs: DedupedJob[];
  stats: DiscoveryStats;
  errors: { source: string; message: string; kind?: string }[];
}

/**
 * Discovery pipeline (FR-101→103): run each enabled adapter, normalize to canonical jobs,
 * then dedupe across sources. A failing source never aborts the run — it's logged and the
 * others continue (resilience, NFR-04/05).
 */
export async function runDiscovery(adapters: SourceAdapter[]): Promise<DiscoveryOutput> {
  const log = childLogger({ component: "discovery" });
  const all: CanonicalJob[] = [];
  const errors: DiscoveryOutput["errors"] = [];
  let sourcesFailed = 0;

  for (const adapter of adapters) {
    try {
      const { postings } = await adapter.discover({});
      const canonical = normalizePostings(postings, { key: adapter.key });
      all.push(...canonical);
      log.info({ source: adapter.key, count: canonical.length }, "source discovered");
    } catch (e) {
      sourcesFailed += 1;
      const message = e instanceof Error ? e.message : String(e);
      const kind = isAppError(e) ? e.kind : undefined;
      errors.push({ source: adapter.key, message, kind });
      log.warn({ source: adapter.key, kind, message }, "source failed; continuing");
    }
  }

  const { jobs, duplicatesMerged } = dedupeJobs(all);

  return {
    jobs,
    errors,
    stats: {
      sourcesRun: adapters.length,
      sourcesFailed,
      rawPostings: all.length,
      canonicalJobs: jobs.length,
      duplicatesMerged,
    },
  };
}
