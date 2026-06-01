import { describe, it, expect } from "vitest";
import { cosineSimilarity, LocalHashEmbedder, l2normalize, toPgVector } from "./embedder";

describe("LocalHashEmbedder", () => {
  const emb = new LocalHashEmbedder(256);

  it("produces deterministic, unit-length vectors of the right dim", async () => {
    const [a, b] = await emb.embed(["Senior Node.js Engineer", "Senior Node.js Engineer"]);
    expect(a).toHaveLength(256);
    expect(cosineSimilarity(a!, b!)).toBeCloseTo(1, 6); // identical text → cosine 1
    const norm = Math.sqrt(a!.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("ranks a related role higher than an unrelated one", async () => {
    const [profile, related, unrelated] = await emb.embed([
      "node typescript backend microservices aws docker postgresql redis",
      "Senior Backend Engineer building Node.js microservices on AWS with PostgreSQL",
      "Oil rig welder needed for offshore platform, manual labor, no computers",
    ]);
    const simRelated = cosineSimilarity(profile!, related!);
    const simUnrelated = cosineSimilarity(profile!, unrelated!);
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it("toPgVector serializes to pgvector text form", () => {
    expect(toPgVector([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });

  it("l2normalize handles the zero vector safely", () => {
    expect(l2normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
