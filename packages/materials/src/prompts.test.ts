import { describe, it, expect } from "vitest";
import { defaultProfile } from "@jobagent/shared";
import {
  ANTI_FABRICATION_CLAUSE,
  criticSystemPrompt,
  jobUserPrompt,
  profileBlock,
  resumeSystemPrompt,
} from "./prompts";

const profile = defaultProfile();

describe("prompt builders", () => {
  it("profileBlock includes real facts and no placeholders", () => {
    const b = profileBlock(profile);
    expect(b).toContain("Nikhil Meshram");
    expect(b).toContain("node.js");
    expect(b).toContain("Years of experience: 5");
  });

  it("resume system prompt embeds the anti-fabrication clause", () => {
    expect(resumeSystemPrompt(profile)).toContain(ANTI_FABRICATION_CLAUSE.trim().slice(0, 20));
    expect(resumeSystemPrompt(profile)).toContain("ATS-friendly");
  });

  it("critic system prompt instructs to fail on fabrication", () => {
    const c = criticSystemPrompt(profile);
    expect(c).toContain("pass=false");
    expect(c).toContain("fabrication");
  });

  it("jobUserPrompt renders the job posting", () => {
    const u = jobUserPrompt({ title: "Senior Node.js Engineer", company: "Acme", description: "Build APIs" });
    expect(u).toContain("Senior Node.js Engineer");
    expect(u).toContain("Acme");
    expect(u).toContain("Build APIs");
  });
});
