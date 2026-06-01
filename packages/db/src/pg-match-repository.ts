import type { Pool } from "pg";

export interface MatchRow {
  jobId: string;
  score: number;
  confidence: number;
  subscores: unknown;
  rationale: string;
}

export interface RankedMatch {
  title: string;
  company: string;
  location: string | null;
  score: number;
  confidence: number;
  rationale: string;
}

/**
 * Persists match results to the `match` table (one per job) and flips the job to
 * status='matched'. Upsert keeps re-scoring idempotent.
 */
export class PgMatchRepository {
  constructor(private readonly pool: Pool) {}

  async save(m: MatchRow): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO match (job_id, score, subscores, confidence, rationale)
           VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (job_id) DO UPDATE SET
           score = EXCLUDED.score,
           subscores = EXCLUDED.subscores,
           confidence = EXCLUDED.confidence,
           rationale = EXCLUDED.rationale,
           created_at = now()`,
        [m.jobId, m.score, JSON.stringify(m.subscores), m.confidence, m.rationale],
      );
      await client.query(`UPDATE job SET status = 'matched', updated_at = now() WHERE id = $1`, [
        m.jobId,
      ]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /** Top matched jobs with full description — used by materials generation. */
  async topMatchedJobs(
    limit = 5,
  ): Promise<
    { id: string; title: string; company: string; location: string | null; description: string | null; score: number }[]
  > {
    const { rows } = await this.pool.query(
      `SELECT j.id, j.title, j.company, j.location, j.description, m.score
         FROM match m JOIN job j ON j.id = m.job_id
        ORDER BY m.score DESC, m.confidence DESC
        LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      company: String(r.company),
      location: (r.location as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      score: Number(r.score),
    }));
  }

  async topMatches(limit = 10): Promise<RankedMatch[]> {
    const { rows } = await this.pool.query(
      `SELECT j.title, j.company, j.location, m.score, m.confidence, m.rationale
         FROM match m JOIN job j ON j.id = m.job_id
        ORDER BY m.score DESC, m.confidence DESC
        LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      title: String(r.title),
      company: String(r.company),
      location: (r.location as string | null) ?? null,
      score: Number(r.score),
      confidence: Number(r.confidence),
      rationale: String(r.rationale),
    }));
  }
}
