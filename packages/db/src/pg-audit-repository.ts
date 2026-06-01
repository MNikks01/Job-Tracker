import type { Pool } from "pg";
import { sha256 } from "@jobagent/shared";
import { stableStringify } from "@jobagent/core";

const GENESIS = "0".repeat(64);

export interface AuditAppend {
  actor: string;
  action: string;
  opportunityId?: string;
  approvalId?: string;
  payload: unknown;
}

/**
 * Append-only, hash-chained audit log in Postgres (NFR-10). entry_hash chains each row to
 * the previous; verifyChain() recomputes the whole chain to detect tampering. Only metadata
 * + payload *hashes* are stored — never sensitive plaintext.
 */
export class PgAuditRepository {
  constructor(private readonly pool: Pool) {}

  async append(input: AuditAppend): Promise<{ id: string; entryHash: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const prev = await client.query<{ entry_hash: string }>(
        `SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      );
      const prevHash = prev.rows[0]?.entry_hash ?? GENESIS;
      const occurredAt = new Date().toISOString();
      const payloadHash = sha256(stableStringify(input.payload));
      const entryHash = sha256(
        [prevHash, payloadHash, input.actor, input.action, occurredAt].join("|"),
      );
      const { rows } = await client.query(
        `INSERT INTO audit_log (occurred_at, actor, action, opportunity_id, approval_id, payload_hash, prev_hash, entry_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          occurredAt,
          input.actor,
          input.action,
          input.opportunityId ?? null,
          input.approvalId ?? null,
          payloadHash,
          prevHash,
          entryHash,
        ],
      );
      await client.query("COMMIT");
      return { id: String(rows[0].id), entryHash };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /** Recompute the whole chain. Returns the first tampered row id, or null if intact. */
  async verifyChain(): Promise<{ ok: true; count: number } | { ok: false; brokenAtId: string }> {
    const { rows } = await this.pool.query(
      `SELECT id, occurred_at, actor, action, payload_hash, prev_hash, entry_hash
         FROM audit_log ORDER BY id ASC`,
    );
    let prevHash = GENESIS;
    for (const r of rows) {
      const occurredAt = r.occurred_at instanceof Date ? r.occurred_at.toISOString() : String(r.occurred_at);
      const expected = sha256([prevHash, r.payload_hash, r.actor, r.action, occurredAt].join("|"));
      if (r.prev_hash !== prevHash || r.entry_hash !== expected) {
        return { ok: false, brokenAtId: String(r.id) };
      }
      prevHash = r.entry_hash;
    }
    return { ok: true, count: rows.length };
  }
}
