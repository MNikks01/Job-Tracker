import { childLogger } from "@jobagent/shared";
import {
  createPgPool,
  PgApplicationRepository,
  PgApprovalRepository,
  PgAuditRepository,
} from "@jobagent/db";

/**
 * Record that the operator has applied (externally) to everything currently awaiting
 * approval: grant each pending approval, transition the application to `applied`, and write
 * an immutable audit entry tagged `via: external`. This sets `submitted_at` for tracking.
 *   DATABASE_URL=… pnpm --filter @jobagent/worker track:applied
 */
const log = childLogger({ component: "track-applied" });

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const pool = createPgPool(dbUrl);
  const approvals = new PgApprovalRepository(pool);
  const apps = new PgApplicationRepository(pool);
  const audit = new PgAuditRepository(pool);

  const pending = await approvals.listPending();
  let applied = 0;
  for (const ap of pending) {
    if (!ap.applicationId) continue;
    const app = await apps.get(ap.applicationId);
    if (!app) continue;
    if (app.state !== "pending_approval" && app.state !== "needs_manual") continue;

    const granted = await approvals.resolve(ap.id, "granted", "operator");
    const updated = await apps.transition(app.id, "applied");
    await audit.append({
      actor: "operator",
      action: "application.submitted",
      approvalId: granted.id,
      payload: { applicationId: updated.id, jobId: updated.jobId, via: "external" },
    });
    applied += 1;
  }

  const verify = await audit.verifyChain();
  log.info({ applied, auditOk: verify.ok }, "marked applications as applied");
  console.log(`\nRecorded ${applied} applications as applied (audit chain ${verify.ok ? "intact ✅" : "BROKEN ❌"}).`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "track:applied failed");
  process.exit(1);
});
