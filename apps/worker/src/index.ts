import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { childLogger } from "@jobagent/shared";
import { buildDiscoveryService } from "./service";

/**
 * Discovery worker (T-007): a BullMQ repeatable job triggers one DiscoveryService cycle on
 * a schedule. Requires Redis (REDIS_URL). Run with `pnpm --filter @jobagent/worker start`.
 *
 * We pass connection *options* (not a client instance) so BullMQ owns its own ioredis,
 * avoiding cross-version client type mismatches.
 */
const log = childLogger({ component: "worker-main" });
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const DISCOVERY_CRON = process.env.DISCOVERY_CRON ?? "*/30 * * * *"; // every 30 min
const QUEUE = "discovery";

function redisConnection(): ConnectionOptions {
  const u = new URL(REDIS_URL);
  return {
    host: u.hostname,
    port: Number(u.port || "6379"),
    ...(u.password ? { password: u.password } : {}),
    ...(u.username ? { username: u.username } : {}),
    maxRetriesPerRequest: null,
  };
}

async function main(): Promise<void> {
  const connection = redisConnection();
  const { service, enabledSources } = buildDiscoveryService();
  log.info({ enabledSources, cron: DISCOVERY_CRON }, "starting discovery worker");

  const queue = new Queue(QUEUE, { connection });
  // Idempotent repeatable schedule (jobId keeps a single repeatable definition).
  await queue.add("cycle", {}, { repeat: { pattern: DISCOVERY_CRON }, jobId: "discovery-cycle" });

  const worker = new Worker(QUEUE, async (_job: Job) => service.run(), {
    connection,
    concurrency: 1,
  });

  worker.on("completed", (job, result) =>
    log.info({ jobId: job.id, result }, "discovery cycle ok"),
  );
  worker.on("failed", (job, err) =>
    log.error({ jobId: job?.id, err: err.message }, "discovery cycle failed"),
  );

  const shutdown = async (sig: string): Promise<void> => {
    log.info({ sig }, "shutting down");
    await worker.close();
    await queue.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "worker crashed");
  process.exit(1);
});
