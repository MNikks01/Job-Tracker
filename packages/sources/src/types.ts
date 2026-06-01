import type { RawPosting } from "@jobagent/shared";

/** Injected fetch so adapters stay pure/testable and rate-limiting lives outside. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface DiscoverParams {
  query?: string;
  location?: string;
  sinceCursor?: string;
}

export interface DiscoverResult {
  postings: RawPosting[];
  nextCursor?: string;
}

/**
 * SourceAdapter (FR-101/104) — see docs/mcp/jobboards-and-linkedin-mcp.md.
 * Compliance-first: discovery via APIs/feeds. `apply` is optional and gated; not used in
 * Sprint 1 (API/feed-only, browser automation OFF by default).
 */
export interface SourceAdapter {
  readonly key: string;
  readonly kind:
    | "greenhouse"
    | "lever"
    | "rss"
    | "ashby"
    | "browser"
    | "remotive"
    | "remoteok"
    | "weworkremotely";
  readonly rateLimit: { rps: number; burst: number };
  discover(params: DiscoverParams): Promise<DiscoverResult>;
  readonly supportsApply: boolean;
}
