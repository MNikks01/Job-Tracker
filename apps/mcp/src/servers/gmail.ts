import { z } from "zod";
import { classifyEmail, validateReplyTarget } from "@jobagent/inbox";
import { authedClientFromEnv, GmailClient } from "@jobagent/google";
import { serve, text } from "../lib/serve";

// gmail-mcp — classify + reply-target guard work offline; list/send go live once Google is
// connected (oauth:google). Outward send requires an approval token (HITL).
const gclient = authedClientFromEnv();
const gmail = gclient ? new GmailClient(gclient) : null;

await serve("gmail", (s) => {
  s.registerTool(
    "gmail.classify",
    {
      title: "Classify a recruiter email",
      description: "Rule-based triage (interview_invite/offer/rejection/info_request/recruiter_outreach/other).",
      inputSchema: { subject: z.string().optional(), body: z.string().optional(), fromAddr: z.string().optional() },
    },
    async (email) => text(classifyEmail(email)),
  );
  s.registerTool(
    "gmail.validateReply",
    {
      title: "Validate a reply target (FR-605)",
      description: "Blocks a send whose recipient/thread/in-reply-to doesn't match the source message.",
      inputSchema: {
        source: z.object({ threadId: z.string(), messageId: z.string(), fromAddr: z.string() }),
        draft: z.object({ threadId: z.string(), to: z.string(), inReplyToMessageId: z.string() }),
      },
    },
    async ({ source, draft }) => text(validateReplyTarget(source, draft)),
  );
  s.registerTool(
    "gmail.listMessages",
    {
      title: "List + classify inbox messages",
      description: "Recent recruiter-relevant mail, auto-classified. Requires Google sign-in.",
      inputSchema: { query: z.string().optional(), max: z.number().int().positive().max(50).optional() },
    },
    async ({ query, max }) => {
      if (!gmail) return text({ status: "needs_setup", reason: "Gmail not connected — run oauth:google" });
      const msgs = await gmail.listRecent(query ?? "in:inbox newer_than:14d", max ?? 20);
      return text(
        msgs.map((m) => {
          const c = classifyEmail({ subject: m.subject, body: m.body || m.snippet, fromAddr: m.from });
          return { id: m.id, threadId: m.threadId, from: m.from, subject: m.subject, label: c.label, confidence: c.confidence };
        }),
      );
    },
  );
  s.registerTool(
    "gmail.sendReply",
    {
      title: "Send a reply",
      description: "OUTWARD — send a reply in-thread. Requires an approval token (HITL) + Google sign-in.",
      inputSchema: {
        threadId: z.string(),
        to: z.string(),
        subject: z.string().optional(),
        bodyText: z.string(),
        inReplyToMessageId: z.string(),
        approvalToken: z.string(),
      },
    },
    async (a) => {
      if (!gmail) return text({ status: "needs_setup", reason: "Gmail not connected — run oauth:google" });
      if (!a.approvalToken) return text({ status: "blocked", reason: "approval token required (HITL)" });
      const r = await gmail.sendReply({
        threadId: a.threadId,
        to: a.to,
        subject: a.subject ?? "",
        bodyText: a.bodyText,
        inReplyToMessageId: a.inReplyToMessageId,
      });
      return text({ sent: r.id });
    },
  );
});
