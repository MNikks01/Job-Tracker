import { describe, it, expect, vi } from "vitest";
import { buildGreenhouseApplication, GreenhouseApplyAdapter, type ApplyParams } from "./apply";

const base: ApplyParams = {
  postingId: "123",
  board: "acme",
  applicant: { firstName: "Nikhil", lastName: "Meshram", email: "n@example.com", resumeText: "resume" },
  approvalRef: "appr-1",
  idempotencyKey: "acme|senior-engineer",
};

describe("buildGreenhouseApplication", () => {
  it("maps applicant + answers to Greenhouse fields", () => {
    const p = buildGreenhouseApplication({ ...base, answers: { school: "KGIET" } });
    expect(p).toMatchObject({ id: "123", first_name: "Nikhil", email: "n@example.com", resume_text: "resume", school: "KGIET" });
  });
});

describe("GreenhouseApplyAdapter.apply (gated, dry-run default)", () => {
  it("dry-runs by default and never calls fetch", async () => {
    const fetchFn = vi.fn();
    const r = await new GreenhouseApplyAdapter("acme").apply(base, fetchFn as never);
    expect(r.status).toBe("dry_run");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("routes to needs_manual when no résumé is available (no guessing)", async () => {
    const r = await new GreenhouseApplyAdapter("acme").apply({
      ...base,
      applicant: { ...base.applicant, resumeText: undefined, resumeFileRef: undefined },
    });
    expect(r.status).toBe("needs_manual");
  });

  it("needs_manual on live submit without an API key", async () => {
    const r = await new GreenhouseApplyAdapter("acme").apply({ ...base, live: true });
    expect(r.status).toBe("needs_manual");
    expect(r.reason).toMatch(/no board API key/);
  });

  it("submits on a 2xx when live with an API key", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await new GreenhouseApplyAdapter("acme", "key").apply({ ...base, live: true }, fetchFn);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(r.status).toBe("submitted");
  });

  it("returns failed on a non-2xx (live)", async () => {
    const fetchFn = vi.fn(async () => new Response("err", { status: 422 }));
    const r = await new GreenhouseApplyAdapter("acme", "key").apply({ ...base, live: true }, fetchFn);
    expect(r.status).toBe("failed");
  });
});
