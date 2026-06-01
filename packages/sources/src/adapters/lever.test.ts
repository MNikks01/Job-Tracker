import { describe, it, expect, vi } from "vitest";
import { LeverAdapter, parseLever } from "./lever";
import { RetryableError } from "@jobagent/shared";

const sample = [
  {
    id: "abc-123",
    text: "Staff Software Engineer",
    categories: { location: "Remote", team: "Platform" },
    hostedUrl: "https://jobs.lever.co/acme/abc-123",
    descriptionPlain: "Build platforms",
    createdAt: 1746000000000,
  },
];

describe("parseLever", () => {
  it("maps postings to RawPosting[]", () => {
    const out = parseLever(sample, "Acme");
    expect(out[0]).toMatchObject({
      sourceJobId: "abc-123",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "Remote",
      url: "https://jobs.lever.co/acme/abc-123",
    });
    expect(out[0]!.postedAt).toBe(new Date(1746000000000).toISOString());
  });
});

describe("LeverAdapter.discover", () => {
  it("fetches and parses (injected fetch)", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const adapter = new LeverAdapter({ handle: "acme", company: "Acme" }, fetchFn);
    const res = await adapter.discover({});
    expect(res.postings).toHaveLength(1);
    expect(adapter.key).toBe("lever:acme");
  });

  it("throws RetryableError on failure", async () => {
    const fetchFn = vi.fn(async () => new Response("err", { status: 502 }));
    const adapter = new LeverAdapter({ handle: "acme" }, fetchFn);
    await expect(adapter.discover({})).rejects.toBeInstanceOf(RetryableError);
  });
});
