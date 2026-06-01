import { describe, it, expect, vi } from "vitest";
import { GreenhouseAdapter, parseGreenhouse } from "./greenhouse";
import { RetryableError } from "@jobagent/shared";

const sample = {
  jobs: [
    {
      id: 123,
      title: "Senior Backend Engineer",
      location: { name: "Remote - India" },
      absolute_url: "https://boards.greenhouse.io/acme/jobs/123",
      updated_at: "2026-05-01T00:00:00Z",
      content: "Node.js, AWS, microservices",
    },
  ],
};

describe("parseGreenhouse", () => {
  it("maps payload to RawPosting[] with the configured company", () => {
    const out = parseGreenhouse(sample, "Acme");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      sourceJobId: "123",
      title: "Senior Backend Engineer",
      company: "Acme",
      location: "Remote - India",
      url: "https://boards.greenhouse.io/acme/jobs/123",
    });
  });
  it("tolerates an empty payload", () => {
    expect(parseGreenhouse({ jobs: [] }, "Acme")).toEqual([]);
  });
});

describe("GreenhouseAdapter.discover", () => {
  it("fetches and parses (injected fetch)", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify(sample), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const adapter = new GreenhouseAdapter({ board: "acme", company: "Acme" }, fetchFn);
    const res = await adapter.discover({});
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(res.postings).toHaveLength(1);
    expect(adapter.key).toBe("greenhouse:acme");
    expect(adapter.supportsApply).toBe(false);
  });

  it("throws RetryableError on a non-200", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 503 }));
    const adapter = new GreenhouseAdapter({ board: "acme" }, fetchFn);
    await expect(adapter.discover({})).rejects.toBeInstanceOf(RetryableError);
  });
});
