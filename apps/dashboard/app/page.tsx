import Link from "next/link";
import { getPipeline, getQueue, getStats } from "./db";

// Reads live Postgres on every request (HITL control plane).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, queue, pipeline] = await Promise.all([getStats(), getQueue(), getPipeline()]);

  return (
    <main className="wrap">
      <header className="top">
        <h1>AI Job Search Agent</h1>
        <span className="sub">
          Human-in-the-loop control plane · Nikhil Meshram · <Link href="/inbox">Recruiter inbox →</Link>
        </span>
      </header>

      <section className="cards">
        <Card n={stats.jobs} l="Jobs discovered" />
        <Card n={stats.matched} l="Matched" />
        <Card n={stats.pendingApprovals} l="Pending approval" />
        <Card n={stats.applied} l="Applied" />
        <Card n={stats.needsManual} l="Needs manual" />
        <Link href="/inbox" style={{ textDecoration: "none" }}>
          <Card n={stats.pendingReplies} l="Reply drafts" />
        </Link>
        <Card n={stats.auditEntries} l="Audit entries" />
      </section>

      <h2>Approval queue</h2>
      {queue.length === 0 ? (
        <div className="empty">Nothing awaiting approval. Run the discovery → match → queue steps.</div>
      ) : (
        queue.map((row) => (
          <div className="item" key={row.approvalId}>
            <div>
              <Link href={`/app/${row.appId}`} className="title">
                {row.title}
              </Link>
              <div className="meta">
                {row.company}
                {row.location ? ` · ${row.location}` : ""}
              </div>
              {row.rationale ? <div className="why">{row.rationale}</div> : null}
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <div className="score">{row.score ?? "—"}</div>
              <form action="/api/approve" method="post" style={{ marginTop: 10 }}>
                <input type="hidden" name="approvalId" value={row.approvalId} />
                <button className="approve" type="submit">
                  Approve ✓
                </button>
              </form>
            </div>
          </div>
        ))
      )}
      <div className="note">
        Approving records an immutable, hash-chained audit entry and advances the application to
        <code> applied</code>. (External ATS submission is the jobboards.apply adapter — not yet wired.)
      </div>

      <h2>Pipeline</h2>
      <div>
        {pipeline.length === 0 ? (
          <span className="empty">No applications yet.</span>
        ) : (
          pipeline.map((p) => (
            <span className="pill" key={p.state}>
              {p.state}: {p.count}
            </span>
          ))
        )}
      </div>
    </main>
  );
}

function Card({ n, l }: { n: number; l: string }) {
  return (
    <div className="card">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}
