import Link from "next/link";
import { notFound } from "next/navigation";
import { getApplicationDetail } from "../../db";

export const dynamic = "force-dynamic";

export default async function ApplicationDetail({ params }: { params: { id: string } }) {
  const a = await getApplicationDetail(params.id);
  if (!a) notFound();

  const sem = a.subscores?.semantic;
  const resume = a.materials.find((m) => m.kind === "resume");
  const cover = a.materials.find((m) => m.kind === "cover_letter");

  return (
    <main className="wrap">
      <header className="top">
        <Link href="/">← Queue</Link>
        <h1 style={{ marginLeft: 8 }}>{a.title}</h1>
        <span className="sub">
          {a.company}
          {a.location ? ` · ${a.location}` : ""}
        </span>
      </header>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <span className="pill">state: {a.state}</span>
        {a.score != null ? <span className="score">match {a.score}</span> : null}
        {a.confidence != null ? <span className="pill">conf {a.confidence}</span> : null}
        {sem != null ? <span className="pill">semantic {String(sem)}</span> : null}
        {a.pendingApprovalId ? (
          <form action="/api/approve" method="post" style={{ marginLeft: "auto" }}>
            <input type="hidden" name="approvalId" value={a.pendingApprovalId} />
            <button className="approve" type="submit">Approve ✓</button>
          </form>
        ) : null}
      </div>

      {a.rationale ? (
        <>
          <h2>Why this match</h2>
          <div className="item">
            <div className="why" style={{ margin: 0 }}>{a.rationale}</div>
          </div>
        </>
      ) : null}

      <h2>Critic verdict</h2>
      {a.critic ? (
        <div className="item" style={{ display: "block" }}>
          <div>
            {a.critic.blocked ? (
              <strong style={{ color: "var(--amber)" }}>BLOCKED ❌ (fabrication/unsupported)</strong>
            ) : (
              <strong style={{ color: "var(--green)" }}>PASS ✅ (résumé {a.critic.resumePass ? "✓" : "✗"}, cover {a.critic.coverPass ? "✓" : "✗"})</strong>
            )}
          </div>
          {a.critic.issues.length > 0 ? (
            <ul>
              {a.critic.issues.map((i, idx) => (
                <li key={idx} className="why">
                  [{i.severity}] {i.claim} — {i.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="empty">No Critic verdict yet (materials not generated — needs Anthropic credits).</div>
      )}

      <h2>Tailored résumé</h2>
      <MaterialBlock content={resume?.content} claims={resume?.claims} />
      <h2>Cover letter</h2>
      <MaterialBlock content={cover?.content} claims={cover?.claims} />

      <h2>Audit trail</h2>
      {a.audit.length === 0 ? (
        <div className="empty">No outward actions recorded yet.</div>
      ) : (
        a.audit.map((e) => (
          <div className="item" key={e.id}>
            <div>
              <div className="title">{e.action}</div>
              <div className="meta">
                #{e.id} · {e.actor} · {new Date(e.occurredAt).toLocaleString()}
              </div>
            </div>
            <code style={{ color: "var(--muted)", fontSize: 12 }}>{e.entryHash.slice(0, 16)}…</code>
          </div>
        ))
      )}
    </main>
  );
}

function MaterialBlock({ content, claims }: { content?: string; claims?: { text: string; evidence: string }[] }) {
  if (!content) return <div className="empty">Not generated yet.</div>;
  return (
    <div className="item" style={{ display: "block" }}>
      <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{content}</pre>
      {claims && claims.length > 0 ? (
        <>
          <div className="meta" style={{ marginTop: 10 }}>Grounding (claim → profile evidence):</div>
          <ul>
            {claims.map((c, i) => (
              <li key={i} className="why">
                {c.text} <span style={{ color: "var(--muted)" }}>← {c.evidence}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
