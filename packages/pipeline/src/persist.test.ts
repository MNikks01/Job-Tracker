import { describe, it, expect } from "vitest";
import { InMemoryJobRepository, type DedupedJob } from "@jobagent/core";
import { jobCanonicalKey } from "@jobagent/shared";
import { persistDiscovery } from "./persist";

function dj(
  title: string,
  company: string,
  provenance: { key: string; sourceJobId: string }[],
  extra: Partial<DedupedJob> = {},
): DedupedJob {
  return {
    canonicalKey: jobCanonicalKey(title, company, extra.location),
    title,
    company,
    location: extra.location,
    description: extra.description,
    url: extra.url,
    source: provenance[0]!,
    provenance,
    fetchedAt: new Date().toISOString(),
  };
}

describe("persistDiscovery (idempotent upsert, FR-103/105)", () => {
  it("creates new jobs on first run", async () => {
    const repo = new InMemoryJobRepository();
    const stats = await persistDiscovery(
      [dj("Senior Engineer", "Acme", [{ key: "greenhouse:acme", sourceJobId: "1" }])],
      repo,
    );
    expect(stats).toMatchObject({ total: 1, created: 1, updated: 0, unchanged: 0 });
    expect(await repo.count()).toBe(1);
  });

  it("is idempotent: re-running the same discovery adds nothing", async () => {
    const repo = new InMemoryJobRepository();
    const jobs = [dj("Senior Engineer", "Acme", [{ key: "greenhouse:acme", sourceJobId: "1" }])];
    await persistDiscovery(jobs, repo);
    const second = await persistDiscovery(jobs, repo);
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(await repo.count()).toBe(1);
  });

  it("adds provenance when a new source surfaces an existing job", async () => {
    const repo = new InMemoryJobRepository();
    await persistDiscovery(
      [dj("Senior Engineer", "Acme", [{ key: "greenhouse:acme", sourceJobId: "1" }])],
      repo,
    );
    const stats = await persistDiscovery(
      [dj("Senior Engineer", "Acme", [{ key: "lever:acme", sourceJobId: "9" }], { url: "https://lever/9" })],
      repo,
    );
    expect(stats).toMatchObject({ created: 0, updated: 1 });
    const [rec] = await repo.list();
    expect(rec!.provenance).toHaveLength(2);
    expect(rec!.url).toBe("https://lever/9"); // backfilled
    expect(await repo.count()).toBe(1);
  });
});
