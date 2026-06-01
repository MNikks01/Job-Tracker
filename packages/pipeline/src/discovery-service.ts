import type { JobRepository } from "@jobagent/core";
import type { SourceAdapter } from "@jobagent/sources";
import { childLogger } from "@jobagent/shared";
import { runDiscovery, type DiscoveryStats } from "./discovery";
import { persistDiscovery, type PersistStats } from "./persist";

export interface DiscoveryRunResult {
  discovery: DiscoveryStats;
  persist: PersistStats;
  errors: { source: string; message: string; kind?: string }[];
}

/**
 * DiscoveryService — one discovery cycle (FR-101→105): run enabled adapters, normalize,
 * dedupe, and persist idempotently. This is what the scheduler/worker invokes on a timer.
 */
export class DiscoveryService {
  private readonly log = childLogger({ component: "discovery-service" });

  constructor(
    private readonly adapters: SourceAdapter[],
    private readonly repo: JobRepository,
  ) {}

  async run(): Promise<DiscoveryRunResult> {
    const started = Date.now();
    const out = await runDiscovery(this.adapters);
    const persist = await persistDiscovery(out.jobs, this.repo);
    this.log.info(
      { ms: Date.now() - started, ...out.stats, ...persist, failed: out.stats.sourcesFailed },
      "discovery cycle complete",
    );
    return { discovery: out.stats, persist, errors: out.errors };
  }
}
