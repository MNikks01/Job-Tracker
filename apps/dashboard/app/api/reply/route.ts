import { NextRequest, NextResponse } from "next/server";
import { PgReplyDraftRepository, PgAuditRepository } from "@jobagent/db";
import { validateReplyTarget } from "@jobagent/inbox";
import { GmailClient, authedClientFromEnv } from "@jobagent/google";
import { db } from "../../db";

export const dynamic = "force-dynamic";

const isDemo = (s: string) => s.startsWith("DEMO");

/**
 * HITL reply action (FR-604/FR-605): send a recruiter reply only after an explicit human click,
 * and only after the reply target re-passes the strict same-thread/same-sender guard. Reject simply
 * drops the draft. Demo drafts are never actually emailed. Posted from /inbox as a plain form.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const action = String(form.get("action") ?? "");
  const back = (qs: string) => NextResponse.redirect(new URL(`/inbox?${qs}`, req.url), 303);

  if (!id || (action !== "send" && action !== "reject")) return back("error=bad-request");

  const pool = db();
  const drafts = new PgReplyDraftRepository(pool);
  const audit = new PgAuditRepository(pool);

  try {
    const d = await drafts.get(id);
    if (!d) return back("error=not-found");
    if (d.status !== "pending") return back("error=already-decided");

    if (action === "reject") {
      await drafts.markRejected(id);
      return back("rejected=1");
    }

    // Re-validate the reply target right before sending (FR-605) — defense in depth.
    const valid = validateReplyTarget(
      { threadId: d.threadId, messageId: d.sourceGmailId, fromAddr: d.fromAddr },
      { threadId: d.threadId, to: d.toAddr, inReplyToMessageId: d.sourceGmailId },
    );
    if (!valid.ok) return back(`error=${encodeURIComponent("target-check: " + valid.reason)}`);

    let sentId: string;
    if (isDemo(d.sourceGmailId) || isDemo(d.threadId)) {
      // Demo draft — exercise the full HITL flow without emailing the fake recruiter.
      sentId = "DEMO-SENT";
    } else {
      const client = authedClientFromEnv();
      if (!client) return back(`error=${encodeURIComponent("google-not-authed: run oauth:google")}`);
      const gmail = new GmailClient(client);
      const res = await gmail.sendReply({
        threadId: d.threadId,
        to: d.toAddr,
        subject: d.subject,
        bodyText: d.body,
        inReplyToMessageId: d.sourceGmailId,
      });
      sentId = res.id;
    }

    await drafts.markSent(id, sentId);
    await audit.append({
      actor: "operator",
      action: "recruiter.reply.sent",
      payload: { replyDraftId: id, threadId: d.threadId, to: d.toAddr, label: d.label, demo: isDemo(d.sourceGmailId), via: "dashboard" },
    });
    return back(isDemo(d.sourceGmailId) ? "sent=demo" : "sent=1");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    return back(`error=${encodeURIComponent(msg.slice(0, 100))}`);
  }
}
