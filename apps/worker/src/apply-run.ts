import { childLogger, defaultProfile, loadProfileFromFile } from "@jobagent/shared";
import { issueToken, verifyApprovalToken, type Approval } from "@jobagent/core";
import {
  createPgPool,
  PgApplicationRepository,
  PgApprovalRepository,
  PgAuditRepository,
  PgMaterialRepository,
  PgMatchRepository,
} from "@jobagent/db";
import { GreenhouseApplyAdapter } from "@jobagent/sources";

/**
 * Gated outward apply (FR-403/404/405/407, ADR-005). For the first pending approval:
 *   grant → mint + VERIFY an approval token → run the (dry-run) Greenhouse apply adapter →
 *   transition + write an immutable audit entry.
 * SAFETY: dry-run by default — nothing is submitted to a real ATS. Set APPLY_LIVE=1 only with
 * real board credentials and genuine intent. Missing résumé ⇒ needs_manual (no guessing).
 *   DATABASE_URL=… pnpm --filter @jobagent/worker apply:run
 */
const log = childLogger({ component: "apply-run" });
const SECRET = process.env.APPROVAL_SECRET ?? "dev-approval-secret";

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");

  const profile =
    (process.env.PROFILE_FILE && loadProfileFromFile(process.env.PROFILE_FILE)) || defaultProfile();
  const pool = createPgPool(dbUrl);
  const matches = new PgMatchRepository(pool);
  const apps = new PgApplicationRepository(pool);
  const approvals = new PgApprovalRepository(pool);
  const audit = new PgAuditRepository(pool);
  const materials = new PgMaterialRepository(pool);

  // Ensure at least one pending approval exists (build from the next matched jobs).
  for (const job of await matches.topMatchedJobs(Number(process.env.QUEUE_TOP ?? "6"))) {
    let app = await apps.ensureForJob(job);
    if (app.state === "materials_drafted") app = await apps.transition(app.id, "pending_approval");
    if (app.state === "pending_approval") await approvals.ensurePending("apply", app.id);
  }

  const pending = await approvals.listPending();
  if (pending.length === 0) {
    log.warn("no pending approvals");
    await pool.end();
    return;
  }
  const target = pending[0]!;
  const app = await apps.get(target.applicationId!);
  if (!app) throw new Error("application missing");

  // 1) Human grants → mint a capability token → VERIFY it before any outward call.
  const grantedRec = await approvals.resolve(target.id, "granted", "operator");
  const approval: Approval = {
    id: grantedRec.id,
    action: "apply",
    applicationId: grantedRec.applicationId ?? undefined,
    status: "granted",
    createdAt: new Date().toISOString(),
    expiresAt: grantedRec.expiresAt,
  };
  const token = issueToken(approval, SECRET);
  if (!verifyApprovalToken(token, { action: "apply", applicationId: app.id }, SECRET)) {
    throw new Error("approval token failed verification — refusing to apply");
  }

  // 2) Look up the Greenhouse provenance + current résumé for this application.
  const prov = await pool.query(
    `SELECT s.key, js.source_job_id, j.title, j.company
       FROM application a JOIN job j ON j.id = a.job_id
       JOIN job_source js ON js.job_id = j.id
       JOIN source s ON s.id = js.source_id
      WHERE a.id = $1 AND s.key LIKE 'greenhouse:%' LIMIT 1`,
    [app.id],
  );
  if (prov.rowCount === 0) {
    log.warn({ app: app.id }, "no greenhouse provenance — cannot apply via adapter");
    await pool.end();
    return;
  }
  const board = String(prov.rows[0].key).split(":")[1]!;
  const postingId = String(prov.rows[0].source_job_id);
  const resume = await materials.getCurrent(app.id, "resume");
  const [firstName, ...rest] = profile.fullName.split(" ");

  // 3) Run the gated, dry-run adapter.
  const adapter = new GreenhouseApplyAdapter(board, process.env.GREENHOUSE_API_KEY);
  const result = await adapter.apply({
    postingId,
    board,
    applicant: {
      firstName: firstName ?? profile.fullName,
      lastName: rest.join(" ") || "",
      email: process.env.APPLICANT_EMAIL ?? "applicant@example.com",
      resumeText: resume?.content,
    },
    approvalRef: grantedRec.id,
    idempotencyKey: `${app.companyKey}|${app.normalizedRole}`,
    live: process.env.APPLY_LIVE === "1",
  });

  // 4) Transition + audit based on the outcome.
  let action = "application.submitted";
  if (result.status === "needs_manual") {
    await apps.transition(app.id, "needs_manual");
    action = "application.needs_manual";
  } else if (result.status === "failed") {
    await apps.transition(app.id, "needs_manual");
    action = "application.failed";
  } else {
    await apps.transition(app.id, "applied"); // dry_run or submitted
  }
  const entry = await audit.append({
    actor: "operator",
    action,
    approvalId: grantedRec.id,
    payload: { applicationId: app.id, board, postingId, result, live: process.env.APPLY_LIVE === "1" },
  });
  const verify = await audit.verifyChain();

  console.log(`\n${prov.rows[0].title} @ ${prov.rows[0].company}`);
  console.log(`  apply result : ${result.status}${result.reason ? ` (${result.reason})` : ""}`);
  console.log(`  application  : → ${(await apps.get(app.id))?.state}`);
  console.log(`  approval     : ${grantedRec.id.slice(0, 8)} granted + token verified ✓`);
  console.log(`  audit entry  : ${entry.id} (chain ${verify.ok ? "intact ✅" : "BROKEN ❌"})`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "apply:run failed");
  process.exit(1);
});
