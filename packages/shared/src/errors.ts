/**
 * Error taxonomy — see docs/architecture/low-level-architecture.md §6.
 * Agents/services classify failures so the orchestrator can route them:
 *  - RetryableError          -> backoff + retry
 *  - ManualInterventionError -> NEEDS_MANUAL hand-off + notify
 *  - GuardrailError          -> block + audit + alert (safety violations)
 *  - FatalError              -> fail fast, page maintainer
 */

export type ErrorKind = "retryable" | "manual" | "guardrail" | "fatal";

export abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;
  readonly context?: Record<string, unknown>;
  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.context = context;
  }
}

export class RetryableError extends AppError {
  readonly kind = "retryable" as const;
}

export class ManualInterventionError extends AppError {
  readonly kind = "manual" as const;
}

/** Honesty/safety/budget/recipient violations. Never silently swallowed. */
export class GuardrailError extends AppError {
  readonly kind = "guardrail" as const;
}

export class FatalError extends AppError {
  readonly kind = "fatal" as const;
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
