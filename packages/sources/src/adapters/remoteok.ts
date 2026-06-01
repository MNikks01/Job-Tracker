import type { RawPosting } from "@jobagent/shared";
import { RetryableError } from "@jobagent/shared";
import { normalizeText } from "@jobagent/shared";
import type { DiscoverParams, DiscoverResult, FetchFn, SourceAdapter } from "../types";

interface RemoteOkRow {
  id?: string | number;
  position?: string;
  company?: string;
  location?: string;
  description?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  tags?: string[];
}

/**
 * Pure parser: RemoteOK API payload -> RawPosting[]. The first array element is a legal/meta
 * object (no `position`/`id` job fields) and is filtered out. `query` is an optional
 * COMMA-separated keyword list — a job is kept if ANY term matches its title/company/tags
 * (RemoteOK has no server-side search, so this trims its all-categories feed to relevant roles).
 */
export function parseRemoteOk(rows: RemoteOkRow[], query?: string): RawPosting[] {
  const terms = (query ?? "")
    .split(",")
    .map((t) => normalizeText(t))
    .filter(Boolean);
  return rows
    .filter((r) => r.id != null && r.position)
    .map((r) => ({
      sourceJobId: String(r.id),
      title: String(r.position),
      company: r.company ?? "Unknown",
      location: r.location || "Remote",
      remote: true,
      description: r.description,
      url: r.url || r.apply_url,
      postedAt: r.date,
      _tags: (r.tags ?? []).join(" "),
    }))
    .filter((p) => {
      if (terms.length === 0) return true;
      const hay = normalizeText(`${p.title} ${p.company} ${p._tags}`);
      return terms.some((t) => hay.includes(t));
    })
    .map(({ _tags, ...p }) => p);
}

export interface RemoteOkOptions {
  query?: string;
  rps?: number;
}

/** RemoteOK API adapter (FR-101). Public JSON API; requires a descriptive User-Agent. */
export class RemoteOkAdapter implements SourceAdapter {
  readonly kind = "remoteok" as const;
  readonly supportsApply = false;
  readonly key = "remoteok";
  readonly rateLimit: { rps: number; burst: number };

  constructor(
    private readonly opts: RemoteOkOptions = {},
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.rateLimit = { rps: opts.rps ?? 1, burst: 2 };
  }

  async discover(params: DiscoverParams): Promise<DiscoverResult> {
    const url = "https://remoteok.com/api";
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        headers: { accept: "application/json", "user-agent": "jobagent/0.1 (personal job search)" },
      });
    } catch (e) {
      throw new RetryableError("remoteok fetch failed", { url, cause: String(e) });
    }
    if (!res.ok) throw new RetryableError(`remoteok responded ${res.status}`, { url, status: res.status });
    const rows = (await res.json()) as RemoteOkRow[];
    return { postings: parseRemoteOk(rows, params.query ?? this.opts.query) };
  }
}
