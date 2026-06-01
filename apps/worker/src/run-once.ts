import { childLogger } from "@jobagent/shared";
import { buildDiscoveryService } from "./service";

/**
 * Run a single discovery cycle without Redis — handy for local testing once sources are
 * enabled in config. `pnpm --filter @jobagent/worker discover:once`.
 */
const log = childLogger({ component: "discover-once" });

async function main(): Promise<void> {
  const { service, enabledSources } = buildDiscoveryService();
  log.info({ enabledSources }, "running one discovery cycle");
  const result = await service.run();
  log.info(result, "done");
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "discover:once failed");
  process.exit(1);
});
