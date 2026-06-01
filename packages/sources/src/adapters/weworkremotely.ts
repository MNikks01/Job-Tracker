import { XMLParser } from "fast-xml-parser";
import type { RawPosting } from "@jobagent/shared";
import { RetryableError } from "@jobagent/shared";
import type { DiscoverParams, DiscoverResult, FetchFn, SourceAdapter } from "../types";

// processEntities:false avoids fast-xml-parser's entity-expansion guard on large feeds
// (WWR descriptions contain many HTML entities); we don't need them decoded for our fields.
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });

interface WwrItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { "#text"?: string };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/**
 * Pure parser: WeWorkRemotely RSS -> RawPosting[]. WWR titles are "Company: Position", so we
 * split on the first ": " to recover the real company name (a generic RSS adapter can't).
 */
export function parseWeWorkRemotely(xml: string): RawPosting[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: WwrItem | WwrItem[] } } };
  return asArray(doc.rss?.channel?.item)
    .filter((it) => it.title)
    .map((it, idx) => {
      const raw = String(it.title);
      const sep = raw.indexOf(": ");
      const company = sep > 0 ? raw.slice(0, sep).trim() : "Unknown";
      const title = sep > 0 ? raw.slice(sep + 2).trim() : raw;
      const guid = typeof it.guid === "string" ? it.guid : it.guid?.["#text"];
      return {
        sourceJobId: guid ?? it.link ?? `wwr-${idx}`,
        title,
        company,
        location: "Remote",
        remote: true,
        description: it.description,
        url: it.link,
        postedAt: it.pubDate,
      } satisfies RawPosting;
    });
}

export interface WeWorkRemotelyOptions {
  // RSS category feed; defaults to back-end programming.
  rssUrl?: string;
  rps?: number;
}

const DEFAULT_FEED = "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss";

/** WeWorkRemotely RSS adapter (FR-101). Public feeds, ToS-friendly. */
export class WeWorkRemotelyAdapter implements SourceAdapter {
  readonly kind = "weworkremotely" as const;
  readonly supportsApply = false;
  readonly key: string;
  readonly rateLimit: { rps: number; burst: number };
  private readonly url: string;

  constructor(
    private readonly opts: WeWorkRemotelyOptions = {},
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.url = opts.rssUrl ?? DEFAULT_FEED;
    this.key = `weworkremotely:${this.url}`;
    this.rateLimit = { rps: opts.rps ?? 1, burst: 2 };
  }

  async discover(_params: DiscoverParams): Promise<DiscoverResult> {
    let res: Response;
    try {
      res = await this.fetchFn(this.url, { headers: { accept: "application/rss+xml" } });
    } catch (e) {
      throw new RetryableError("weworkremotely fetch failed", { url: this.url, cause: String(e) });
    }
    if (!res.ok) throw new RetryableError(`weworkremotely responded ${res.status}`, { url: this.url, status: res.status });
    return { postings: parseWeWorkRemotely(await res.text()) };
  }
}
