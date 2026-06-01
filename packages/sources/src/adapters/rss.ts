import { XMLParser } from "fast-xml-parser";
import type { RawPosting } from "@jobagent/shared";
import { RetryableError } from "@jobagent/shared";
import type { DiscoverParams, DiscoverResult, FetchFn, SourceAdapter } from "../types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { "#text"?: string };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Pure parser: RSS/Atom XML -> RawPosting[]. Generic feeds don't carry a company per item,
 * so a configured `company` is used (e.g. a company careers feed). FR-101.
 */
export function parseRss(xml: string, company: string): RawPosting[] {
  const doc = parser.parse(xml) as {
    rss?: { channel?: { item?: RssItem | RssItem[] } };
  };
  const items = asArray(doc.rss?.channel?.item);
  return items
    .filter((it) => it.title)
    .map((it, idx) => {
      const guid = typeof it.guid === "string" ? it.guid : it.guid?.["#text"];
      return {
        sourceJobId: guid ?? it.link ?? `item-${idx}`,
        title: String(it.title),
        company,
        description: it.description,
        url: it.link,
        postedAt: it.pubDate,
      } satisfies RawPosting;
    });
}

export interface RssOptions {
  url: string;
  company: string;
  rps?: number;
}

/** Generic RSS/Atom job feed adapter (FR-101). */
export class RssAdapter implements SourceAdapter {
  readonly kind = "rss" as const;
  readonly supportsApply = false;
  readonly key: string;
  readonly rateLimit: { rps: number; burst: number };

  constructor(
    private readonly opts: RssOptions,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.key = `rss:${opts.url}`;
    this.rateLimit = { rps: opts.rps ?? 1, burst: 2 };
  }

  async discover(_params: DiscoverParams): Promise<DiscoverResult> {
    let res: Response;
    try {
      res = await this.fetchFn(this.opts.url, { headers: { accept: "application/rss+xml" } });
    } catch (e) {
      throw new RetryableError("rss fetch failed", { url: this.opts.url, cause: String(e) });
    }
    if (!res.ok) {
      throw new RetryableError(`rss responded ${res.status}`, {
        url: this.opts.url,
        status: res.status,
      });
    }
    const xml = await res.text();
    return { postings: parseRss(xml, this.opts.company) };
  }
}
