import type { RawPosting } from "@jobagent/shared";
import { RetryableError } from "@jobagent/shared";
import type { DiscoverParams, DiscoverResult, FetchFn, SourceAdapter } from "../types";

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  url?: string;
  publication_date?: string;
  description?: string;
}

/** Pure parser: Remotive API payload -> RawPosting[] (all remote). */
export function parseRemotive(payload: { jobs?: RemotiveJob[] }): RawPosting[] {
  return (payload.jobs ?? []).map((j) => ({
    sourceJobId: String(j.id),
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || undefined,
    remote: true,
    description: j.description,
    url: j.url,
    postedAt: j.publication_date,
  }));
}

export interface RemotiveOptions {
  query?: string;
  /** Remotive category slug (e.g. "software-dev") — broader than a keyword search. */
  category?: string;
  rps?: number;
}

/** Remotive remote-jobs API adapter (FR-101). Public JSON API, ToS-friendly. */
export class RemotiveAdapter implements SourceAdapter {
  readonly kind = "remotive" as const;
  readonly supportsApply = false;
  readonly key: string;
  readonly rateLimit: { rps: number; burst: number };

  constructor(
    private readonly opts: RemotiveOptions = {},
    private readonly fetchFn: FetchFn = fetch,
  ) {
    // Distinct key per category/query so multiple Remotive sources don't collide.
    this.key = `remotive:${opts.category ?? opts.query ?? "all"}`;
    this.rateLimit = { rps: opts.rps ?? 1, burst: 2 };
  }

  async discover(params: DiscoverParams): Promise<DiscoverResult> {
    const search = params.query ?? this.opts.query;
    const qs = this.opts.category
      ? `?category=${encodeURIComponent(this.opts.category)}`
      : search
        ? `?search=${encodeURIComponent(search)}`
        : "";
    const url = `https://remotive.com/api/remote-jobs${qs}`;
    let res: Response;
    try {
      res = await this.fetchFn(url, { headers: { accept: "application/json" } });
    } catch (e) {
      throw new RetryableError("remotive fetch failed", { url, cause: String(e) });
    }
    if (!res.ok) throw new RetryableError(`remotive responded ${res.status}`, { url, status: res.status });
    return { postings: parseRemotive((await res.json()) as { jobs?: RemotiveJob[] }) };
  }
}
