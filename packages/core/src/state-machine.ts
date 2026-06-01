import { GuardrailError, type ApplicationState } from "@jobagent/shared";

/**
 * Application lifecycle state machine (FR-501). Encodes the legal transitions from
 * docs/requirements/use-cases.md. Any state may transition to `archived`.
 * Invalid transitions throw a GuardrailError (an integrity violation, never silent).
 */
const ALLOWED: Record<ApplicationState, ApplicationState[]> = {
  discovered: ["matched", "archived"],
  matched: ["materials_drafted", "archived"],
  materials_drafted: ["pending_approval", "archived"],
  pending_approval: ["applied", "rejected_by_user", "snoozed", "needs_manual", "archived"],
  snoozed: ["pending_approval", "archived"],
  needs_manual: ["applied", "rejected_by_user", "archived"],
  applied: ["responded", "ghosted", "archived"],
  responded: ["interview_scheduled", "rejected_by_company", "archived"],
  interview_scheduled: ["interviewed", "rejected_by_company", "archived"],
  interviewed: ["offer", "rejected_by_company", "archived"],
  offer: ["accepted", "declined", "archived"],
  // terminal-ish states
  rejected_by_user: ["archived"],
  ghosted: ["archived", "responded"],
  rejected_by_company: ["archived"],
  accepted: ["archived"],
  declined: ["archived"],
  archived: [],
};

export function canTransition(from: ApplicationState, to: ApplicationState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: ApplicationState, to: ApplicationState): void {
  if (!canTransition(from, to)) {
    throw new GuardrailError(`Illegal application transition: ${from} → ${to}`, { from, to });
  }
}

export function nextStates(from: ApplicationState): ApplicationState[] {
  return [...(ALLOWED[from] ?? [])];
}
