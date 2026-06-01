import { describe, it, expect } from "vitest";
import { jobCanonicalKey, normalizeText, sha256 } from "./hash";

describe("normalizeText", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeText("  Senior   Node.js   Engineer! ")).toBe("senior node js engineer");
  });
  it("handles nullish", () => {
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(null)).toBe("");
  });
});

describe("jobCanonicalKey", () => {
  it("is stable across punctuation/case/whitespace variants", () => {
    const a = jobCanonicalKey("Senior Node.js Engineer", "Acme Inc", "Remote");
    const b = jobCanonicalKey("  senior   node js   engineer ", "ACME inc", "remote");
    expect(a).toBe(b);
  });
  it("differs for different roles", () => {
    expect(jobCanonicalKey("Backend Engineer", "Acme")).not.toBe(
      jobCanonicalKey("Frontend Engineer", "Acme"),
    );
  });
  it("is a 64-char hex digest", () => {
    expect(jobCanonicalKey("x", "y")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sha256", () => {
  it("is deterministic", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });
});
