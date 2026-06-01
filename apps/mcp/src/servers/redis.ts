import { z } from "zod";
import IORedis from "ioredis";
import { serve, text } from "../lib/serve";

// redis-mcp — cache + locks (internal infra). lazyConnect so the server starts without Redis.
const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

await serve("redis", (s) => {
  s.registerTool(
    "cache.set",
    {
      title: "Cache set",
      description: "Set a cache key with optional TTL (seconds).",
      inputSchema: { key: z.string(), value: z.string(), ttlSec: z.number().int().positive().optional() },
    },
    async ({ key, value, ttlSec }) => {
      if (ttlSec) await redis.set(key, value, "EX", ttlSec);
      else await redis.set(key, value);
      return text({ ok: true, key });
    },
  );
  s.registerTool(
    "cache.get",
    { title: "Cache get", description: "Get a cache key.", inputSchema: { key: z.string() } },
    async ({ key }) => text({ key, value: await redis.get(key) }),
  );
});
