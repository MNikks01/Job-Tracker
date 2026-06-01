import Link from "next/link";
import { getReplyDrafts, type ReplyDraftView } from "../db";

// Reads live Postgres on every request (HITL control plane).
export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  interview_invite: "Interview invite",
  offer: "Offer",
  info_request: "Info request",
  recruiter_outreach: "Recruiter outreach",
};

export default async function Inbox() {
  const drafts = await getReplyDrafts();

  return (
    <main className="wrap">
      <header className="top">
        <h1>Recruiter inbox · reply drafts</h1>
        <span className="sub">
          <Link href="/">← dashboard</Link> · review & send · nothing leaves until you approve
        </span>
      </header>

      <div className="note">
        Each draft was grounded only in your profile and the calendar slots shown. Sending replies in the
        thread to the original sender after a strict target check (FR-605). Run
        <code> pnpm --filter @jobagent/worker reply:draft</code> to refresh this queue.
      </div>

      {drafts.length === 0 ? (
        <div className="empty">No pending reply drafts. Run inbox scan + reply draft to populate this queue.</div>
      ) : (
        drafts.map((d) => <DraftCard key={d.id} d={d} />)
      )}
    </main>
  );
}

function DraftCard({ d }: { d: ReplyDraftView }) {
  return (
    <div className="item" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="title">{d.recruiterSubject || "(no subject)"}</div>
          <div className="meta">
            from <strong>{d.fromAddr}</strong>
          </div>
        </div>
        <span className="pill">{LABELS[d.label] ?? d.label}</span>
      </div>

      {d.proposedSlots.length > 0 ? (
        <div className="why">Proposed slots: {d.proposedSlots.join(" · ")}</div>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <div className="meta">Reply subject: {d.subject}</div>
        <pre className="draftbody">{d.body}</pre>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <form action="/api/reply" method="post">
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="action" value="send" />
          <button className="approve" type="submit">
            Approve &amp; send ✓
          </button>
        </form>
        <form action="/api/reply" method="post">
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="action" value="reject" />
          <button className="reject" type="submit">
            Reject ✕
          </button>
        </form>
      </div>
    </div>
  );
}
