import { z } from "zod";
import { FatalError, type SourceConfig } from "@jobagent/shared";
import type { FetchFn, SourceAdapter } from "./types";
import { GreenhouseAdapter } from "./adapters/greenhouse";
import { LeverAdapter } from "./adapters/lever";
import { RssAdapter } from "./adapters/rss";
import { RemotiveAdapter } from "./adapters/remotive";
import { RemoteOkAdapter } from "./adapters/remoteok";
import { WeWorkRemotelyAdapter } from "./adapters/weworkremotely";

// Per-kind option schemas (validate the loosely-typed SourceConfig.options).
const greenhouseOpts = z.object({ board: z.string(), company: z.string().optional() });
const leverOpts = z.object({ handle: z.string(), company: z.string().optional() });
const rssOpts = z.object({ url: z.string().url(), company: z.string() });
const remotiveOpts = z.object({ query: z.string().optional(), category: z.string().optional() });
const remoteOkOpts = z.object({ query: z.string().optional() });
const wwrOpts = z.object({ rssUrl: z.string().url().optional() });

/**
 * Build a SourceAdapter from a validated SourceConfig (FR-101/104). Throws FatalError on a
 * misconfigured source so problems surface at startup, not mid-run. `browser`/`ashby` are
 * not implemented in Sprint 1 (API/feed-only).
 */
export function createAdapter(cfg: SourceConfig, fetchFn: FetchFn = fetch): SourceAdapter {
  const rps = cfg.rateRps;
  switch (cfg.kind) {
    case "greenhouse": {
      const o = parse(greenhouseOpts, cfg);
      return new GreenhouseAdapter({ board: o.board, company: o.company, rps }, fetchFn);
    }
    case "lever": {
      const o = parse(leverOpts, cfg);
      return new LeverAdapter({ handle: o.handle, company: o.company, rps }, fetchFn);
    }
    case "rss": {
      const o = parse(rssOpts, cfg);
      return new RssAdapter({ url: o.url, company: o.company, rps }, fetchFn);
    }
    case "remotive": {
      const o = parse(remotiveOpts, cfg);
      return new RemotiveAdapter({ query: o.query, category: o.category, rps }, fetchFn);
    }
    case "remoteok": {
      const o = parse(remoteOkOpts, cfg);
      return new RemoteOkAdapter({ query: o.query, rps }, fetchFn);
    }
    case "weworkremotely": {
      const o = parse(wwrOpts, cfg);
      return new WeWorkRemotelyAdapter({ rssUrl: o.rssUrl, rps }, fetchFn);
    }
    default:
      throw new FatalError(`source kind not implemented: ${cfg.kind}`, { source: cfg.key });
  }
}

/** Build adapters for all enabled sources only. */
export function createEnabledAdapters(
  sources: SourceConfig[],
  fetchFn: FetchFn = fetch,
): SourceAdapter[] {
  return sources.filter((s) => s.enabled).map((s) => createAdapter(s, fetchFn));
}

function parse<T>(schema: z.ZodType<T>, cfg: SourceConfig): T {
  const r = schema.safeParse(cfg.options);
  if (!r.success) {
    throw new FatalError(`invalid options for source ${cfg.key}`, {
      source: cfg.key,
      issues: r.error.issues,
    });
  }
  return r.data;
}
