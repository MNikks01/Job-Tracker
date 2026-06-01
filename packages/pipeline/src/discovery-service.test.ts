import { describe, it, expect } from "vitest";
import { InMemoryJobRepository } from "@jobagent/core";
import { GreenhouseAdapter, LeverAdapter } from "@jobagent/sources";
import { DiscoveryService } from "./discovery-service";

const ghPayload = {
  jobs: [
    { id: 1, title: "Senior Node.js Engineer", location: { name: "Remote" }, absolute_url: "https://gh/1" },
    { id: 2, title: "Staff Backend Engineer", location: { name: "Pune" }, absolute_url: "https://gh/2" },
  ],
};
const leverPayload = [
  { id: "l1", text: "Senior Node.js Engineer", categories: { location: "Remote" }, hostedUrl: "https://lv/l1" },
];

const okJson = (b: unknown) => async () => new Response(JSON.stringify(b), { status: 200 });

describe("DiscoveryService.run (end-to-end cycle)", () => {
  it("discovers, dedupes across sources, and persists idempotently", async () => {
    const repo = new InMemoryJobRepository();
    const adapters = [
      new GreenhouseAdapter({ board: "acme", company: "Acme" }, okJson(ghPayload)),
      new LeverAdapter({ handle: "acme", company: "Acme" }, okJson(leverPayload)),
    ];
    const svc = new DiscoveryService(adapters, repo);

    const first = await svc.run();
    // GH Senior(Remote) + Lever Senior(Remote) merge -> 1; GH Staff(Pune) -> 1 => 2 canonical
    expect(first.discovery.sourcesFailed).toBe(0);
    expect(first.persist.created).toBe(2);
    expect(await repo.count()).toBe(2);

    // Re-run: nothing new created (idempotent)
    const second = await svc.run();
    expect(second.persist.created).toBe(0);
    expect(await repo.count()).toBe(2);
  });
});
