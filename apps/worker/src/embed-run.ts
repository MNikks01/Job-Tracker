import { childLogger, defaultProfile, loadProfileFromFile } from "@jobagent/shared";
import { createPgPool, PgEmbeddingRepository, PgJobRepository } from "@jobagent/db";
import { LocalHashEmbedder } from "@jobagent/embeddings";

/**
 * Semantic matching via pgvector (FR-201/202, ADR-001/007). Embeds every job, stores vectors,
 * computes a profile vector, then blends semantic similarity into the match score:
 *   blended = round(0.6 * ruleScore + 0.4 * (semantic * 100))
 * Uses the offline LocalHashEmbedder (no API key/cost) — swap for a real model later.
 *   DATABASE_URL=… PROFILE_FILE=$(pwd)/config/profile.json pnpm --filter @jobagent/worker embed:run
 */
const log = childLogger({ component: "embed-run" });
const RULE_W = 0.6;
const SEM_W = 0.4;

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const profile =
    (process.env.PROFILE_FILE && loadProfileFromFile(process.env.PROFILE_FILE)) || defaultProfile();

  const pool = createPgPool(dbUrl);
  const jobs = await new PgJobRepository(pool).list();
  const embRepo = new PgEmbeddingRepository(pool);
  const embedder = new LocalHashEmbedder(1536);

  // 1) Embed + store each job.
  log.info({ jobs: jobs.length }, "embedding jobs");
  const jobVecs = await embedder.embed(jobs.map((j) => `${j.title}\n${j.description ?? ""}`));
  for (let i = 0; i < jobs.length; i++) await embRepo.upsertJob(jobs[i]!.id, jobVecs[i]!);

  // 2) Profile vector (skills + target titles + headline).
  const profileText = [profile.headline, profile.targetTitles.join(" "), profile.skills.join(" ")].join("\n");
  const [profileVec] = await embedder.embed([profileText]);

  // 3) Top semantic-only matches (pure pgvector ANN search).
  const top = await embRepo.searchSimilar(profileVec!, 10);
  const titleById = new Map(jobs.map((j) => [j.id, `${j.title} (${j.company})`]));
  console.log(`\n=== Top semantic matches (pgvector cosine, ${await embRepo.count()} vectors) ===`);
  top.forEach((m, i) =>
    console.log(`${String(i + 1).padStart(2)}. sim ${m.similarity.toFixed(3)}  ${titleById.get(m.jobId)}`),
  );

  // 4) Record semantic similarity into the match rows.
  //
  // NOTE (honesty): the LocalHashEmbedder is a *lexical* placeholder — its cosines are
  // tiny/uncalibrated (~0.03 for related text vs ~0.6 for a real model). Blending those into
  // the primary score would deflate the reliable rule-based ranking, so we keep `score` = rule
  // and store `subscores.semantic` for transparency. Set EMBED_BLEND=1 only once a real
  // embedding model is configured (then blended = RULE_W·rule + SEM_W·semantic·100).
  const blend = process.env.EMBED_BLEND === "1";
  let updated = 0;
  for (const job of jobs) {
    const sim = await embRepo.similarityForJob(job.id, profileVec!);
    if (sim == null) continue;
    const cur = await pool.query<{ score: number; rule_sub: string | null }>(
      `SELECT score, subscores->>'rule' AS rule_sub FROM match WHERE job_id = $1`,
      [job.id],
    );
    if (cur.rows.length === 0) continue;
    // Recover the original rule score (it may have been overwritten by a prior blended run).
    const rule = cur.rows[0]!.rule_sub != null ? Number(cur.rows[0]!.rule_sub) : Number(cur.rows[0]!.score);
    const score = blend ? Math.round(RULE_W * rule + SEM_W * sim * 100) : rule;
    await pool.query(
      `UPDATE match
          SET subscores = jsonb_set(jsonb_set(COALESCE(subscores,'{}'::jsonb),
                          '{rule}', to_jsonb($2::int)), '{semantic}', to_jsonb($3::numeric)),
              score = $4
        WHERE job_id = $1`,
      [job.id, rule, Number(sim.toFixed(4)), score],
    );
    updated += 1;
  }
  console.log(
    `\nRecorded semantic similarity into ${updated} match rows. ` +
      (blend
        ? `Primary score BLENDED (${RULE_W}·rule + ${SEM_W}·semantic).`
        : `Primary score = rule (semantic stored only; local-hash cosines uncalibrated — set EMBED_BLEND=1 with a real embedder).`),
  );
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "embed:run failed");
  process.exit(1);
});
