import { childLogger } from "@jobagent/shared";
import {
  createPgPool,
  PgApplicationRepository,
  PgApprovalRepository,
  PgAuditRepository,
} from "@jobagent/db";

/**
 * Approve a pending application (the HITL gate, ADR-005). Grants the approval, transitions
 * the application to `applied`, and writes an immutable, hash-chained audit record (NFR-10).
 * NOTE: this simulates the *decision + audit*; the real external submission is the
 * jobboards.apply adapter (a later task). Nothing is sent to a real ATS here.
 *   APPROVAL_ID=<id> DATABASE_URL=… pnpm --filter @jobagent/worker queue:approve
 */
const log = childLogger({ component: "queue-approve" });

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");

  const pool = createPgPool(dbUrl);
  const apps = new PgApplicationRepository(pool);
  const approvals = new PgApprovalRepository(pool);
  const audit = new PgAuditRepository(pool);

  const pending = await approvals.listPending();
  const target = process.env.APPROVAL_ID
    ? pending.find((p) => p.id === process.env.APPROVAL_ID)
    : pending[0];
  if (!target) {
    log.warn("no matching pending approval — run queue:build first");
    await pool.end();
    return;
  }
  if (!target.applicationId) throw new Error("approval has no application");

  // 1) Human grants the approval.
  const granted = await approvals.resolve(target.id, "granted", "operator");
  // 2) Application transitions to applied (state machine validated).
  const app = await apps.transition(target.applicationId, "applied");
  // 3) Immutable audit record bound to the approval.
  const entry = await audit.append({
    actor: "operator",
    action: "application.submitted",
    approvalId: granted.id,
    payload: { applicationId: app.id, jobId: app.jobId, action: "apply" },
  });
  // 4) Verify the audit chain is intact.
  const verify = await audit.verifyChain();

  console.log(`\n✅ Approved + applied`);
  console.log(`   application ${app.id.slice(0, 8)} → state=${app.state}`);
  console.log(`   approval    ${granted.id.slice(0, 8)} → ${granted.status} by operator`);
  console.log(`   audit entry ${entry.id} hash=${entry.entryHash.slice(0, 12)}…`);
  console.log(`   audit chain: ${verify.ok ? `intact (${verify.count} entries) ✅` : `BROKEN at ${verify.brokenAtId} ❌`}`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "queue:approve failed");
  process.exit(1);
});
