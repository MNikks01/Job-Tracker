# Security Checklist

> Phase 7 · Status: Draft v0.1 · 2026-05-30
> Gate for every release. ☐ = to verify.

## Secrets
- ☐ No secrets in git (gitleaks/trufflehog in CI).
- ☐ `.env` + secrets files gitignored; sample `.env.example` only.
- ☐ Secrets injected at runtime (Secrets Manager/SSM/Docker secrets) in non-local envs.
- ☐ No secret/token in logs, traces, audit, prompts (log-scrubber + automated test).
- ☐ Key rotation procedure documented + tested.

## AuthN / AuthZ
- ☐ Dashboard requires authentication; TOTP available.
- ☐ CSRF protection on mutating endpoints.
- ☐ Agents use deny-by-default capabilities.
- ☐ Outward tools require valid, unexpired approval token (HITL).
- ☐ DB app role least-privileged; `audit_log` append-only.

## OAuth
- ☐ Least-privilege Google scopes; no delete scopes.
- ☐ Refresh tokens encrypted at rest; refresh server-side only.
- ☐ Disconnect/revocation path works and purges tokens.

## Data protection
- ☐ Encryption at rest (DB, secrets, object store).
- ☐ TLS in transit for all external calls.
- ☐ Minimal LLM context (no full inbox/profile/secrets).
- ☐ Retention policy enforced (raw payloads, email plaintext).

## Application safety guardrails
- ☐ Fabrication check blocks unsupported claims (test with injected fabrication).
- ☐ Recipient + thread validated before any send (test mismatch is blocked).
- ☐ Idempotency prevents double-apply (test).
- ☐ Budget cap pauses LLM work + alerts (test).
- ☐ CAPTCHA/unknown form → NEEDS_MANUAL, never guessed.

## Prompt injection
- ☐ External text treated as untrusted; tool-call allow-list per agent.
- ☐ Model cannot self-issue approval tokens or change recipients.

## Audit & monitoring
- ☐ Every outward action has an audit entry + approval link.
- ☐ Audit hash-chain verification job runs + alerts.
- ☐ Alerts wired for guardrail violations + budget + DLQ growth.

## Infra
- ☐ MCP servers not publicly exposed.
- ☐ Browser automation isolated; per-source toggles default-safe (LinkedIn off).
- ☐ Dependencies scanned (npm audit / Dependabot); base images patched.
- ☐ Backups encrypted + restore drill done.
