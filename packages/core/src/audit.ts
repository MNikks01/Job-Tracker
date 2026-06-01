import { sha256 } from "@jobagent/shared";

/**
 * AuditService (NFR-10): append-only, hash-chained audit log for every outward action.
 * entry_hash = sha256(prevHash | payloadHash | actor | action | occurredAt | seq).
 * Tampering with any entry breaks the chain → detectable by verifyChain().
 *
 * This in-memory implementation is the reference + test target; the Postgres-backed
 * `db.audit.append` MCP tool will persist the same structure (docs/database/schema.sql).
 */
export interface AuditEntry {
  seq: number;
  occurredAt: string;
  actor: string;
  action: string;
  opportunityId?: string;
  approvalId?: string;
  payloadHash: string;
  prevHash: string;
  entryHash: string;
}

export interface AuditInput {
  actor: string;
  action: string;
  opportunityId?: string;
  approvalId?: string;
  /** Arbitrary payload; only its hash is stored (no sensitive plaintext). */
  payload: unknown;
  occurredAt?: string;
}

const GENESIS = "0".repeat(64);

export function computeEntryHash(
  prevHash: string,
  payloadHash: string,
  actor: string,
  action: string,
  occurredAt: string,
  seq: number,
): string {
  return sha256([prevHash, payloadHash, actor, action, occurredAt, String(seq)].join("|"));
}

export class AuditLog {
  private entries: AuditEntry[] = [];

  append(input: AuditInput): AuditEntry {
    const seq = this.entries.length + 1;
    const prevHash = this.entries.at(-1)?.entryHash ?? GENESIS;
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const payloadHash = sha256(stableStringify(input.payload));
    const entryHash = computeEntryHash(
      prevHash,
      payloadHash,
      input.actor,
      input.action,
      occurredAt,
      seq,
    );
    const entry: AuditEntry = {
      seq,
      occurredAt,
      actor: input.actor,
      action: input.action,
      opportunityId: input.opportunityId,
      approvalId: input.approvalId,
      payloadHash,
      prevHash,
      entryHash,
    };
    this.entries.push(entry);
    return entry;
  }

  list(): readonly AuditEntry[] {
    return this.entries;
  }

  /** Verify the integrity of the whole chain. Returns the first broken seq, or null. */
  verifyChain(): { ok: true } | { ok: false; brokenAtSeq: number } {
    let prevHash = GENESIS;
    for (const e of this.entries) {
      const expected = computeEntryHash(
        prevHash,
        e.payloadHash,
        e.actor,
        e.action,
        e.occurredAt,
        e.seq,
      );
      if (e.prevHash !== prevHash || e.entryHash !== expected) {
        return { ok: false, brokenAtSeq: e.seq };
      }
      prevHash = e.entryHash;
    }
    return { ok: true };
  }
}

/** Deterministic JSON stringify (stable key order) so payload hashes are reproducible. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
