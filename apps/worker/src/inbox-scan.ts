import { childLogger } from "@jobagent/shared";
import { authedClientFromEnv, GmailClient } from "@jobagent/google";
import { classifyEmail } from "@jobagent/inbox";

/**
 * Monitor recruiter responses (FR-601/602): fetch recent inbox mail and classify each.
 * Requires Google sign-in (oauth:google). Read-only — drafting/sending is a separate,
 * approval-gated step.
 *   DATABASE_URL=… GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… pnpm --filter @jobagent/worker inbox:scan
 */
const log = childLogger({ component: "inbox-scan" });

const client = authedClientFromEnv();
if (!client) {
  console.log("Google not connected. Set GOOGLE_CLIENT_ID/SECRET in .env, then run `oauth:google`.");
  process.exit(0);
}

const gmail = new GmailClient(client);
const query = process.env.GMAIL_QUERY ?? "in:inbox newer_than:14d";
const msgs = await gmail.listRecent(query, Number(process.env.GMAIL_MAX ?? "25"));

console.log(`\n=== Inbox (${msgs.length} messages, classified) ===`);
const interesting = ["interview_invite", "offer", "rejection", "info_request", "recruiter_outreach"];
let flagged = 0;
for (const m of msgs) {
  const c = classifyEmail({ subject: m.subject, body: m.body || m.snippet, fromAddr: m.from });
  if (interesting.includes(c.label)) flagged += 1;
  const mark = interesting.includes(c.label) ? "★" : " ";
  console.log(`${mark} [${c.label.padEnd(18)}] ${m.subject.slice(0, 60)} — ${m.from.slice(0, 40)}`);
}
console.log(`\n${flagged} recruiter-relevant message(s). Drafting replies is the next (approval-gated) step.`);
log.info({ scanned: msgs.length, flagged }, "inbox scan complete");
