import {
  childLogger,
  defaultProfile,
  loadConfigFromEnv,
  loadProfileFromFile,
} from "@jobagent/shared";
import { BudgetGuard } from "@jobagent/core";
import {
  createPgPool,
  PgApplicationRepository,
  PgApprovalRepository,
  PgEventRepository,
  PgMatchRepository,
  PgMaterialRepository,
} from "@jobagent/db";
import { DEFAULT_PRICING, LlmClient } from "@jobagent/llm";
import {
  coverLetterToText,
  prepareMaterials,
  resumeToText,
} from "@jobagent/materials";

/**
 * For the top matched jobs: generate grounded résumé + cover letter, run the Critic, persist
 * materials, and gate the approval queue on honesty (FR-302/303/304):
 *   - Critic PASS  → material saved, application → pending_approval, approval opened
 *   - Critic BLOCK → material saved, application → needs_manual (NOT queued)
 * Live LLM step — requires ANTHROPIC_API_KEY + credits + DATABASE_URL.
 */
const log = childLogger({ component: "materials-prepare" });

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const topN = Number(process.env.QUEUE_TOP ?? "3");

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
  const matches = new PgMatchRepository(pool);
  const apps = new PgApplicationRepository(pool);
  const approvals = new PgApprovalRepository(pool);
  const materials = new PgMaterialRepository(pool);
  const events = new PgEventRepository(pool);

  for (const job of await matches.topMatchedJobs(topN)) {
    const app = await apps.ensureForJob(job);
    if (app.state !== "materials_drafted") {
      log.info({ app: app.id, state: app.state }, "skip (already processed)");
      continue;
    }
    const jobInput = {
      title: job.title,
      company: job.company,
      location: job.location ?? undefined,
      description: job.description ?? undefined,
    };

    const prep = await prepareMaterials(llm, jobInput, profile, models);
    await materials.saveVersion({ applicationId: app.id, kind: "resume", content: resumeToText(prep.resume), claims: prep.resume.claims });
    await materials.saveVersion({ applicationId: app.id, kind: "cover_letter", content: coverLetterToText(prep.cover), claims: prep.cover.claims });
    await events.append({
      type: "materials.critiqued",
      actor: "system",
      payload: {
        applicationId: app.id,
        resumePass: prep.resumeVerdict.pass,
        coverPass: prep.coverVerdict.pass,
        blocked: prep.blocked,
        issues: [...prep.resumeVerdict.issues, ...prep.coverVerdict.issues],
      },
    });

    if (prep.blocked) {
      await apps.transition(app.id, "needs_manual");
      log.warn({ app: app.id, job: job.title }, "BLOCKED by Critic → needs_manual (not queued)");
    } else {
      await apps.transition(app.id, "pending_approval");
      await approvals.ensurePending("apply", app.id);
      log.info({ app: app.id, job: job.title }, "materials passed Critic → queued for approval");
    }
  }

  console.log(`\nLLM spend this run: $${budget.spent.toFixed(4)} (cap $${cfg.budgets.monthlyUsdCap})`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "materials:prepare failed");
  process.exit(1);
});
