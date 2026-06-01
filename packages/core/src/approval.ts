import { randomUUID } from "node:crypto";
import { GuardrailError, sha256 } from "@jobagent/shared";

/** Outward actions that require human approval in HITL mode (ADR-005). */
export type ApprovalAction = "apply" | "reply" | "schedule";
export type ApprovalStatus = "pending" | "granted" | "rejected" | "expired";

export interface Approval {
  id: string;
  action: ApprovalAction;
  applicationId?: string;
  messageId?: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  expiresAt: string;
}

/**
 * A capability proving a human approved a specific action on a specific subject. Outward
 * MCP tools (gmail.sendReply, jobboards.apply, calendar.createEvent) require a valid token.
 */
export interface ApprovalToken {
  approvalId: string;
  action: ApprovalAction;
  applicationId?: string;
  expiresAt: string;
  signature: string;
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function createApproval(
  action: ApprovalAction,
  subject: { applicationId?: string; messageId?: string },
  now: Date = new Date(),
  ttlMs: number = DEFAULT_TTL_MS,
): Approval {
  return {
    id: randomUUID(),
    action,
    applicationId: subject.applicationId,
    messageId: subject.messageId,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

/** Resolve a pending approval. Expired pending approvals cannot be granted. */
export function resolveApproval(
  approval: Approval,
  decision: "grant" | "reject",
  decidedBy: string,
  now: Date = new Date(),
): Approval {
  if (approval.status !== "pending") {
    throw new GuardrailError(`Approval already ${approval.status}`, { id: approval.id });
  }
  if (decision === "grant" && now.toISOString() > approval.expiresAt) {
    return { ...approval, status: "expired" };
  }
  return {
    ...approval,
    status: decision === "grant" ? "granted" : "rejected",
    decidedAt: now.toISOString(),
    decidedBy,
  };
}

/** Mint a token from a granted approval. Throws if the approval is not granted. */
export function issueToken(approval: Approval, secret: string): ApprovalToken {
  if (approval.status !== "granted") {
    throw new GuardrailError("Cannot issue token for a non-granted approval", {
      id: approval.id,
      status: approval.status,
    });
  }
  return {
    approvalId: approval.id,
    action: approval.action,
    applicationId: approval.applicationId,
    expiresAt: approval.expiresAt,
    signature: signApproval(approval, secret),
  };
}

/** Verify a token authorizes `action` on `applicationId` and is unexpired + unforged. */
export function verifyApprovalToken(
  token: ApprovalToken,
  expect: { action: ApprovalAction; applicationId?: string },
  secret: string,
  now: Date = new Date(),
): boolean {
  if (token.action !== expect.action) return false;
  if (expect.applicationId && token.applicationId !== expect.applicationId) return false;
  if (now.toISOString() > token.expiresAt) return false;
  const expected = signApproval(
    {
      id: token.approvalId,
      action: token.action,
      applicationId: token.applicationId,
      expiresAt: token.expiresAt,
    },
    secret,
  );
  return token.signature === expected;
}

function signApproval(
  a: { id: string; action: ApprovalAction; applicationId?: string; expiresAt: string },
  secret: string,
): string {
  return sha256([secret, a.id, a.action, a.applicationId ?? "", a.expiresAt].join("|"));
}
