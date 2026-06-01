import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

/**
 * Typed, validated runtime configuration (FR-904).
 * Mirrors AppConfig in docs/architecture/low-level-architecture.md §5.
 * Defaults encode the Sprint-1 decisions (HITL, API/feed sources, no browser automation).
 */
export const SourceConfigSchema = z.object({
  key: z.string(),
  kind: z.enum([
    "greenhouse",
    "lever",
    "rss",
    "ashby",
    "browser",
    "remotive",
    "remoteok",
    "weworkremotely",
  ]),
  enabled: z.boolean().default(false),
  automationEnabled: z.boolean().default(false),
  rateRps: z.number().positive().default(1),
  // adapter-specific options (e.g. greenhouse board token, rss url)
  options: z.record(z.unknown()).default({}),
});
export type SourceConfig = z.infer<typeof SourceConfigSchema>;

export const FiltersSchema = z.object({
  locations: z.array(z.string()).default([]),
  remoteOnly: z.boolean().default(false),
  seniority: z.array(z.string()).default([]),
  mustHave: z.array(z.string()).default([]),
  minComp: z.number().optional(),
});

export const AppConfigSchema = z.object({
  autonomy: z.enum(["hitl", "semi"]).default("hitl"),
  semiThreshold: z
    .object({ match: z.number().min(0).max(100), confidence: z.number().min(0).max(1) })
    .default({ match: 85, confidence: 0.8 }),
  dailyApplicationCap: z.number().int().positive().default(10),
  budgets: z
    .object({
      monthlyUsdCap: z.number().positive().default(50),
      alertAtPct: z.number().min(0).max(1).default(0.8),
    })
    .default({ monthlyUsdCap: 50, alertAtPct: 0.8 }),
  models: z
    .object({
      reasoning: z.string().default("claude-opus-4-8"),
      cheap: z.string().default("claude-haiku-4-5-20251001"),
      embedding: z.string().default("local-hash"),
      embeddingDim: z.number().int().positive().default(1536),
    })
    .default({
      reasoning: "claude-opus-4-8",
      cheap: "claude-haiku-4-5-20251001",
      embedding: "local-hash",
      embeddingDim: 1536,
    }),
  filters: FiltersSchema.default({}),
  sources: z.array(SourceConfigSchema).default([]),
  storageRoot: z.string().default("./storage"),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

/** Build config from environment + defaults. Throws (fatal) on invalid config. */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return AppConfigSchema.parse({
    autonomy: env.AUTONOMY_MODE,
    dailyApplicationCap: env.DAILY_APPLICATION_CAP ? Number(env.DAILY_APPLICATION_CAP) : undefined,
    budgets: {
      monthlyUsdCap: env.MONTHLY_USD_CAP ? Number(env.MONTHLY_USD_CAP) : undefined,
      alertAtPct: env.BUDGET_ALERT_PCT ? Number(env.BUDGET_ALERT_PCT) : undefined,
    },
    models: {
      reasoning: env.MODEL_REASONING,
      cheap: env.MODEL_CHEAP,
      embedding: env.EMBEDDING_MODEL,
      embeddingDim: env.EMBEDDING_DIM ? Number(env.EMBEDDING_DIM) : undefined,
    },
    storageRoot: env.STORAGE_ROOT,
  });
}

/**
 * Load + validate a sources list from a JSON file (a simple file-based config store until
 * the DB-backed config + dashboard arrive). Returns null if the file is absent.
 */
export function loadSourcesFromFile(
  path: string,
  readFile: (p: string) => string | null = defaultReadFile,
): SourceConfig[] | null {
  const raw = readFile(path);
  if (raw === null) return null;
  return z.array(SourceConfigSchema).parse(JSON.parse(raw));
}

function defaultReadFile(p: string): string | null {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/** Default seed config reflecting Nikhil's profile (editable in the dashboard later). */
export function defaultSeedConfig(): AppConfig {
  return AppConfigSchema.parse({
    autonomy: "hitl",
    filters: {
      seniority: ["senior", "staff", "lead"],
      remoteOnly: false,
      locations: ["Remote", "India", "Nagpur"],
      mustHave: ["node", "typescript"],
    },
    sources: [
      { key: "greenhouse:example", kind: "greenhouse", enabled: false, options: { board: "example" } },
      { key: "rss:example", kind: "rss", enabled: false, options: { url: "https://example.com/jobs.rss" } },
    ],
  });
}
