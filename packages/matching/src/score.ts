import { normalizeText, type MasterProfile } from "@jobagent/shared";

export interface MatchableJob {
  title: string;
  description?: string;
  location?: string;
  remote?: boolean;
}

export interface MatchSubscores {
  skills: number; // 0..1
  title: number; // 0..1
  seniority: number; // 0..1
  location: number; // 0..1
}

export interface MatchResult {
  score: number; // 0..100
  confidence: number; // 0..1
  subscores: MatchSubscores;
  matchedSkills: string[];
  rationale: string;
  excluded: boolean; // title indicates a clear non-fit (e.g. sales/marketing)
}

// Weights sum to 1.0. Skills dominate; title relevance is the strong secondary signal.
const WEIGHTS = { skills: 0.45, title: 0.3, seniority: 0.15, location: 0.1 } as const;
const SKILL_TARGET = 8; // this many distinct skill hits ⇒ full skills score
const ENG_KEYWORDS = [
  "engineer", "developer", "software", "full stack", "fullstack", "backend", "frontend",
  "platform", "sre", "devops", "architect",
];
const JUNIOR_WORDS = ["junior", "intern", "graduate", "new grad", "associate", "apprentice"];

/**
 * Rule-based job↔profile fit (FR-201/202/203). Pure + deterministic, offline (no LLM).
 * Produces a 0–100 score, calibrated-ish confidence, a readable rationale, and subscores.
 * Semantic (embedding) scoring is layered on later; this gives an explainable baseline.
 */
export function scoreJob(job: MatchableJob, profile: MasterProfile): MatchResult {
  const titleNorm = normalizeText(job.title);
  const hay = normalizeText(`${job.title} ${job.description ?? ""}`);

  const excluded = profile.excludeTitleKeywords.some((k) => containsTerm(titleNorm, k));

  const matchedSkills = profile.skills.filter((s) => containsTerm(hay, s));
  const skills = Math.min(1, matchedSkills.length / SKILL_TARGET);

  const title = scoreTitle(titleNorm, profile, excluded);
  const seniority = scoreSeniority(titleNorm, profile);
  const location = scoreLocation(job, profile);

  const hasMustHave = profile.mustHaveAnyOf.some((m) => containsTerm(hay, m));
  let raw =
    WEIGHTS.skills * skills +
    WEIGHTS.title * title +
    WEIGHTS.seniority * seniority +
    WEIGHTS.location * location;

  // Hard penalties: a clearly non-engineering title, or no must-have signal at all.
  if (excluded) raw *= 0.25;
  else if (!hasMustHave && title < 0.7) raw *= 0.5;

  const score = Math.round(100 * raw);

  let confidence = 0.5;
  if (job.description) confidence += 0.25;
  if (matchedSkills.length >= 4) confidence += 0.15;
  if (title >= 0.7) confidence += 0.1;
  confidence = Math.min(0.95, Number(confidence.toFixed(2)));

  return {
    score,
    confidence,
    subscores: { skills, title, seniority, location },
    matchedSkills,
    excluded,
    rationale: buildRationale({ matchedSkills, title, seniority, location, excluded, hasMustHave }),
  };
}

function scoreTitle(titleNorm: string, profile: MasterProfile, excluded: boolean): number {
  if (excluded) return 0;
  if (profile.targetTitles.some((t) => containsTerm(titleNorm, t))) return 1;
  if (ENG_KEYWORDS.some((k) => containsTerm(titleNorm, k))) return 0.7;
  return 0.15;
}

function scoreSeniority(titleNorm: string, profile: MasterProfile): number {
  if (JUNIOR_WORDS.some((j) => containsTerm(titleNorm, j))) return 0.2;
  if (profile.seniority.some((s) => containsTerm(titleNorm, s))) return 1;
  return 0.6; // unspecified seniority — neutral
}

function scoreLocation(job: MatchableJob, profile: MasterProfile): number {
  if (job.remote && profile.remoteOk) return 1;
  const loc = normalizeText(job.location);
  if (loc && profile.locations.some((l) => containsTerm(loc, l))) return 1;
  return 0.3;
}

/**
 * Whole-term match against already-normalized text. Uses word boundaries so short skills
 * like "rds"/"rest"/"expo" don't false-match inside "standards"/"interest"/"exposure".
 */
function containsTerm(haystackNorm: string, term: string): boolean {
  const t = normalizeText(term);
  if (t.length < 2) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(t)}(?:\\s|$)`).test(haystackNorm);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRationale(p: {
  matchedSkills: string[];
  title: number;
  seniority: number;
  location: number;
  excluded: boolean;
  hasMustHave: boolean;
}): string {
  if (p.excluded) return "Likely non-fit: title indicates a non-engineering role.";
  const parts: string[] = [];
  if (p.matchedSkills.length) {
    const shown = p.matchedSkills.slice(0, 6).join(", ");
    const more = p.matchedSkills.length > 6 ? ` +${p.matchedSkills.length - 6}` : "";
    parts.push(`Skills match: ${shown}${more}`);
  } else {
    parts.push("Few/no skill matches");
  }
  parts.push(p.title >= 1 ? "target title" : p.title >= 0.7 ? "engineering title" : "title weakly related");
  parts.push(p.seniority >= 1 ? "senior-level" : p.seniority <= 0.2 ? "junior-level" : "seniority unspecified");
  parts.push(p.location >= 1 ? "location/remote fit" : "location uncertain");
  if (!p.hasMustHave) parts.push("no core stack signal");
  return parts.join("; ") + ".";
}
