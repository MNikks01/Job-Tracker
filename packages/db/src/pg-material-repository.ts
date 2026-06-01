import type { Pool } from "pg";

export interface MaterialInput {
  applicationId: string;
  kind: "resume" | "cover_letter";
  content: string;
  fileRef?: string;
  claims: { text: string; evidence: string }[];
}

/** Versioned material storage (FR-305). New versions supersede the prior current one. */
export class PgMaterialRepository {
  constructor(private readonly pool: Pool) {}

  /** Current version of a material kind for an application, or null if none yet. */
  async getCurrent(
    applicationId: string,
    kind: "resume" | "cover_letter",
  ): Promise<{ content: string } | null> {
    const { rows } = await this.pool.query<{ content: string }>(
      `SELECT content FROM material
        WHERE application_id = $1 AND kind = $2 AND is_current = true LIMIT 1`,
      [applicationId, kind],
    );
    return rows[0] ? { content: rows[0].content } : null;
  }

  async saveVersion(m: MaterialInput): Promise<{ id: string; version: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const v = await client.query<{ next: string }>(
        `SELECT COALESCE(MAX(version),0)+1 AS next FROM material
          WHERE application_id = $1 AND kind = $2`,
        [m.applicationId, m.kind],
      );
      const version = Number(v.rows[0]?.next ?? 1);
      await client.query(
        `UPDATE material SET is_current = false WHERE application_id = $1 AND kind = $2`,
        [m.applicationId, m.kind],
      );
      const { rows } = await client.query(
        `INSERT INTO material (application_id, kind, version, is_current, content, file_ref, claims)
           VALUES ($1,$2,$3,true,$4,$5,$6) RETURNING id`,
        [m.applicationId, m.kind, version, m.content, m.fileRef ?? null, JSON.stringify(m.claims)],
      );
      await client.query("COMMIT");
      return { id: String(rows[0].id), version };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
