import { z } from "zod";
import type { StructuredGenerator } from "@jobagent/llm";
import type { MasterProfile } from "@jobagent/shared";

export const ReplyDraftSchema = z.object({ subject: z.string(), body: z.string() });
export type ReplyDraft = z.infer<typeof ReplyDraftSchema>;

const ReplyDraftJsonSchema = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
  additionalProperties: false,
} as const;

export interface RecruiterMessage {
  from: string;
  subject: string;
  body: string;
  label: string;
}

/**
 * Draft a recruiter reply AS the candidate (FR-604). Honesty rules: only profile facts, and
 * only offer interview times from `proposedSlots` (never invent availability). The send is a
 * separate, approval-gated + target-validated step (FR-605).
 */
export function draftReply(
  llm: StructuredGenerator,
  args: { message: RecruiterMessage; profile: MasterProfile; proposedSlots?: string[]; model: string },
): Promise<ReplyDraft> {
  const p = args.profile;
  const system = [
    `You write brief, professional email replies AS ${p.fullName} to recruiters / hiring contacts.`,
    `Use ONLY these facts about ${p.fullName} — never invent experience, titles, or commitments:`,
    `- ${p.yearsExperience}y experience; seniority: ${p.seniority.join(", ")}`,
    `- skills: ${p.skills.slice(0, 24).join(", ")}`,
    args.proposedSlots && args.proposedSlots.length
      ? `If proposing interview times, offer ONLY these and nothing else: ${args.proposedSlots.join(" | ")}.`
      : `Do not commit to specific availability; if asked, say you'll share concrete times shortly.`,
    `Tone: warm, concise, enthusiastic but professional. 80–130 words. Sign off as ${p.fullName}.`,
    `Output a subject (reuse/prefix "Re:" appropriately) and a plain-text body.`,
  ].join("\n");

  const user = [
    `From: ${args.message.from}`,
    `Subject: ${args.message.subject}`,
    `Classified as: ${args.message.label}`,
    "",
    "Their message:",
    args.message.body,
  ].join("\n");

  return llm.generateStructured({
    model: args.model,
    system,
    user,
    schema: ReplyDraftSchema,
    jsonSchema: ReplyDraftJsonSchema as unknown as Record<string, unknown>,
  });
}
