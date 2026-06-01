import {
  childLogger,
  defaultProfile,
  loadConfigFromEnv,
  loadProfileFromFile,
} from "@jobagent/shared";
import { BudgetGuard } from "@jobagent/core";
import { createPgPool, PgMatchRepository } from "@jobagent/db";
import { DEFAULT_PRICING, LlmClient } from "@jobagent/llm";
import {
  coverLetterToText,
  critiqueMaterial,
  generateCoverLetter,
  generateResume,
  resumeToText,
} from "@jobagent/materials";

/**
 * Generate + critique tailored materials for the top matched job (FR-302/303/304).
 * Live LLM call — requires ANTHROPIC_API_KEY + DATABASE_URL.
 *   DATABASE_URL=... PROFILE_FILE=$(pwd)/config/profile.json \
 *   pnpm --filter @jobagent/worker tailor:run
 */
const log = childLogger({ component: "tailor-run" });

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");

  const cfg = loadConfigFromEnv();
  const profile =
    (process.env.PROFILE_FILE && loadProfileFromFile(process.env.PROFILE_FILE)) || defaultProfile();

  const budget = new BudgetGuard({
    monthlyUsdCap: cfg.budgets.monthlyUsdCap,
    alertAtPct: cfg.budgets.alertAtPct,
    pricing: DEFAULT_PRICING,
    onAlert: (i) => log.warn(i, "budget threshold reached"),
  });
  const llm = new LlmClient(budget);
  const models = { reasoning: cfg.models.reasoning };

  const pool = createPgPool(dbUrl);
  const top = await new PgMatchRepository(pool).topMatchedJobs(1);
  if (top.length === 0) {
    log.warn("no matched jobs — run match:run first");
    await pool.end();
    return;
  }
  const row = top[0]!;
  const job = {
    title: row.title,
    company: row.company,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
  };
  log.info({ job: job.title, company: job.company, score: row.score }, "tailoring for top match");

  // 1) Generate tailored resume + cover letter (grounded).
  const resume = await generateResume(llm, job, profile, models);
  const cover = await generateCoverLetter(llm, job, profile, models);

  // 2) Critic / anti-fabrication gate on each.
  const resumeVerdict = await critiqueMaterial(
    llm,
    { kind: "resume", text: resumeToText(resume), claims: resume.claims },
    profile,
    models,
  );
  const coverVerdict = await critiqueMaterial(
    llm,
    { kind: "cover_letter", text: coverLetterToText(cover), claims: cover.claims },
    profile,
    models,
  );

  // 3) Report.
  console.log(`\n========== TAILORED RESUME — ${job.title} @ ${job.company} (match ${row.score}) ==========`);
  console.log(resumeToText(resume));
  console.log(`\n--- Critic (resume): ${resumeVerdict.pass ? "PASS ✅" : "BLOCKED ❌"} ---`);
  resumeVerdict.issues.forEach((i) => console.log(`  [${i.severity}] ${i.claim} — ${i.reason}`));

  console.log(`\n================ COVER LETTER ================`);
  console.log(coverLetterToText(cover));
  console.log(`\n--- Critic (cover): ${coverVerdict.pass ? "PASS ✅" : "BLOCKED ❌"} ---`);
  coverVerdict.issues.forEach((i) => console.log(`  [${i.severity}] ${i.claim} — ${i.reason}`));

  console.log(`\nLLM spend this run: $${budget.spent.toFixed(4)} (cap $${cfg.budgets.monthlyUsdCap})`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "tailor:run failed");
  process.exit(1);
});
