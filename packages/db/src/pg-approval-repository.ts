import type { Pool } from "pg";
import type { ApprovalAction, ApprovalStatus } from "@jobagent/core";

export interface ApprovalRecord {
  id: string;
  action: ApprovalAction;
  applicationId: string | null;
  status: ApprovalStatus;
  expiresAt: string;
}

/** Persists HITL approvals (the gate between draft and outward action). */
export class PgApprovalRepository {
  constructor(private readonly pool: Pool) {}

  /** Create a pending approval for an application action (idempotent per app+action). */
  async ensurePending(
    action: ApprovalAction,
    applicationId: string,
    ttlMs = 1000 * 60 * 60 * 24,
  ): Promise<ApprovalRecord> {
    // Reuse an existing pending approval if one is already open for this app+action.
    const existing = await this.pool.query(
      `SELECT id, action, application_id, status, expires_at FROM approval
        WHERE application_id = $1 AND action = $2 AND status = 'pending' LIMIT 1`,
      [applicationId, action],
    );
    if (existing.rows[0]) return this.map(existing.rows[0]);

    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO approval (action, application_id, status, expires_at)
         VALUES ($1, $2, 'pending', $3)
       RETURNING id, action, application_id, status, expires_at`,
      [action, applicationId, expiresAt],
    );
    return this.map(rows[0]);
  }

  async listPending(): Promise<ApprovalRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, action, application_id, status, expires_at FROM approval
        WHERE status = 'pending' ORDER BY created_at ASC`,
    );
    return rows.map((r) => this.map(r));
  }

  async resolve(
    id: string,
    decision: "granted" | "rejected",
    decidedBy: string,
  ): Promise<ApprovalRecord> {
    const { rows } = await this.pool.query(
      `UPDATE approval SET status = $2, decided_by = $3, decided_at = now()
        WHERE id = $1 AND status = 'pending'
       RETURNING id, action, application_id, status, expires_at`,
      [id, decision, decidedBy],
    );
    if (!rows[0]) throw new Error(`approval not pending or not found: ${id}`);
    return this.map(rows[0]);
  }

  private map(r: Record<string, unknown>): ApprovalRecord {
    return {
      id: String(r.id),
      action: r.action as ApprovalAction,
      applicationId: (r.application_id as string | null) ?? null,
      status: r.status as ApprovalStatus,
      expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : String(r.expires_at),
    };
  }
}
