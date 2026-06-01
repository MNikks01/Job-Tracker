import { describe, it, expect } from "vitest";
import { classifyEmail } from "./classify";
import { normalizeEmail, validateReplyTarget } from "./reply-guard";

describe("classifyEmail (FR-602)", () => {
  it("detects an interview invite", () => {
    const c = classifyEmail({
      subject: "Next steps",
      body: "Could we schedule a technical interview? Please share your availability.",
    });
    expect(c.label).toBe("interview_invite");
    expect(c.confidence).toBeGreaterThan(0.6);
    expect(c.signals.length).toBeGreaterThan(0);
  });

  it("detects a rejection", () => {
    const c = classifyEmail({
      subject: "Update",
      body: "Unfortunately we have decided not to move forward with your application.",
    });
    expect(c.label).toBe("rejection");
  });

  it("detects an offer and prioritizes it over invite language", () => {
    const c = classifyEmail({
      subject: "Great news",
      body: "We are pleased to offer you the role. We'll also schedule a call to discuss the offer letter.",
    });
    expect(c.label).toBe("offer");
  });

  it("detects recruiter outreach", () => {
    const c = classifyEmail({
      body: "Hi, I'm a recruiter and came across your profile — exciting opportunity for a backend role.",
    });
    expect(c.label).toBe("recruiter_outreach");
  });

  it("detects an info request", () => {
    const c = classifyEmail({
      body: "Could you please send your salary expectations and work authorization status?",
    });
    expect(c.label).toBe("info_request");
  });

  it("falls back to other with low confidence", () => {
    const c = classifyEmail({ subject: "hello", body: "thanks for your time yesterday" });
    expect(c.label).toBe("other");
    expect(c.confidence).toBeLessThan(0.5);
  });

  it("ignores body keywords for automated/no-reply senders (subject-only)", () => {
    // A newsletter whose BODY mentions interviews/offers but whose SUBJECT does not.
    const digest = classifyEmail({
      subject: "Stop installing these npm packages",
      body: "An article about how to schedule a coding interview and negotiate your job offer letter.",
      fromAddr: "Medium Daily Digest <noreply@medium.com>",
    });
    expect(digest.label).toBe("other");

    // Same content from a real person IS classified from the body.
    const person = classifyEmail({
      subject: "Stop installing these npm packages",
      body: "Can we schedule a technical interview next week?",
      fromAddr: "sam@acme.com",
    });
    expect(person.label).toBe("interview_invite");
  });
});

describe("validateReplyTarget (FR-605)", () => {
  const source = { threadId: "t1", messageId: "m1", fromAddr: "Sam Recruiter <sam@acme.com>" };

  it("passes a correctly-targeted reply", () => {
    expect(
      validateReplyTarget(source, { threadId: "t1", to: "sam@acme.com", inReplyToMessageId: "m1" }),
    ).toEqual({ ok: true });
  });

  it("blocks a wrong recipient", () => {
    const r = validateReplyTarget(source, { threadId: "t1", to: "evil@bad.com", inReplyToMessageId: "m1" });
    expect(r.ok).toBe(false);
  });

  it("blocks a wrong thread", () => {
    const r = validateReplyTarget(source, { threadId: "tX", to: "sam@acme.com", inReplyToMessageId: "m1" });
    expect(r.ok).toBe(false);
  });

  it("blocks a wrong in-reply-to", () => {
    const r = validateReplyTarget(source, { threadId: "t1", to: "sam@acme.com", inReplyToMessageId: "mX" });
    expect(r.ok).toBe(false);
  });

  it("normalizes display-name addresses", () => {
    expect(normalizeEmail("Sam Recruiter <SAM@acme.com>")).toBe("sam@acme.com");
  });
});
