import type { StructuredGenerator } from "@jobagent/llm";
import type { MasterProfile } from "@jobagent/shared";
import {
  CoverLetterJsonSchema,
  CoverLetterSchema,
  CriticVerdictJsonSchema,
  CriticVerdictSchema,
  TailoredResumeJsonSchema,
  TailoredResumeSchema,
  type CoverLetter,
  type CriticVerdict,
  type TailoredResume,
} from "./schemas";
import {
  coverLetterSystemPrompt,
  criticSystemPrompt,
  jobUserPrompt,
  resumeSystemPrompt,
} from "./prompts";

export interface JobInput {
  title: string;
  company: string;
  location?: string;
  description?: string;
}

export interface Models {
  reasoning: string; // e.g. claude-opus-4-8
}

/** Generate a tailored, grounded resume (FR-302). */
export function generateResume(
  llm: StructuredGenerator,
  job: JobInput,
  profile: MasterProfile,
  models: Models,
): Promise<TailoredResume> {
  return llm.generateStructured({
    model: models.reasoning,
    system: resumeSystemPrompt(profile),
    user: jobUserPrompt(job),
    schema: TailoredResumeSchema,
    jsonSchema: TailoredResumeJsonSchema as unknown as Record<string, unknown>,
  });
}

/** Generate a tailored, grounded cover letter (FR-303). */
export function generateCoverLetter(
  llm: StructuredGenerator,
  job: JobInput,
  profile: MasterProfile,
  models: Models,
): Promise<CoverLetter> {
  return llm.generateStructured({
    model: models.reasoning,
    system: coverLetterSystemPrompt(profile),
    user: jobUserPrompt(job),
    schema: CoverLetterSchema,
    jsonSchema: CoverLetterJsonSchema as unknown as Record<string, unknown>,
  });
}

/**
 * Critic / anti-fabrication gate (FR-304): verify every claim is grounded in the profile.
 * Returns pass=false with issues if anything is fabricated or unsupported.
 */
export function critiqueMaterial(
  llm: StructuredGenerator,
  material: { kind: "resume" | "cover_letter"; text: string; claims: { text: string; evidence: string }[] },
  profile: MasterProfile,
  models: Models,
): Promise<CriticVerdict> {
  const user = [
    `DOCUMENT TYPE: ${material.kind}`,
    "",
    `DOCUMENT TEXT:`,
    material.text,
    "",
    `CLAIMS (text → evidence the writer cited):`,
    ...material.claims.map((c, i) => `${i + 1}. "${c.text}" — evidence: "${c.evidence}"`),
  ].join("\n");

  return llm.generateStructured({
    model: models.reasoning,
    system: criticSystemPrompt(profile),
    user,
    schema: CriticVerdictSchema,
    jsonSchema: CriticVerdictJsonSchema as unknown as Record<string, unknown>,
  });
}

/** Flatten a resume to plain text for the Critic + storage. */
export function resumeToText(r: TailoredResume): string {
  return [r.headline, "", r.summary, "", "Skills: " + r.emphasizedSkills.join(", "), "", ...r.bullets.map((b) => `• ${b}`)].join("\n");
}

export function coverLetterToText(c: CoverLetter): string {
  return [c.greeting, "", c.body, "", c.closing].join("\n");
}
