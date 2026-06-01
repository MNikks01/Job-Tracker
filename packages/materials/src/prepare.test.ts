import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defaultProfile } from "@jobagent/shared";
import type { GenerateOptions, StructuredGenerator } from "@jobagent/llm";
import { prepareMaterials } from "./prepare";
import {
  CoverLetterSchema,
  CriticVerdictSchema,
  TailoredResumeSchema,
  type CriticVerdict,
} from "./schemas";

const profile = defaultProfile();
const job = { title: "Senior Backend Engineer", company: "Acme", description: "Node.js, AWS" };
const models = { reasoning: "claude-opus-4-8" };

const resume = {
  headline: "Senior Backend Engineer",
  summary: "Node.js + AWS engineer.",
  emphasizedSkills: ["node.js", "aws"],
  bullets: ["Built microservices with Node.js"],
  claims: [{ text: "Built microservices with Node.js", evidence: "microservices; node.js" }],
};
const cover = {
  greeting: "Hi Acme,",
  body: "I build Node.js systems.",
  closing: "Best, Nikhil",
  claims: [{ text: "I build Node.js systems", evidence: "node.js" }],
};

/** A mock LLM that returns canned outputs based on which schema is requested. */
function mockLlm(criticVerdict: CriticVerdict): StructuredGenerator {
  return {
    async generateStructured<T extends z.ZodTypeAny>(opts: GenerateOptions<T>): Promise<z.infer<T>> {
      if (opts.schema === TailoredResumeSchema) return resume as z.infer<T>;
      if (opts.schema === CoverLetterSchema) return cover as z.infer<T>;
      if (opts.schema === CriticVerdictSchema) return criticVerdict as z.infer<T>;
      throw new Error("unexpected schema");
    },
  };
}

describe("prepareMaterials (generate → Critic gate, FR-302/303/304)", () => {
  it("produces materials and is NOT blocked when the Critic passes", async () => {
    const pass: CriticVerdict = { pass: true, issues: [], notes: "all grounded" };
    const out = await prepareMaterials(mockLlm(pass), job, profile, models);
    expect(out.blocked).toBe(false);
    expect(out.resume.headline).toContain("Backend");
    expect(out.resumeVerdict.pass).toBe(true);
    expect(out.coverVerdict.pass).toBe(true);
  });

  it("is BLOCKED when the Critic flags a fabrication (honesty gate)", async () => {
    const fail: CriticVerdict = {
      pass: false,
      issues: [{ claim: "10 years at Google", reason: "not in profile", severity: "fabrication" }],
      notes: "fabricated employer",
    };
    const out = await prepareMaterials(mockLlm(fail), job, profile, models);
    expect(out.blocked).toBe(true);
    expect(out.resumeVerdict.issues[0]!.severity).toBe("fabrication");
  });
});
