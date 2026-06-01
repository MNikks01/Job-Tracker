import { describe, it, expect } from "vitest";
import { scoreJob } from "./score";
import { defaultProfile } from "@jobagent/shared";

const profile = defaultProfile();

describe("scoreJob (rule-based, FR-201/202/203)", () => {
  it("scores a senior Node.js role highly with grounded rationale", () => {
    const r = scoreJob(
      {
        title: "Senior Backend Engineer, Node.js",
        description:
          "Build distributed microservices with Node.js, TypeScript, PostgreSQL, Redis, RabbitMQ on AWS with Docker.",
        location: "Remote, India",
        remote: true,
      },
      profile,
    );
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.subscores.title).toBe(1);
    expect(r.subscores.seniority).toBe(1);
    expect(r.subscores.location).toBe(1);
    expect(r.matchedSkills).toEqual(expect.arrayContaining(["node.js", "typescript", "aws", "docker"]));
    expect(r.excluded).toBe(false);
  });

  it("scores a sales role very low and flags it excluded", () => {
    const r = scoreJob(
      { title: "Account Executive - Italy", description: "Drive revenue and close deals.", remote: true },
      profile,
    );
    expect(r.excluded).toBe(true);
    expect(r.score).toBeLessThan(20);
    expect(r.subscores.title).toBe(0);
  });

  it("scores a junior frontend role below a senior backend role", () => {
    const junior = scoreJob(
      { title: "Junior Frontend Intern", description: "Learn React.", remote: true },
      profile,
    );
    const senior = scoreJob(
      { title: "Staff Software Engineer", description: "Node.js, TypeScript, AWS, microservices.", remote: true },
      profile,
    );
    expect(junior.subscores.seniority).toBe(0.2);
    expect(senior.score).toBeGreaterThan(junior.score);
  });

  it("penalizes an engineering role with no core-stack signal", () => {
    const r = scoreJob(
      { title: "Embedded Firmware Engineer", description: "C, assembly, RTOS, hardware bring-up.", remote: false, location: "Berlin" },
      profile,
    );
    expect(r.score).toBeLessThan(40);
  });

  it("does not false-match short skills inside larger words (word boundaries)", () => {
    const r = scoreJob(
      {
        title: "Program Manager",
        description: "Own standards and rewards; manage exposure across teams.",
        remote: true,
      },
      profile,
    );
    // 'rds' must not match 'standards'/'rewards'; 'expo' must not match 'exposure'.
    expect(r.matchedSkills).not.toContain("rds");
    expect(r.matchedSkills).not.toContain("expo");
  });

  it("gives lower confidence when there is no description", () => {
    const withDesc = scoreJob({ title: "Backend Engineer", description: "Node.js TypeScript", remote: true }, profile);
    const noDesc = scoreJob({ title: "Backend Engineer", remote: true }, profile);
    expect(noDesc.confidence).toBeLessThan(withDesc.confidence);
  });
});
