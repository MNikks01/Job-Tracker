import { childLogger } from "@jobagent/shared";
import { classifyEmail, validateReplyTarget } from "@jobagent/inbox";

/**
 * Offline demo of the inbox classifier + reply-target guard (FR-602/605). No Gmail needed —
 * in production the Gmail MCP supplies real messages; the LLM refines edge cases + drafts.
 *   pnpm --filter @jobagent/worker inbox:demo
 */
const log = childLogger({ component: "inbox-demo" });

const samples = [
  { subject: "Next steps with Acme", body: "Loved your background! Could we schedule a technical interview this week? Share your availability." },
  { subject: "Your application", body: "Unfortunately we've decided to move forward with other candidates. We wish you the best." },
  { subject: "Offer — Senior Engineer", body: "We're pleased to offer you the role. The offer letter and compensation package are attached." },
  { subject: "Quick question", body: "Could you please send your salary expectations and confirm work authorization?" },
  { subject: "Hello from a recruiter", body: "I'm a recruiter and came across your profile — exciting opportunity for a Node.js role." },
  { subject: "Re: coffee", body: "Thanks for the chat yesterday, talk soon." },
];

function main(): void {
  console.log("\n=== Inbox classification (rule-based first pass) ===");
  for (const s of samples) {
    const c = classifyEmail(s);
    console.log(`  [${c.label.padEnd(18)} conf ${c.confidence}]  "${s.subject}"`);
    if (c.signals.length) console.log(`     signals: ${c.signals.join(", ")}`);
  }

  console.log("\n=== Reply-target guard (FR-605: blocks mis-sends) ===");
  const src = { threadId: "t1", messageId: "m1", fromAddr: "Sam <sam@acme.com>" };
  const good = validateReplyTarget(src, { threadId: "t1", to: "sam@acme.com", inReplyToMessageId: "m1" });
  const badRecipient = validateReplyTarget(src, { threadId: "t1", to: "someone-else@evil.com", inReplyToMessageId: "m1" });
  console.log(`  correct reply  → ${good.ok ? "ALLOWED ✅" : "blocked"}`);
  console.log(`  wrong recipient → ${badRecipient.ok ? "ALLOWED" : `BLOCKED ❌ (${badRecipient.reason})`}`);

  log.info("inbox demo complete");
}

main();
