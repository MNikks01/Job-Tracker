import { describe, it, expect } from "vitest";
import { dedupeJobs } from "./dedupe";
import { jobCanonicalKey, type CanonicalJob } from "@jobagent/shared";

function job(partial: Partial<CanonicalJob> & { title: string; company: string; key: string; id: string }): CanonicalJob {
  return {
    canonicalKey: jobCanonicalKey(partial.title, partial.company, partial.location),
    title: partial.title,
    company: partial.company,
    location: partial.location,
    description: partial.description,
    url: partial.url,
    source: { key: partial.key, sourceJobId: partial.id },
    fetchedAt: new Date().toISOString(),
  };
}

describe("dedupeJobs (FR-103)", () => {
  it("merges the same role from two sources into one canonical job with both provenances (AC-D1)", () => {
    // True duplicate: same title/company/location (canonical key includes location).
    // First carries description, second carries url -> backfill should combine them.
    const input = [
      job({ title: "Senior Node.js Engineer", company: "Acme", location: "Remote", key: "greenhouse", id: "g1", description: "desc" }),
      job({ title: "senior node js engineer", company: "ACME", location: "remote", key: "lever", id: "l9", url: "https://lever.co/acme/l9" }),
    ];
    const { jobs, duplicatesMerged } = dedupeJobs(input);
    expect(jobs).toHaveLength(1);
    expect(duplicatesMerged).toBe(1);
    expect(jobs[0]!.provenance).toHaveLength(2);
    // backfilled missing fields from the duplicate
    expect(jobs[0]!.description).toBe("desc");
    expect(jobs[0]!.url).toBe("https://lever.co/acme/l9");
  });

  it("keeps distinct roles separate", () => {
    const input = [
      job({ title: "Backend Engineer", company: "Acme", key: "greenhouse", id: "g1" }),
      job({ title: "Frontend Engineer", company: "Acme", key: "greenhouse", id: "g2" }),
    ];
    expect(dedupeJobs(input).jobs).toHaveLength(2);
  });

  it("does not duplicate identical provenance", () => {
    const j = job({ title: "X", company: "Y", key: "rss", id: "same" });
    const { jobs } = dedupeJobs([j, j]);
    expect(jobs[0]!.provenance).toHaveLength(1);
  });
});
