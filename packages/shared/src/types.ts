import { z } from "zod";

/** Canonical, normalized job posting (FR-102). Source-agnostic. */
export const CanonicalJobSchema = z.object({
  canonicalKey: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  postedAt: z.string().optional(), // ISO
  compMin: z.number().optional(),
  compMax: z.number().optional(),
  source: z.object({
    key: z.string(),
    sourceJobId: z.string(),
  }),
  fetchedAt: z.string(), // ISO
});
export type CanonicalJob = z.infer<typeof CanonicalJobSchema>;

/** Raw posting as returned by a source adapter before normalization. */
export interface RawPosting {
  sourceJobId: string;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  description?: string;
  url?: string;
  postedAt?: string;
}

/** Application lifecycle states (docs/requirements/use-cases.md state machine). */
export const APPLICATION_STATES = [
  "discovered",
  "matched",
  "materials_drafted",
  "pending_approval",
  "applied",
  "rejected_by_user",
  "snoozed",
  "needs_manual",
  "responded",
  "ghosted",
  "interview_scheduled",
  "interviewed",
  "offer",
  "accepted",
  "declined",
  "rejected_by_company",
  "archived",
] as const;
export type ApplicationState = (typeof APPLICATION_STATES)[number];
