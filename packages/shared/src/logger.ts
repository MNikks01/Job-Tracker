import pino from "pino";

/**
 * Structured logger with a secret-redaction layer (NFR-01: no secrets in logs).
 * Redaction paths cover common secret-bearing fields; extend as needed.
 */
const REDACT_PATHS = [
  "*.password",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.apiKey",
  "*.authorization",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "authorization",
  "ANTHROPIC_API_KEY",
  "GOOGLE_CLIENT_SECRET",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: undefined,
});

export type Logger = typeof logger;

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings) as Logger;
}
