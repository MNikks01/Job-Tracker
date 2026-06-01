import type { RawPosting } from "@jobagent/shared";
import { RetryableError } from "@jobagent/shared";
import type { DiscoverParams, DiscoverResult, FetchFn, SourceAdapter } from "../types";

/** Lever postings API shape (subset). */
interface LeverPosting {
  id: string;
  text: string; // title
  categories?: { location?: string; team?: string; commitment?: string };
  hostedUrl?: string;
  descriptionPlain?: string;
  createdAt?: number; // epoch ms
}

/** Pure parser: Lever payload -> RawPosting[]. Company is the configured display name. */
export function parseLever(payload: LeverPosting[], company: string): RawPosting[] {
  return (payload ?? []).map((p) => ({
    sourceJobId: p.id,
    title: p.text,
    company,
    location: p.categories?.location,
    description: p.descriptionPlain,
    url: p.hostedUrl,
    postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
  }));
}

export interface LeverOptions {
  handle: string; // lever company handle, e.g. "netflix"
  company?: string; // display name; defaults to handle
  rps?: number;
}

/** Lever public postings adapter (FR-101). Public JSON API; no auth. */
export class LeverAdapter implements SourceAdapter {
  readonly kind = "lever" as const;
  readonly supportsApply = false;
  readonly key: string;
  readonly rateLimit: { rps: number; burst: number };

  constructor(
    private readonly opts: LeverOptions,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.key = `lever:${opts.handle}`;
    this.rateLimit = { rps: opts.rps ?? 1, burst: 2 };
  }

  async discover(_params: DiscoverParams): Promise<DiscoverResult> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(this.opts.handle)}?mode=json`;
    let res: Response;
    try {
      res = await this.fetchFn(url, { headers: { accept: "application/json" } });
    } catch (e) {
      throw new RetryableError("lever fetch failed", { url, cause: String(e) });
    }
    if (!res.ok) {
      throw new RetryableError(`lever responded ${res.status}`, { url, status: res.status });
    }
    const payload = (await res.json()) as LeverPosting[];
    return { postings: parseLever(payload, this.opts.company ?? this.opts.handle) };
  }
}
