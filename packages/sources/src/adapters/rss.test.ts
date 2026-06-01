import { describe, it, expect } from "vitest";
import { parseRss } from "./rss";
import { normalizePostings } from "../normalizer";

const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Acme Careers</title>
  <item>
    <title>Senior Node.js Engineer (Remote)</title>
    <link>https://acme.com/jobs/1</link>
    <description>Build distributed systems</description>
    <pubDate>Mon, 05 May 2026 10:00:00 GMT</pubDate>
    <guid>acme-1</guid>
  </item>
  <item>
    <title>Staff Engineer</title>
    <link>https://acme.com/jobs/2</link>
    <guid>acme-2</guid>
  </item>
</channel></rss>`;

describe("parseRss", () => {
  it("parses items into RawPosting[]", () => {
    const out = parseRss(xml, "Acme");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ sourceJobId: "acme-1", title: "Senior Node.js Engineer (Remote)", company: "Acme" });
  });

  it("normalizes remote inference from title", () => {
    const norm = normalizePostings(parseRss(xml, "Acme"), { key: "rss:acme" });
    expect(norm[0]!.remote).toBe(true); // "(Remote)" in title
    expect(norm[1]!.remote).toBe(false);
    expect(norm[0]!.canonicalKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles a single-item feed (non-array)", () => {
    const single = `<rss><channel><item><title>Solo Role</title><guid>x</guid></item></channel></rss>`;
    expect(parseRss(single, "Acme")).toHaveLength(1);
  });
});
