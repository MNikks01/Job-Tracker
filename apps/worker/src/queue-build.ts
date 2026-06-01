import { childLogger } from "@jobagent/shared";
import {
  createPgPool,
  PgApplicationRepository,
  PgApprovalRepository,
  PgMatchRepository,
} from "@jobagent/db";

/**
 * Build the HITL approval queue: for the top matched jobs, create an Application, move it to
 * pending_approval, and open a pending "apply" approval (FR-401). Idempotent.
 *   DATABASE_URL=… pnpm --filter @jobagent/worker queue:build
 */
const log = childLogger({ component: "queue-build" });

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const topN = Number(process.env.QUEUE_TOP ?? "3");

  const pool = createPgPool(dbUrl);
  const matches = new PgMatchRepository(pool);
  const apps = new PgApplicationRepository(pool);
  const approvals = new PgApprovalRepository(pool);

  const top = await matches.topMatchedJobs(topN);
  for (const job of top) {
    let app = await apps.ensureForJob(job);
    if (app.state === "materials_drafted") {
      app = await apps.transition(app.id, "pending_approval");
    }
    // Only open an approval for apps actually awaiting one — never re-open for applied jobs.
    if (app.state === "pending_approval") {
      await approvals.ensurePending("apply", app.id);
      log.info({ app: app.id, job: job.title, score: job.score }, "queued for approval");
    } else {
      log.info({ app: app.id, state: app.state, job: job.title }, "skipping (not awaiting approval)");
    }
  }

  const pending = await approvals.listPending();
  console.log(`\n=== Approval queue (${pending.length} pending) ===`);
  for (const ap of pending) {
    const app = ap.applicationId ? await apps.get(ap.applicationId) : null;
    console.log(`• approval ${ap.id.slice(0, 8)} [${ap.action}] app=${ap.applicationId?.slice(0, 8)} state=${app?.state}`);
  }
  console.log(`\nApprove one with: APPROVAL_ID=<id> pnpm --filter @jobagent/worker queue:approve`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "queue:build failed");
  process.exit(1);
});
