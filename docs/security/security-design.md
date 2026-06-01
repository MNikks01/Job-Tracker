# Security Design — Secrets, OAuth, Encryption, Access Control, Audit

> Phase 7 · Status: Draft v0.1 · 2026-05-30

## 1. Secrets management
- **Local:** secrets in a `.env` excluded from git + an encrypted secrets file (e.g.,
  SOPS/age) or Docker secrets; never committed.
- **Cloud:** AWS Secrets Manager / SSM Parameter Store (KMS-encrypted); injected at runtime.
- **Access:** only MCP servers that need a given secret can read it; agents never see raw
  secrets. Rotation supported; rotate on suspicion or schedule.
- **No secrets** in: logs, traces, audit payloads, LLM prompts, error messages, git.

## 2. OAuth 2.0 flows (Google)
```mermaid
sequenceDiagram
    participant OP as Operator
    participant DASH as Dashboard
    participant GO as Google OAuth
    participant SVR as Gmail/Calendar MCP
    OP->>DASH: Connect Google
    DASH->>GO: auth request (least scopes, offline)
    GO-->>OP: consent
    OP->>GO: approve
    GO-->>DASH: auth code
    DASH->>GO: exchange code -> access+refresh token
    DASH->>SVR: store tokens (encrypted)
    Note over SVR: refresh server-side; never expose to agents/LLM
```
- **Scopes (least privilege):** Gmail read (metadata/body as needed) + send + modify(labels);
  Calendar events + freebusy. No delete scopes.
- **Token storage:** encrypted at rest (KMS/age); refresh handled by the MCP server.
- **Revocation:** operator can disconnect; tokens revoked + purged.

## 3. Encryption
- **At rest:** DB volume / RDS encryption (KMS); secrets encrypted; object store SSE.
- **In transit:** TLS everywhere (external APIs always; internal services in cloud).
- **Field-level:** OAuth tokens + any stored credentials encrypted with an app key (envelope
  encryption) on top of disk encryption.

## 4. Access control
- **Dashboard/API:** single-operator auth (strong password + optional TOTP; or device-bound
  session for local). All mutating endpoints require auth + CSRF protection.
- **Capabilities:** agents hold scoped capabilities; deny-by-default; outward tools need an
  approval token.
- **Network:** MCP servers bind to the internal Docker network; not exposed publicly.
  Dashboard exposed only to localhost (local mode) or behind auth + TLS (cloud).
- **Least privilege DB:** app role limited to needed tables; `audit_log` append-only.

## 5. Audit logging
- Append-only `audit_log`, **hash-chained** (`entry_hash = H(prev_hash || payload_hash ||
  actor || action || time)`) → tamper-evident.
- Every outward action (apply/send/schedule) + config changes + profile edits are audited.
- Payloads stored as hashes (+ minimal metadata), not sensitive plaintext.
- Periodic chain-verification job; alert on break.

## 6. LLM data minimization
- Only the minimal relevant profile/job/thread excerpts are sent to Claude (RAG, not dumps).
- No secrets, no full inbox, no tokens in prompts.
- Prompt-injection treated per threat model (external text = untrusted data).

## 7. Browser automation isolation
- Playwright runs in its own container; no shared cookies/credentials beyond the target
  session; ephemeral profiles; never auto-solves CAPTCHA; respects per-source toggles.

## 8. Compliance posture
- Personal-use, single-subject (Nikhil's own data + consented Google account).
- Per-source ToS respected; honesty guardrails enforced in code, not just policy.
