import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Normalize free text for stable dedupe keys: lowercase, strip punctuation,
 * collapse whitespace. Deterministic and side-effect free.
 */
export function normalizeText(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical key for a job posting: sha256 of normalized title|company|location.
 * Used to dedupe the same role surfaced by multiple sources.
 */
export function jobCanonicalKey(title: string, company: string, location?: string): string {
  return sha256(
    [normalizeText(title), normalizeText(company), normalizeText(location)].join("|"),
  );
}
