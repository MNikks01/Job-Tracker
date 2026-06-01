import type { Pool } from "pg";
import { assertTransition } from "@jobagent/core";
import { normalizeText, type ApplicationState } from "@jobagent/shared";

export interface ApplicationRecord {
  id: string;
  jobId: string;
  state: ApplicationState;
  normalizedRole: string;
  companyKey: string;
}

/**
 * Applications + their lifecycle (FR-401/404/501). Enforces:
 *  - the state machine on every transition,
 *  - one application per (company, role) via the DB unique constraint (no double-apply).
 */
export class PgApplicationRepository {
  constructor(private readonly pool: Pool) {}

  /** Create (or fetch existing) application for a job in `materials_drafted`. Idempotent. */
  async ensureForJob(job: { id: string; title: string; company: string }): Promise<ApplicationRecord> {
    const normalizedRole = normalizeText(job.title);
    const companyKey = normalizeText(job.company);
    const { rows } = await this.pool.query(
      `INSERT INTO application (job_id, state, normalized_role, company_key)
         VALUES ($1, 'materials_drafted', $2, $3)
       ON CONFLICT (company_key, normalized_role) DO UPDATE SET updated_at = now()
       RETURNING id, job_id, state, normalized_role, company_key`,
      [job.id, normalizedRole, companyKey],
    );
    return this.map(rows[0]);
  }

  async get(id: string): Promise<ApplicationRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, job_id, state, normalized_role, company_key FROM application WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.map(rows[0]) : null;
  }

  /** Validated transition (throws GuardrailError on an illegal move). */
  async transition(id: string, to: ApplicationState): Promise<ApplicationRecord> {
    const current = await this.get(id);
    if (!current) throw new Error(`application not found: ${id}`);
    assertTransition(current.state, to);
    const { rows } = await this.pool.query(
      `UPDATE application SET state = $2, updated_at = now(),
         submitted_at = CASE WHEN $2 = 'applied' THEN now() ELSE submitted_at END
       WHERE id = $1
       RETURNING id, job_id, state, normalized_role, company_key`,
      [id, to],
    );
    return this.map(rows[0]);
  }

  async listByState(state: ApplicationState): Promise<ApplicationRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, job_id, state, normalized_role, company_key FROM application
        WHERE state = $1 ORDER BY updated_at DESC`,
      [state],
    );
    return rows.map((r) => this.map(r));
  }

  private map(r: Record<string, unknown>): ApplicationRecord {
    return {
      id: String(r.id),
      jobId: String(r.job_id),
      state: r.state as ApplicationState,
      normalizedRole: String(r.normalized_role),
      companyKey: String(r.company_key),
    };
  }
}
