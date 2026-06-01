import { describe, it, expect } from "vitest";
import { parseRemotive } from "./remotive";
import { parseRemoteOk } from "./remoteok";
import { parseWeWorkRemotely } from "./weworkremotely";
import { normalizePostings } from "../normalizer";

describe("parseRemotive", () => {
  it("maps jobs to remote RawPostings", () => {
    const out = parseRemotive({
      jobs: [
        { id: 1, title: "Senior Node.js Engineer", company_name: "Acme", candidate_required_location: "Worldwide", url: "https://r/1", description: "node" },
      ],
    });
    expect(out[0]).toMatchObject({ sourceJobId: "1", title: "Senior Node.js Engineer", company: "Acme", location: "Worldwide", remote: true });
  });
});

describe("parseRemoteOk", () => {
  const rows = [
    { legal: "RemoteOK legal notice" }, // first element is meta — must be skipped
    { id: "abc", position: "Backend Engineer", company: "Globex", location: "Remote", url: "https://ro/abc", tags: ["node", "aws"] },
    { id: "def", position: "Designer", company: "Acme", tags: ["figma"] },
  ];
  it("skips the meta row and maps jobs", () => {
    const out = parseRemoteOk(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ sourceJobId: "abc", title: "Backend Engineer", company: "Globex", remote: true });
  });
  it("applies an optional keyword filter (title/company/tags)", () => {
    expect(parseRemoteOk(rows, "node").map((p) => p.title)).toEqual(["Backend Engineer"]);
  });
  it("supports a comma-separated OR keyword list", () => {
    expect(parseRemoteOk(rows, "node,figma").map((p) => p.title).sort()).toEqual([
      "Backend Engineer",
      "Designer",
    ]);
    expect(parseRemoteOk(rows, "ruby,php").map((p) => p.title)).toEqual([]);
  });
});

describe("parseWeWorkRemotely", () => {
  const xml = `<rss><channel>
    <item><title>Acme Inc: Senior Backend Engineer</title><link>https://wwr/1</link><guid>wwr-1</guid></item>
    <item><title>Plain Title Without Company</title><link>https://wwr/2</link><guid>wwr-2</guid></item>
  </channel></rss>`;
  it("splits 'Company: Position' titles", () => {
    const out = parseWeWorkRemotely(xml);
    expect(out[0]).toMatchObject({ company: "Acme Inc", title: "Senior Backend Engineer", remote: true });
    expect(out[1]).toMatchObject({ company: "Unknown", title: "Plain Title Without Company" });
  });
  it("normalizes into canonical jobs with remote inferred", () => {
    const norm = normalizePostings(parseWeWorkRemotely(xml), { key: "weworkremotely:x" });
    expect(norm[0]!.remote).toBe(true);
    expect(norm[0]!.canonicalKey).toMatch(/^[0-9a-f]{64}$/);
  });
});
