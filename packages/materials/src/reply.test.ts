import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defaultProfile } from "@jobagent/shared";
import type { GenerateOptions, StructuredGenerator } from "@jobagent/llm";
import { draftReply, ReplyDraftSchema } from "./reply";

const profile = defaultProfile();

/** Mock LLM that echoes part of the prompt so we can assert what was passed. */
function mockLlm(captured: { system?: string; user?: string }): StructuredGenerator {
  return {
    async generateStructured<T extends z.ZodTypeAny>(opts: GenerateOptions<T>): Promise<z.infer<T>> {
      captured.system = opts.system;
      captured.user = opts.user;
      return { subject: "Re: Interview", body: "Happy to chat — Tue 3pm works." } as z.infer<T>;
    },
  };
}

describe("draftReply (FR-604)", () => {
  it("passes proposed slots and the message into the prompt and returns a valid draft", async () => {
    const cap: { system?: string; user?: string } = {};
    const draft = await draftReply(mockLlm(cap), {
      message: { from: "sam@acme.com", subject: "Interview?", body: "Are you available?", label: "interview_invite" },
      profile,
      proposedSlots: ["Tue Jun 2, 3:00 PM IST", "Wed Jun 3, 11:00 AM IST"],
      model: "claude-opus-4-8",
    });
    expect(ReplyDraftSchema.safeParse(draft).success).toBe(true);
    expect(cap.system).toContain("Tue Jun 2, 3:00 PM IST");
    expect(cap.system).toContain("never invent");
    expect(cap.user).toContain("Are you available?");
  });

  it("instructs not to invent availability when no slots are given", async () => {
    const cap: { system?: string; user?: string } = {};
    await draftReply(mockLlm(cap), {
      message: { from: "r@x.com", subject: "Hi", body: "interested?", label: "recruiter_outreach" },
      profile,
      model: "claude-opus-4-8",
    });
    expect(cap.system).toContain("Do not commit to specific availability");
  });
});
