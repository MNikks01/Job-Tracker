import { InMemoryJobRepository, type JobRepository } from "@jobagent/core";
import { createPgPool, PgJobRepository } from "@jobagent/db";
import { createEnabledAdapters } from "@jobagent/sources";
import { DiscoveryService } from "@jobagent/pipeline";
import {
  loadConfigFromEnv,
  loadSourcesFromFile,
  defaultSeedConfig,
  childLogger,
  type AppConfig,
} from "@jobagent/shared";

const log = childLogger({ component: "worker" });

/**
 * Build the DiscoveryService for the worker.
 *  - Repository: Postgres-backed when DATABASE_URL is set (durable), else in-memory (dev).
 *  - Sources: from SOURCES_FILE (file-based config store) when present, else the seed list.
 */
export function buildDiscoveryService(): {
  service: DiscoveryService;
  config: AppConfig;
  enabledSources: number;
  durable: boolean;
} {
  const envConfig = loadConfigFromEnv();
  const seed = defaultSeedConfig();

  const sourcesFile = process.env.SOURCES_FILE;
  const fileSources = sourcesFile ? loadSourcesFromFile(sourcesFile) : null;
  const sources = fileSources ?? seed.sources;

  const config: AppConfig = { ...envConfig, sources, filters: seed.filters };

  let repo: JobRepository;
  let durable = false;
  if (process.env.DATABASE_URL) {
    repo = new PgJobRepository(createPgPool(process.env.DATABASE_URL));
    durable = true;
  } else {
    repo = new InMemoryJobRepository();
    log.warn("no DATABASE_URL — using in-memory repository (not durable across restarts)");
  }

  const adapters = createEnabledAdapters(config.sources);
  if (adapters.length === 0) {
    log.warn("no enabled sources — discovery will find nothing until sources are configured");
  }
  return {
    service: new DiscoveryService(adapters, repo),
    config,
    enabledSources: adapters.length,
    durable,
  };
}
