import { describe, it, expect } from "vitest";
import { AuditLog } from "./audit";

describe("AuditLog (hash-chained, append-only)", () => {
  it("chains entries and verifies a clean chain", () => {
    const log = new AuditLog();
    log.append({ actor: "operator", action: "application.submitted", payload: { jobId: "a" } });
    log.append({ actor: "system", action: "reply.sent", payload: { threadId: "t1" } });
    const res = log.verifyChain();
    expect(res.ok).toBe(true);
    expect(log.list()).toHaveLength(2);
    expect(log.list()[0]!.prevHash).toBe("0".repeat(64));
    expect(log.list()[1]!.prevHash).toBe(log.list()[0]!.entryHash);
  });

  it("produces order-independent payload hashes (stable stringify)", () => {
    const a = new AuditLog().append({ actor: "s", action: "x", payload: { b: 1, a: 2 } });
    const b = new AuditLog().append({ actor: "s", action: "x", payload: { a: 2, b: 1 } });
    expect(a.payloadHash).toBe(b.payloadHash);
  });

  it("detects tampering with a payload hash", () => {
    const log = new AuditLog();
    log.append({ actor: "operator", action: "application.submitted", payload: { jobId: "a" } });
    log.append({ actor: "operator", action: "application.submitted", payload: { jobId: "b" } });
    // Tamper: mutate the first entry's stored payload hash.
    (log.list()[0] as { payloadHash: string }).payloadHash = "deadbeef";
    const res = log.verifyChain();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.brokenAtSeq).toBe(1);
  });
});
