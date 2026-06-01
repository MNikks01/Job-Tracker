/**
 * Rule-based recruiter-email classifier (FR-602). Deterministic, offline, explainable — a
 * fast/cheap first pass that triages the inbox; the LLM refines/handles edge cases later.
 */
export type EmailLabel =
  | "interview_invite"
  | "offer"
  | "rejection"
  | "info_request"
  | "recruiter_outreach"
  | "other";

export interface EmailInput {
  subject?: string;
  body?: string;
  fromAddr?: string;
}

export interface Classification {
  label: EmailLabel;
  confidence: number; // 0..1
  signals: string[]; // matched phrases, for explainability
}

interface Pattern {
  label: Exclude<EmailLabel, "other">;
  weight: number;
  phrase: string;
}

// Higher weight = stronger signal. Terminal outcomes (offer/rejection) outweigh invites.
const PATTERNS: Pattern[] = [
  // offer
  { label: "offer", weight: 5, phrase: "pleased to offer" },
  { label: "offer", weight: 5, phrase: "extend an offer" },
  { label: "offer", weight: 5, phrase: "offer letter" },
  { label: "offer", weight: 4, phrase: "job offer" },
  { label: "offer", weight: 3, phrase: "compensation package" },
  // rejection
  { label: "rejection", weight: 5, phrase: "not moving forward" },
  { label: "rejection", weight: 5, phrase: "regret to inform" },
  { label: "rejection", weight: 4, phrase: "decided to move forward with other" },
  { label: "rejection", weight: 4, phrase: "not be proceeding" },
  { label: "rejection", weight: 4, phrase: "other candidates" },
  { label: "rejection", weight: 4, phrase: "position has been filled" },
  { label: "rejection", weight: 3, phrase: "unfortunately" },
  // interview invite
  { label: "interview_invite", weight: 4, phrase: "schedule a" },
  { label: "interview_invite", weight: 4, phrase: "phone screen" },
  { label: "interview_invite", weight: 4, phrase: "technical interview" },
  { label: "interview_invite", weight: 3, phrase: "set up a call" },
  { label: "interview_invite", weight: 3, phrase: "your availability" },
  { label: "interview_invite", weight: 3, phrase: "are you available" },
  { label: "interview_invite", weight: 3, phrase: "book a time" },
  { label: "interview_invite", weight: 3, phrase: "calendly" },
  { label: "interview_invite", weight: 2, phrase: "interview" },
  // info request
  { label: "info_request", weight: 3, phrase: "salary expectations" },
  { label: "info_request", weight: 3, phrase: "work authorization" },
  { label: "info_request", weight: 3, phrase: "could you please send" },
  { label: "info_request", weight: 3, phrase: "fill out" },
  { label: "info_request", weight: 3, phrase: "complete the" },
  { label: "info_request", weight: 2, phrase: "a few questions" },
  { label: "info_request", weight: 2, phrase: "portfolio" },
  // recruiter outreach
  { label: "recruiter_outreach", weight: 4, phrase: "came across your profile" },
  { label: "recruiter_outreach", weight: 3, phrase: "exciting opportunity" },
  { label: "recruiter_outreach", weight: 3, phrase: "i'm a recruiter" },
  { label: "recruiter_outreach", weight: 3, phrase: "reaching out" },
  { label: "recruiter_outreach", weight: 2, phrase: "your background" },
  { label: "recruiter_outreach", weight: 2, phrase: "open role" },
  { label: "recruiter_outreach", weight: 2, phrase: "would love to connect" },
];

// Tie-break priority (most consequential first).
const PRIORITY: EmailLabel[] = [
  "offer",
  "rejection",
  "interview_invite",
  "info_request",
  "recruiter_outreach",
  "other",
];

/**
 * Automated/no-reply senders (job-board blasts, newsletters, alerts) — you can't reply to
 * these, so they're not personal recruiter responses. For them we classify on the SUBJECT
 * only, since their long marketing bodies trigger keyword false-positives.
 */
const PROMO_SENDER = /no-?reply|donotreply|do-not-reply|jobalert|job-alert|jobmessenger|googlealerts|newsletter|digest|mailer|notifications?@|noreply/i;

export function isPromotionalSender(fromAddr?: string): boolean {
  return fromAddr ? PROMO_SENDER.test(fromAddr) : false;
}

export function classifyEmail(email: EmailInput): Classification {
  const promo = isPromotionalSender(email.fromAddr);
  const source = promo ? (email.subject ?? "") : `${email.subject ?? ""}\n${email.body ?? ""}`;
  const hay = source.toLowerCase();

  const scores = new Map<EmailLabel, number>();
  const signals: string[] = [];
  for (const p of PATTERNS) {
    if (hay.includes(p.phrase)) {
      scores.set(p.label, (scores.get(p.label) ?? 0) + p.weight);
      signals.push(p.phrase);
    }
  }

  if (scores.size === 0) {
    return { label: "other", confidence: 0.4, signals: [] };
  }

  // Pick the highest score; break ties by PRIORITY.
  let best: EmailLabel = "other";
  let bestScore = -1;
  for (const [label, score] of scores) {
    if (score > bestScore || (score === bestScore && PRIORITY.indexOf(label) < PRIORITY.indexOf(best))) {
      best = label;
      bestScore = score;
    }
  }

  const confidence = Math.min(0.95, 0.5 + 0.08 * bestScore);
  return {
    label: best,
    confidence: Number(confidence.toFixed(2)),
    signals: signals.filter((s) => PATTERNS.some((p) => p.phrase === s && p.label === best)),
  };
}
