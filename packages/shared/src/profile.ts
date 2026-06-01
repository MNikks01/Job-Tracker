import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

/**
 * MasterProfile — the single source of truth for facts about the job seeker (FR-301).
 * Used by matching (rule-based now, semantic later) and, in Sprint 2+, by the grounded
 * resume/cover-letter generation + the anti-fabrication Critic. Derived from the résumé.
 */
export const MasterProfileSchema = z.object({
  fullName: z.string(),
  headline: z.string().optional(),
  yearsExperience: z.number().nonnegative().default(0),
  seniority: z.array(z.string()).default([]), // e.g. senior, staff, lead
  targetTitles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  /** At least one of these must appear for a role to be considered relevant. */
  mustHaveAnyOf: z.array(z.string()).default([]),
  /** Title keywords that strongly indicate a non-fit (sales/marketing/etc.). */
  excludeTitleKeywords: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remoteOk: z.boolean().default(true),
});
export type MasterProfile = z.infer<typeof MasterProfileSchema>;

export function loadProfileFromFile(
  path: string,
  readFile: (p: string) => string | null = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null),
): MasterProfile | null {
  const raw = readFile(path);
  if (raw === null) return null;
  return MasterProfileSchema.parse(JSON.parse(raw));
}

/** Nikhil Meshram's profile, derived from MERN_Nikhil.pdf. Overridable via config/profile.json. */
export function defaultProfile(): MasterProfile {
  return MasterProfileSchema.parse({
    fullName: "Nikhil Meshram",
    headline: "Senior Full Stack Engineer | MERN | Node.js | AWS | Docker",
    yearsExperience: 5,
    seniority: ["senior", "staff", "lead", "principal"],
    targetTitles: [
      "senior software engineer",
      "senior full stack engineer",
      "full stack engineer",
      "backend engineer",
      "node.js engineer",
      "software engineer",
      "staff engineer",
      "platform engineer",
    ],
    skills: [
      "javascript", "typescript", "react", "next.js", "redux", "tanstack query", "tailwind",
      "node.js", "express", "graphql", "rest", "socket.io", "websockets", "jwt", "oauth",
      "rabbitmq", "bullmq", "microservices", "distributed systems", "mongodb", "postgresql",
      "prisma", "redis", "supabase", "firebase", "react native", "expo", "aws", "ec2", "s3",
      "rds", "docker", "docker compose", "nginx", "github actions", "ci/cd", "kubernetes",
      "turborepo", "pnpm", "prometheus", "grafana", "mcp", "puppeteer", "playwright",
    ],
    mustHaveAnyOf: ["node", "typescript", "javascript", "react", "full stack", "backend"],
    excludeTitleKeywords: [
      "sales", "account executive", "business development", "marketing", "recruiter",
      "designer", "customer success", "support", "finance", "people", "legal", "intern",
    ],
    locations: ["remote", "india", "nagpur", "maharashtra"],
    remoteOk: true,
  });
}
