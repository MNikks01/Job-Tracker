import { NextRequest, NextResponse } from "next/server";
import {
  PgApplicationRepository,
  PgApprovalRepository,
  PgAuditRepository,
} from "@jobagent/db";
import { db } from "../../db";

export const dynamic = "force-dynamic";

/**
 * HITL approve action (ADR-005): grant the approval, transition the application to `applied`
 * (state-machine validated), and write an immutable hash-chained audit entry (NFR-10).
 * Posted from the queue UI as a plain form; redirects back to the dashboard.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData();
  const approvalId = String(form.get("approvalId") ?? "");
  const home = new URL("/", req.url);

  if (!approvalId) return NextResponse.redirect(new URL("/?error=missing", req.url), 303);

  const pool = db();
  const approvals = new PgApprovalRepository(pool);
  const apps = new PgApplicationRepository(pool);
  const audit = new PgAuditRepository(pool);

  try {
    const granted = await approvals.resolve(approvalId, "granted", "operator");
    if (!granted.applicationId) throw new Error("approval has no application");
    const app = await apps.transition(granted.applicationId, "applied");
    await audit.append({
      actor: "operator",
      action: "application.submitted",
      approvalId: granted.id,
      payload: { applicationId: app.id, jobId: app.jobId, action: "apply", via: "dashboard" },
    });
    return NextResponse.redirect(new URL("/?approved=1", req.url), 303);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    home.searchParams.set("error", msg.slice(0, 80));
    return NextResponse.redirect(home, 303);
  }
}
