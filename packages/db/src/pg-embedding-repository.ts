import type { Pool } from "pg";
import { toPgVector } from "@jobagent/embeddings";

export interface SimilarJob {
  jobId: string;
  similarity: number; // cosine, 1 = identical
}

/**
 * pgvector-backed embedding store + ANN search (ADR-001). Vectors are passed as text and
 * cast to `vector`; cosine distance uses the `<=>` operator (similarity = 1 - distance).
 */
export class PgEmbeddingRepository {
  constructor(private readonly pool: Pool) {}

  async upsertJob(jobId: string, vec: number[]): Promise<void> {
    await this.pool.query(
      `INSERT INTO job_embedding (job_id, embedding) VALUES ($1, $2::vector)
       ON CONFLICT (job_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [jobId, toPgVector(vec)],
    );
  }

  async searchSimilar(queryVec: number[], limit = 10): Promise<SimilarJob[]> {
    const { rows } = await this.pool.query(
      `SELECT job_id, 1 - (embedding <=> $1::vector) AS similarity
         FROM job_embedding
        ORDER BY embedding <=> $1::vector
        LIMIT $2`,
      [toPgVector(queryVec), limit],
    );
    return rows.map((r) => ({ jobId: String(r.job_id), similarity: Number(r.similarity) }));
  }

  /** Cosine similarity of one job's stored embedding vs. a query vector (or null if unembedded). */
  async similarityForJob(jobId: string, queryVec: number[]): Promise<number | null> {
    const { rows } = await this.pool.query(
      `SELECT 1 - (embedding <=> $2::vector) AS similarity FROM job_embedding WHERE job_id = $1`,
      [jobId, toPgVector(queryVec)],
    );
    return rows[0] ? Number(rows[0].similarity) : null;
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>(`SELECT count(*)::text n FROM job_embedding`);
    return Number(rows[0]?.n ?? 0);
  }
}
