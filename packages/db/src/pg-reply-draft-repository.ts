import type { Pool } from "pg";

export interface ReplyDraftInput {
  sourceGmailId: string;
  threadId: string;
  fromAddr: string; // recruiter (who we reply to)
  toAddr: string; // normalized recruiter email
  recruiterSubject: string;
  label: string;
  subject: string; // our reply subject
  body: string;
  proposedSlots: string[];
}

export interface ReplyDraftRecord extends ReplyDraftInput {
  id: string;
  status: string;
  createdAt: string;
}

/** Persisted recruiter-reply drafts (FR-604) — the dashboard's inbox/replies queue. */
export class PgReplyDraftRepository {
  constructor(private readonly pool: Pool) {}

  /** Idempotent per source message — re-running refreshes the draft text/slots. */
  async upsert(d: ReplyDraftInput): Promise<{ id: string; created: boolean }> {
    const { rows } = await this.pool.query(
      `INSERT INTO reply_draft (source_gmail_id, thread_id, from_addr, to_addr, recruiter_subject, label, subject, body, proposed_slots)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (source_gmail_id) DO UPDATE SET
         subject = EXCLUDED.subject, body = EXCLUDED.body, proposed_slots = EXCLUDED.proposed_slots,
         label = EXCLUDED.label
         WHERE reply_draft.status = 'pending'
       RETURNING id, (xmax = 0) AS created`,
      [d.sourceGmailId, d.threadId, d.fromAddr, d.toAddr, d.recruiterSubject, d.label, d.subject, d.body, JSON.stringify(d.proposedSlots)],
    );
    return { id: String(rows[0]?.id ?? ""), created: !!rows[0]?.created };
  }

  async listPending(): Promise<ReplyDraftRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM reply_draft WHERE status = 'pending' ORDER BY created_at DESC`,
    );
    return rows.map((r) => this.map(r));
  }

  async get(id: string): Promise<ReplyDraftRecord | null> {
    const { rows } = await this.pool.query(`SELECT * FROM reply_draft WHERE id = $1`, [id]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async markSent(id: string, sentGmailId: string): Promise<void> {
    await this.pool.query(
      `UPDATE reply_draft SET status = 'sent', sent_gmail_id = $2, decided_at = now() WHERE id = $1`,
      [id, sentGmailId],
    );
  }

  async markRejected(id: string): Promise<void> {
    await this.pool.query(`UPDATE reply_draft SET status = 'rejected', decided_at = now() WHERE id = $1`, [id]);
  }

  private map(r: Record<string, unknown>): ReplyDraftRecord {
    return {
      id: String(r.id),
      sourceGmailId: String(r.source_gmail_id),
      threadId: String(r.thread_id),
      fromAddr: String(r.from_addr),
      toAddr: String(r.to_addr),
      recruiterSubject: String(r.recruiter_subject ?? ""),
      label: String(r.label),
      subject: String(r.subject),
      body: String(r.body),
      proposedSlots: Array.isArray(r.proposed_slots) ? (r.proposed_slots as string[]) : [],
      status: String(r.status),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
  }
}
