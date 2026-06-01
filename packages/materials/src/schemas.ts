import { z } from "zod";

/** A factual claim in a generated document, paired with its grounding evidence. */
export const ClaimSchema = z.object({
  text: z.string(), // the claim as it appears in the document
  evidence: z.string(), // the exact profile fact that supports it
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Tailored resume content (ATS-friendly), grounded only in the master profile. */
export const TailoredResumeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  emphasizedSkills: z.array(z.string()),
  bullets: z.array(z.string()), // tailored experience/impact bullets
  claims: z.array(ClaimSchema), // every substantive claim, with profile evidence
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export const CoverLetterSchema = z.object({
  greeting: z.string(),
  body: z.string(),
  closing: z.string(),
  claims: z.array(ClaimSchema),
});
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

/** Critic verdict: anti-fabrication + quality gate (FR-304). */
export const CriticVerdictSchema = z.object({
  pass: z.boolean(),
  issues: z.array(
    z.object({
      claim: z.string(),
      reason: z.string(),
      severity: z.enum(["fabrication", "unsupported", "quality"]),
    }),
  ),
  notes: z.string(),
});
export type CriticVerdict = z.infer<typeof CriticVerdictSchema>;

// ---- Hand-written JSON Schemas for the API structured-output constraint. ----
// (We avoid the SDK's zod→JSON-schema helper, which requires zod v4's z.toJSONSchema.)
const claimsJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: { text: { type: "string" }, evidence: { type: "string" } },
    required: ["text", "evidence"],
    additionalProperties: false,
  },
} as const;

export const TailoredResumeJsonSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    emphasizedSkills: { type: "array", items: { type: "string" } },
    bullets: { type: "array", items: { type: "string" } },
    claims: claimsJsonSchema,
  },
  required: ["headline", "summary", "emphasizedSkills", "bullets", "claims"],
  additionalProperties: false,
} as const;

export const CoverLetterJsonSchema = {
  type: "object",
  properties: {
    greeting: { type: "string" },
    body: { type: "string" },
    closing: { type: "string" },
    claims: claimsJsonSchema,
  },
  required: ["greeting", "body", "closing", "claims"],
  additionalProperties: false,
} as const;

export const CriticVerdictJsonSchema = {
  type: "object",
  properties: {
    pass: { type: "boolean" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          reason: { type: "string" },
          severity: { type: "string", enum: ["fabrication", "unsupported", "quality"] },
        },
        required: ["claim", "reason", "severity"],
        additionalProperties: false,
      },
    },
    notes: { type: "string" },
  },
  required: ["pass", "issues", "notes"],
  additionalProperties: false,
} as const;
