import { childLogger, defaultProfile, loadProfileFromFile } from "@jobagent/shared";
import { createPgPool, PgJobRepository, PgMatchRepository } from "@jobagent/db";
import { scoreJob } from "@jobagent/matching";

/**
 * Score every stored job against the master profile and persist matches, then print the
 * top N (FR-201..204). Run:
 *   DATABASE_URL=... PROFILE_FILE=$(pwd)/config/profile.json \
 *   pnpm --filter @jobagent/worker match:run
 */
const log = childLogger({ component: "match-run" });

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const profile = (process.env.PROFILE_FILE && loadProfileFromFile(process.env.PROFILE_FILE)) || defaultProfile();

  const pool = createPgPool(dbUrl);
  const jobs = await new PgJobRepository(pool).list();
  const matchRepo = new PgMatchRepository(pool);
  log.info({ jobs: jobs.length, profile: profile.fullName }, "scoring jobs");

  let scored = 0;
  for (const job of jobs) {
    const r = scoreJob(job, profile);
    await matchRepo.save({
      jobId: job.id,
      score: r.score,
      confidence: r.confidence,
      subscores: r.subscores,
      rationale: r.rationale,
    });
    scored += 1;
  }

  const top = await matchRepo.topMatches(10);
  log.info({ scored }, "scoring complete — top matches:");
  // Human-readable ranked list (this is the demo payoff).
  console.log("\n=== Top matches for", profile.fullName, "===");
  top.forEach((m, i) => {
    console.log(
      `${String(i + 1).padStart(2)}. [${String(m.score).padStart(3)}|conf ${m.confidence}] ${m.title}  (${m.company}${m.location ? ", " + m.location : ""})`,
    );
    console.log(`     ${m.rationale}`);
  });

  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "match:run failed");
  process.exit(1);
});
