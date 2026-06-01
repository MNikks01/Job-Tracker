import { describe, it, expect } from "vitest";
import {
  createApproval,
  issueToken,
  resolveApproval,
  verifyApprovalToken,
} from "./approval";
import { GuardrailError } from "@jobagent/shared";

const SECRET = "test-secret";

describe("approval domain (ADR-005 HITL)", () => {
  it("creates a pending approval with an expiry", () => {
    const a = createApproval("apply", { applicationId: "app1" });
    expect(a.status).toBe("pending");
    expect(a.action).toBe("apply");
    expect(new Date(a.expiresAt).getTime()).toBeGreaterThan(new Date(a.createdAt).getTime());
  });

  it("grants then issues a verifiable token", () => {
    const granted = resolveApproval(createApproval("apply", { applicationId: "app1" }), "grant", "operator");
    expect(granted.status).toBe("granted");
    const token = issueToken(granted, SECRET);
    expect(verifyApprovalToken(token, { action: "apply", applicationId: "app1" }, SECRET)).toBe(true);
  });

  it("rejects a token for the wrong action or application (no privilege escalation)", () => {
    const token = issueToken(resolveApproval(createApproval("apply", { applicationId: "app1" }), "grant", "op"), SECRET);
    expect(verifyApprovalToken(token, { action: "reply", applicationId: "app1" }, SECRET)).toBe(false);
    expect(verifyApprovalToken(token, { action: "apply", applicationId: "other" }, SECRET)).toBe(false);
  });

  it("rejects a forged signature", () => {
    const token = issueToken(resolveApproval(createApproval("apply", {}), "grant", "op"), SECRET);
    expect(verifyApprovalToken({ ...token, signature: "forged" }, { action: "apply" }, SECRET)).toBe(false);
    expect(verifyApprovalToken(token, { action: "apply" }, "wrong-secret")).toBe(false);
  });

  it("cannot issue a token for a non-granted approval", () => {
    const rejected = resolveApproval(createApproval("apply", {}), "reject", "operator");
    expect(() => issueToken(rejected, SECRET)).toThrowError(GuardrailError);
  });

  it("cannot re-resolve an already-decided approval", () => {
    const granted = resolveApproval(createApproval("apply", {}), "grant", "op");
    expect(() => resolveApproval(granted, "reject", "op")).toThrowError(GuardrailError);
  });

  it("expires a grant past its TTL", () => {
    const a = createApproval("apply", {}, new Date("2026-01-01T00:00:00Z"), 1000);
    const later = new Date("2026-01-02T00:00:00Z");
    expect(resolveApproval(a, "grant", "op", later).status).toBe("expired");
  });
});
