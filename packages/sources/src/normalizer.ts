import { jobCanonicalKey, type CanonicalJob, type RawPosting } from "@jobagent/shared";

/**
 * Normalize a RawPosting into a CanonicalJob (FR-102/105). Pure + deterministic.
 * Adds the canonical dedupe key and source provenance.
 */
export function normalizePosting(
  raw: RawPosting,
  source: { key: string },
  fetchedAt: string = new Date().toISOString(),
): CanonicalJob {
  const remote = raw.remote ?? inferRemote(raw.location, raw.title);
  return {
    canonicalKey: jobCanonicalKey(raw.title, raw.company, raw.location),
    title: raw.title.trim(),
    company: raw.company.trim(),
    location: raw.location?.trim() || undefined,
    remote,
    description: raw.description,
    url: raw.url,
    postedAt: raw.postedAt,
    source: { key: source.key, sourceJobId: raw.sourceJobId },
    fetchedAt,
  };
}

export function normalizePostings(
  raws: RawPosting[],
  source: { key: string },
  fetchedAt?: string,
): CanonicalJob[] {
  return raws.map((r) => normalizePosting(r, source, fetchedAt));
}

function inferRemote(location?: string, title?: string): boolean {
  const hay = `${location ?? ""} ${title ?? ""}`.toLowerCase();
  return /\bremote\b|work from home|wfh|anywhere/.test(hay);
}
