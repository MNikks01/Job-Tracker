import type { Pool } from "pg";

export interface DomainEventInput {
  type: string;
  opportunityId?: string;
  actor: string;
  payload: unknown;
  traceId?: string;
}

/** Persisted domain event stream (event-flow.md) — audit + replay + analytics. */
export class PgEventRepository {
  constructor(private readonly pool: Pool) {}

  async append(e: DomainEventInput): Promise<string> {
    const { rows } = await this.pool.query(
      `INSERT INTO domain_event (type, opportunity_id, actor, payload, trace_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [e.type, e.opportunityId ?? null, e.actor, JSON.stringify(e.payload), e.traceId ?? null],
    );
    return String(rows[0].id);
  }
}
