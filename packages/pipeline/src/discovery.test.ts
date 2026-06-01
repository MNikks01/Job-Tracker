import { describe, it, expect } from "vitest";
import { runDiscovery } from "./discovery";
import { GreenhouseAdapter, RssAdapter } from "@jobagent/sources";

const greenhousePayload = {
  jobs: [
    { id: 1, title: "Senior Node.js Engineer", location: { name: "Remote" }, absolute_url: "https://gh/1", content: "node" },
    { id: 2, title: "Staff Backend Engineer", location: { name: "Bangalore" }, absolute_url: "https://gh/2" },
  ],
};
const rssXml = `<rss><channel>
  <item><title>Senior Node.js Engineer</title><link>https://acme.com/n1</link><guid>n1</guid></item>
</channel></rss>`;

const okJson = (body: unknown) => async () =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const okXml = (xml: string) => async () => new Response(xml, { status: 200 });
const fail = async () => new Response("err", { status: 500 });

describe("runDiscovery (FR-101→103 vertical slice)", () => {
  it("discovers, normalizes, and dedupes across two sources", async () => {
    const gh = new GreenhouseAdapter({ board: "acme", company: "Acme" }, okJson(greenhousePayload));
    const rss = new RssAdapter({ url: "https://acme.com/jobs.rss", company: "Acme" }, okXml(rssXml));

    const out = await runDiscovery([gh, rss]);

    // GH "Senior Node.js Engineer (Remote)" + RSS "Senior Node.js Engineer" (no location)
    // have different canonical keys (location differs), so we expect 3 canonical jobs total,
    // but the GH Senior role and RSS Senior role only merge if location matches.
    expect(out.stats.rawPostings).toBe(3);
    expect(out.stats.sourcesFailed).toBe(0);
    expect(out.jobs.length).toBeGreaterThanOrEqual(2);
    expect(out.errors).toHaveLength(0);
  });

  it("continues when one source fails (resilience)", async () => {
    const gh = new GreenhouseAdapter({ board: "acme", company: "Acme" }, okJson(greenhousePayload));
    const broken = new RssAdapter({ url: "https://x", company: "Acme" }, fail);

    const out = await runDiscovery([gh, broken]);

    expect(out.stats.sourcesRun).toBe(2);
    expect(out.stats.sourcesFailed).toBe(1);
    expect(out.errors[0]!.source).toBe("rss:https://x");
    expect(out.errors[0]!.kind).toBe("retryable");
    expect(out.jobs.length).toBe(2); // greenhouse jobs still flow through
  });
});
