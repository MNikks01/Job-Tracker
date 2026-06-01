import type { RawPosting } from "@jobagent/shared";
import { RetryableError } from "@jobagent/shared";
import type { DiscoverParams, DiscoverResult, FetchFn, SourceAdapter } from "../types";

/** Shape of the Greenhouse public board API (subset we use). */
interface GreenhouseJob {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url?: string;
  updated_at?: string;
  content?: string;
}
interface GreenhousePayload {
  jobs: GreenhouseJob[];
}

/**
 * Pure parser: Greenhouse payload -> RawPosting[]. Company comes from the board config
 * (Greenhouse boards are per-company). HTML entities in `content` left as-is for now.
 */
export function parseGreenhouse(payload: GreenhousePayload, company: string): RawPosting[] {
  return (payload.jobs ?? []).map((j) => ({
    sourceJobId: String(j.id),
    title: j.title,
    company,
    location: j.location?.name,
    description: j.content,
    url: j.absolute_url,
    postedAt: j.updated_at,
  }));
}

export interface GreenhouseOptions {
  board: string; // greenhouse board token, e.g. "stripe"
  company?: string; // display name; defaults to board
  rps?: number;
}

/** Greenhouse public job board adapter (FR-101). Compliant public API; no auth needed. */
export class GreenhouseAdapter implements SourceAdapter {
  readonly kind = "greenhouse" as const;
  readonly supportsApply = false;
  readonly key: string;
  readonly rateLimit: { rps: number; burst: number };

  constructor(
    private readonly opts: GreenhouseOptions,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.key = `greenhouse:${opts.board}`;
    this.rateLimit = { rps: opts.rps ?? 1, burst: 2 };
  }

  async discover(_params: DiscoverParams): Promise<DiscoverResult> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
      this.opts.board,
    )}/jobs?content=true`;
    let res: Response;
    try {
      res = await this.fetchFn(url, { headers: { accept: "application/json" } });
    } catch (e) {
      throw new RetryableError("greenhouse fetch failed", { url, cause: String(e) });
    }
    if (!res.ok) {
      throw new RetryableError(`greenhouse responded ${res.status}`, { url, status: res.status });
    }
    const payload = (await res.json()) as GreenhousePayload;
    return { postings: parseGreenhouse(payload, this.opts.company ?? this.opts.board) };
  }
}
