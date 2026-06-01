import type { MasterProfile } from "@jobagent/shared";

/** Render the master profile as a stable, readable block for the (cached) system prompt. */
export function profileBlock(profile: MasterProfile): string {
  return [
    `CANDIDATE PROFILE (the ONLY source of truth — every claim must trace to this):`,
    `Name: ${profile.fullName}`,
    profile.headline ? `Headline: ${profile.headline}` : "",
    `Years of experience: ${profile.yearsExperience}`,
    `Seniority: ${profile.seniority.join(", ")}`,
    `Skills: ${profile.skills.join(", ")}`,
    `Target titles: ${profile.targetTitles.join(", ")}`,
    `Locations: ${profile.locations.join(", ")} (remote ok: ${profile.remoteOk})`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const ANTI_FABRICATION_CLAUSE = `
HARD RULES (non-negotiable):
- Use ONLY facts present in the candidate profile above. Never invent employers, job titles,
  dates, metrics, certifications, or skills the candidate does not have.
- If a job desires a skill the candidate lacks, OMIT it — do not claim it.
- Rephrasing and emphasis are allowed; fabrication is not.
- For every substantive claim you make, add an entry to "claims" with the exact supporting
  fact from the profile in "evidence". If you cannot cite evidence, do not make the claim.`;

export function resumeSystemPrompt(profile: MasterProfile): string {
  return [
    `You are an expert technical resume writer producing ATS-friendly, role-tailored resume`,
    `content for the candidate below.`,
    "",
    profileBlock(profile),
    ANTI_FABRICATION_CLAUSE,
    "",
    `Tailor the summary, emphasized skills, and bullets to the target job. Keep bullets`,
    `impact-oriented and concise. Output must satisfy the provided schema.`,
  ].join("\n");
}

export function coverLetterSystemPrompt(profile: MasterProfile): string {
  return [
    `You are writing a concise, sincere cover letter AS the candidate below (first person).`,
    "",
    profileBlock(profile),
    ANTI_FABRICATION_CLAUSE,
    "",
    `Keep it to ~200 words, specific to the role, warm but professional. No fluff.`,
  ].join("\n");
}

export function criticSystemPrompt(profile: MasterProfile): string {
  return [
    `You are a strict fact-checker enforcing honesty in job application materials.`,
    `Below is the candidate's TRUE profile. You will receive a generated document and its`,
    `list of claims. Flag ANY claim that is fabricated or unsupported by the profile`,
    `(invented employers, titles, dates, metrics, or skills the candidate lacks).`,
    "",
    profileBlock(profile),
    "",
    `Set pass=false if there is ANY fabrication or unsupported claim. For each problem add an`,
    `issue with severity: "fabrication" (invented fact), "unsupported" (claim without profile`,
    `evidence), or "quality" (weak/duplicated). Be precise and conservative — when unsure`,
    `whether a claim is supported, flag it as "unsupported".`,
  ].join("\n");
}

export function jobUserPrompt(job: {
  title: string;
  company: string;
  location?: string;
  description?: string;
}): string {
  return [
    `TARGET JOB`,
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : "",
    "",
    `Description:`,
    job.description ?? "(no description provided)",
  ]
    .filter(Boolean)
    .join("\n");
}
