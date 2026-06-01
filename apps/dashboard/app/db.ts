import { createPgPool, type Pool } from "@jobagent/db";

let pool: Pool | undefined;
export function db(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = createPgPool(url);
  }
  return pool;
}

export interface Stats {
  jobs: number;
  matched: number;
  pendingApprovals: number;
  applied: number;
  needsManual: number;
  auditEntries: number;
  pendingReplies: number;
}

export async function getStats(): Promise<Stats> {
  const q = async (sql: string) => Number((await db().query<{ n: string }>(sql)).rows[0]?.n ?? 0);
  const [jobs, matched, pendingApprovals, applied, needsManual, auditEntries, pendingReplies] = await Promise.all([
    q(`SELECT count(*)::text n FROM job`),
    q(`SELECT count(*)::text n FROM match`),
    q(`SELECT count(*)::text n FROM approval WHERE status='pending'`),
    q(`SELECT count(*)::text n FROM application WHERE state='applied'`),
    q(`SELECT count(*)::text n FROM application WHERE state='needs_manual'`),
    q(`SELECT count(*)::text n FROM audit_log`),
    q(`SELECT count(*)::text n FROM reply_draft WHERE status='pending'`),
  ]);
  return { jobs, matched, pendingApprovals, applied, needsManual, auditEntries, pendingReplies };
}

export interface ReplyDraftView {
  id: string;
  fromAddr: string;
  toAddr: string;
  recruiterSubject: string | null;
  label: string;
  subject: string;
  body: string;
  proposedSlots: string[];
  threadId: string;
  sourceGmailId: string;
  createdAt: string;
}

export async function getReplyDrafts(): Promise<ReplyDraftView[]> {
  const { rows } = await db().query<{
    id: string;
    from_addr: string;
    to_addr: string;
    recruiter_subject: string | null;
    label: string;
    subject: string;
    body: string;
    proposed_slots: string[];
    thread_id: string;
    source_gmail_id: string;
    created_at: Date;
  }>(
    `SELECT id, from_addr, to_addr, recruiter_subject, label, subject, body,
            proposed_slots, thread_id, source_gmail_id, created_at
       FROM reply_draft WHERE status = 'pending' ORDER BY created_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    fromAddr: r.from_addr,
    toAddr: r.to_addr,
    recruiterSubject: r.recruiter_subject,
    label: r.label,
    subject: r.subject,
    body: r.body,
    proposedSlots: Array.isArray(r.proposed_slots) ? r.proposed_slots : [],
    threadId: r.thread_id,
    sourceGmailId: r.source_gmail_id,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export interface QueueRow {
  approvalId: string;
  appId: string;
  title: string;
  company: string;
  location: string | null;
  score: number | null;
  rationale: string | null;
}

export async function getQueue(): Promise<QueueRow[]> {
  const { rows } = await db().query(
    `SELECT ap.id AS approval_id, a.id AS app_id, j.title, j.company, j.location,
            m.score, m.rationale
       FROM approval ap
       JOIN application a ON a.id = ap.application_id
       JOIN job j ON j.id = a.job_id
       LEFT JOIN match m ON m.job_id = j.id
      WHERE ap.status = 'pending'
      ORDER BY m.score DESC NULLS LAST, ap.created_at ASC`,
  );
  return rows.map((r) => ({
    approvalId: String(r.approval_id),
    appId: String(r.app_id),
    title: String(r.title),
    company: String(r.company),
    location: (r.location as string | null) ?? null,
    score: r.score == null ? null : Number(r.score),
    rationale: (r.rationale as string | null) ?? null,
  }));
}

export interface Claim {
  text: string;
  evidence: string;
}
export interface MaterialView {
  kind: string;
  content: string;
  claims: Claim[];
}
export interface CriticView {
  resumePass: boolean;
  coverPass: boolean;
  blocked: boolean;
  issues: { claim: string; reason: string; severity: string }[];
}
export interface AuditView {
  id: string;
  action: string;
  actor: string;
  occurredAt: string;
  entryHash: string;
}
export interface AppDetail {
  id: string;
  state: string;
  title: string;
  company: string;
  location: string | null;
  score: number | null;
  confidence: number | null;
  rationale: string | null;
  subscores: Record<string, unknown> | null;
  materials: MaterialView[];
  critic: CriticView | null;
  audit: AuditView[];
  pendingApprovalId: string | null;
}

export async function getApplicationDetail(id: string): Promise<AppDetail | null> {
  const head = await db().query(
    `SELECT a.id, a.state, j.title, j.company, j.location,
            m.score, m.confidence, m.rationale, m.subscores
       FROM application a JOIN job j ON j.id = a.job_id
       LEFT JOIN match m ON m.job_id = j.id
      WHERE a.id = $1`,
    [id],
  );
  if (head.rows.length === 0) return null;
  const h = head.rows[0];

  const [mats, crit, aud, pend] = await Promise.all([
    db().query(`SELECT kind, content, claims FROM material WHERE application_id = $1 AND is_current = true ORDER BY kind`, [id]),
    db().query(`SELECT payload FROM domain_event WHERE type = 'materials.critiqued' AND payload->>'applicationId' = $1 ORDER BY occurred_at DESC LIMIT 1`, [id]),
    db().query(`SELECT al.id, al.action, al.actor, al.occurred_at, al.entry_hash
                  FROM audit_log al JOIN approval ap ON ap.id = al.approval_id
                 WHERE ap.application_id = $1 ORDER BY al.id ASC`, [id]),
    db().query(`SELECT id FROM approval WHERE application_id = $1 AND status = 'pending' LIMIT 1`, [id]),
  ]);

  const criticPayload = crit.rows[0]?.payload as
    | { resumePass?: boolean; coverPass?: boolean; blocked?: boolean; issues?: CriticView["issues"] }
    | undefined;

  return {
    id: String(h.id),
    state: String(h.state),
    title: String(h.title),
    company: String(h.company),
    location: (h.location as string | null) ?? null,
    score: h.score == null ? null : Number(h.score),
    confidence: h.confidence == null ? null : Number(h.confidence),
    rationale: (h.rationale as string | null) ?? null,
    subscores: (h.subscores as Record<string, unknown> | null) ?? null,
    materials: mats.rows.map((r) => ({
      kind: String(r.kind),
      content: String(r.content),
      claims: Array.isArray(r.claims) ? (r.claims as Claim[]) : [],
    })),
    critic: criticPayload
      ? {
          resumePass: !!criticPayload.resumePass,
          coverPass: !!criticPayload.coverPass,
          blocked: !!criticPayload.blocked,
          issues: criticPayload.issues ?? [],
        }
      : null,
    audit: aud.rows.map((r) => ({
      id: String(r.id),
      action: String(r.action),
      actor: String(r.actor),
      occurredAt: r.occurred_at instanceof Date ? r.occurred_at.toISOString() : String(r.occurred_at),
      entryHash: String(r.entry_hash),
    })),
    pendingApprovalId: pend.rows[0] ? String(pend.rows[0].id) : null,
  };
}

export interface PipelineRow {
  state: string;
  count: number;
}
export async function getPipeline(): Promise<PipelineRow[]> {
  const { rows } = await db().query(
    `SELECT state, count(*)::text n FROM application GROUP BY state ORDER BY count(*) DESC`,
  );
  return rows.map((r) => ({ state: String(r.state), count: Number(r.n) }));
}
