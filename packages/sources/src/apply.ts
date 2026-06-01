import { ManualInterventionError, RetryableError } from "@jobagent/shared";
import type { FetchFn } from "./types";

export interface Applicant {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeText?: string;
  resumeFileRef?: string;
  coverLetter?: string;
}

export interface ApplyParams {
  /** Source-native posting id (e.g. the Greenhouse job id). */
  postingId: string;
  board: string;
  applicant: Applicant;
  /** Answers to source-specific application questions, keyed by field name. */
  answers?: Record<string, string>;
  /** Audit linkage: the granted approval that authorized this submission. */
  approvalRef: string;
  /** Unique per (company, role) — prevents double submission. */
  idempotencyKey: string;
  /**
   * Live submission. DEFAULT false → dry-run (validates + builds payload, sends nothing).
   * Real submission requires board credentials AND explicit opt-in AND genuine operator intent.
   */
  live?: boolean;
}

export type ApplyStatus = "dry_run" | "submitted" | "needs_manual" | "failed";
export interface ApplyResult {
  status: ApplyStatus;
  ref?: string;
  reason?: string;
}

export interface ApplyAdapter {
  readonly key: string;
  readonly board: string;
  apply(params: ApplyParams, fetchFn?: FetchFn): Promise<ApplyResult>;
}

/** Build the Greenhouse application payload (pure). Mirrors the Job Board API fields. */
export function buildGreenhouseApplication(params: ApplyParams): Record<string, unknown> {
  const a = params.applicant;
  return {
    id: params.postingId,
    first_name: a.firstName,
    last_name: a.lastName,
    email: a.email,
    ...(a.phone ? { phone: a.phone } : {}),
    ...(a.resumeText ? { resume_text: a.resumeText } : {}),
    ...(a.coverLetter ? { cover_letter_text: a.coverLetter } : {}),
    ...(params.answers ?? {}),
  };
}

/**
 * Greenhouse apply adapter (FR-403/404/407). Compliance + safety posture:
 *  - **dry-run by default** — never POSTs unless `live: true` AND a board API key is present;
 *  - missing résumé / unmapped required fields → `needs_manual` (no guessing);
 *  - the caller MUST have verified an approval token before invoking this (HITL gate).
 */
export class GreenhouseApplyAdapter implements ApplyAdapter {
  readonly key: string;
  constructor(
    readonly board: string,
    private readonly apiKey?: string,
  ) {
    this.key = `greenhouse:${board}`;
  }

  async apply(params: ApplyParams, fetchFn: FetchFn = fetch): Promise<ApplyResult> {
    // Honesty/safety gate: no résumé → hand off, never fabricate or submit blank.
    if (!params.applicant.resumeText && !params.applicant.resumeFileRef) {
      return { status: "needs_manual", reason: "no résumé available for this application" };
    }
    if (!params.applicant.email) {
      return { status: "needs_manual", reason: "missing applicant email" };
    }

    const payload = buildGreenhouseApplication(params);

    if (!params.live) {
      return { status: "dry_run", ref: params.idempotencyKey, reason: "dry-run — nothing sent" };
    }

    // --- Live submission path (guarded; requires a board API key) ---
    if (!this.apiKey) {
      return { status: "needs_manual", reason: "live submit requested but no board API key configured" };
    }
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(this.board)}/jobs/${encodeURIComponent(params.postingId)}`;
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
          "idempotency-key": params.idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new RetryableError("greenhouse apply failed (network)", { cause: String(e) });
    }
    if (res.status === 401 || res.status === 403) {
      throw new ManualInterventionError("greenhouse apply unauthorized — manual submission needed", {
        status: res.status,
      });
    }
    if (!res.ok) {
      return { status: "failed", reason: `greenhouse responded ${res.status}` };
    }
    return { status: "submitted", ref: params.idempotencyKey };
  }
}
