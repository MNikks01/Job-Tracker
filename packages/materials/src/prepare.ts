import type { StructuredGenerator } from "@jobagent/llm";
import type { MasterProfile } from "@jobagent/shared";
import {
  coverLetterToText,
  critiqueMaterial,
  generateCoverLetter,
  generateResume,
  resumeToText,
  type JobInput,
  type Models,
} from "./generate";
import type { CoverLetter, CriticVerdict, TailoredResume } from "./schemas";

export interface PreparedMaterials {
  resume: TailoredResume;
  cover: CoverLetter;
  resumeVerdict: CriticVerdict;
  coverVerdict: CriticVerdict;
  /** True if EITHER document failed the anti-fabrication Critic (FR-304) — must not be applied. */
  blocked: boolean;
}

/**
 * End-to-end material preparation for one job: generate grounded résumé + cover letter, then
 * run the Critic on each. `blocked` is the HITL/honesty gate — if the Critic fails on either,
 * the application must NOT advance to the approval queue (it goes to needs_manual instead).
 */
export async function prepareMaterials(
  llm: StructuredGenerator,
  job: JobInput,
  profile: MasterProfile,
  models: Models,
): Promise<PreparedMaterials> {
  const resume = await generateResume(llm, job, profile, models);
  const cover = await generateCoverLetter(llm, job, profile, models);

  const resumeVerdict = await critiqueMaterial(
    llm,
    { kind: "resume", text: resumeToText(resume), claims: resume.claims },
    profile,
    models,
  );
  const coverVerdict = await critiqueMaterial(
    llm,
    { kind: "cover_letter", text: coverLetterToText(cover), claims: cover.claims },
    profile,
    models,
  );

  return {
    resume,
    cover,
    resumeVerdict,
    coverVerdict,
    blocked: !resumeVerdict.pass || !coverVerdict.pass,
  };
}
