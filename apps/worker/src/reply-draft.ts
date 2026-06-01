import { childLogger, defaultProfile, loadConfigFromEnv, loadProfileFromFile } from "@jobagent/shared";
import { BudgetGuard } from "@jobagent/core";
import { createPgPool, PgReplyDraftRepository } from "@jobagent/db";
import { authedClientFromEnv, CalendarClient, GmailClient } from "@jobagent/google";
import { classifyEmail, normalizeEmail, validateReplyTarget } from "@jobagent/inbox";
import { proposeSlots } from "@jobagent/scheduler";
import { DEFAULT_PRICING, LlmClient } from "@jobagent/llm";
import { draftReply } from "@jobagent/materials";

/**
 * Recruiter reply orchestration (FR-602/604/605/702): scan inbox → classify → for each
 * recruiter-relevant message, propose interview slots from the REAL calendar (for invites),
 * draft a reply with Claude, and validate the reply target. Output is a DRAFT for approval —
 * nothing is sent (send is the approval-gated gmail.sendReply step).
 *   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… GOOGLE_REDIRECT_URI=… \
 *   ANTHROPIC_API_KEY=… PROFILE_FILE=$(pwd)/config/profile.json \
 *   pnpm --filter @jobagent/worker reply:draft
 */
const log = childLogger({ component: "reply-draft" });
const TZ = process.env.TZ_HINT ?? "Asia/Kolkata";
const RELEVANT = new Set(["interview_invite", "offer", "info_request", "recruiter_outreach"]);

function fmtSlot(startISO: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startISO));
}

async function main(): Promise<void> {
  const client = authedClientFromEnv();
  if (!client) {
    console.log("Google not connected. Set GOOGLE_* in .env and run `oauth:google` first.");
    return;
  }
  const cfg = loadConfigFromEnv();
  const profile = (process.env.PROFILE_FILE && loadProfileFromFile(process.env.PROFILE_FILE)) || defaultProfile();
  const budget = new BudgetGuard({
    monthlyUsdCap: cfg.budgets.monthlyUsdCap,
    alertAtPct: cfg.budgets.alertAtPct,
    pricing: DEFAULT_PRICING,
    onAlert: (i) => log.warn(i, "budget threshold"),
  });
  const llm = new LlmClient(budget);
  const gmail = new GmailClient(client);
  const calendar = new CalendarClient(client);
  const model = cfg.models.reasoning;
  const drafts = process.env.DATABASE_URL ? new PgReplyDraftRepository(createPgPool(process.env.DATABASE_URL)) : null;

  const msgs = await gmail.listRecent(process.env.GMAIL_QUERY ?? "in:inbox newer_than:14d", Number(process.env.GMAIL_MAX ?? "25"));
  let candidates = msgs
    .map((m) => ({ m, c: classifyEmail({ subject: m.subject, body: m.body || m.snippet, fromAddr: m.from }) }))
    .filter((x) => RELEVANT.has(x.c.label));

  if (candidates.length === 0) {
    console.log("No recruiter-relevant emails in your inbox right now.");
    console.log("→ Showing the flow on a DEMO interview invite (nothing real is read/sent):\n");
    candidates = [
      {
        m: {
          id: "DEMO-MSG",
          threadId: "DEMO-THREAD",
          from: "Sarah Recruiter <sarah@acmecorp.com>",
          to: "you",
          subject: "Interview for Senior Backend Engineer",
          snippet: "",
          date: "",
          body: "Hi Nikhil, we loved your application for the Senior Backend Engineer role. Could we schedule a 45-minute technical interview next week? Please share your availability.",
        },
        c: { label: "interview_invite", confidence: 0.9, signals: [] },
      },
    ];
  }

  for (const { m, c } of candidates) {
    // 1) For interview invites, propose real slots from the calendar.
    let slots: string[] = [];
    if (c.label === "interview_invite") {
      const fromISO = new Date(Date.now() + 86_400_000).toISOString();
      const toISO = new Date(Date.now() + 8 * 86_400_000).toISOString();
      const busy = await calendar.freeBusy(fromISO, toISO);
      slots = proposeSlots({ fromISO, toISO, durationMin: 45, tz: TZ, busy, count: 3 }).map((s) => fmtSlot(s.startISO));
    }

    // 2) Draft the reply (grounded; only offers the proposed slots).
    const draft = await draftReply(llm, {
      message: { from: m.from, subject: m.subject, body: m.body || m.snippet, label: c.label },
      profile,
      proposedSlots: slots,
      model,
    });

    // 3) Validate the reply target (FR-605) before it could ever be sent.
    const to = normalizeEmail(m.from);
    const valid = validateReplyTarget(
      { threadId: m.threadId, messageId: m.id, fromAddr: m.from },
      { threadId: m.threadId, to, inReplyToMessageId: m.id },
    );

    // 4) Persist the draft so it shows in the dashboard inbox (pending your approval).
    if (drafts && valid.ok) {
      await drafts.upsert({
        sourceGmailId: m.id,
        threadId: m.threadId,
        fromAddr: m.from,
        toAddr: to,
        recruiterSubject: m.subject,
        label: c.label,
        subject: draft.subject,
        body: draft.body,
        proposedSlots: slots,
      });
    }

    console.log(`\n================ ${c.label.toUpperCase()} from ${m.from} ================`);
    console.log(`Subject: ${m.subject}`);
    if (slots.length) console.log(`Proposed slots (${TZ}): ${slots.join(" | ")}`);
    console.log(`\n--- DRAFT REPLY (subject: ${draft.subject}) ---\n${draft.body}`);
    console.log(`\nTarget check (FR-605): ${valid.ok ? "OK ✅ → saved to dashboard inbox for approval" : `BLOCKED ❌ (${valid.reason})`}`);
  }
  console.log(`\nReview + send drafts at the dashboard → /inbox. Nothing sent automatically.`);

  console.log(`\nLLM spend this run: $${budget.spent.toFixed(4)} (cap $${cfg.budgets.monthlyUsdCap})`);
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "reply:draft failed");
  process.exit(1);
});
