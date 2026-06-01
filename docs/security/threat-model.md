# Threat Model & Risk Assessment

> Phase 7 · Status: Draft v0.1 · 2026-05-30 · Method: STRIDE + abuse cases

## 1. Assets
| Asset | Sensitivity |
|-------|-------------|
| Google OAuth tokens (Gmail/Calendar) | Critical |
| Anthropic API key | Critical |
| Master profile / personal data | High |
| Email contents | High |
| Audit log integrity | High |
| Generated materials | Medium |
| Source credentials/sessions | High |

## 2. Trust boundaries
- Operator ↔ Dashboard/API (authenticated).
- Agents ↔ MCP servers (capability + approval tokens).
- MCP servers ↔ external APIs (OAuth/API keys, server-side only).
- System ↔ LLM provider (only minimal, relevant text leaves).
- Browser automation container ↔ target sites (isolated).

## 3. STRIDE analysis
| Threat | Example | Mitigation |
|--------|---------|------------|
| **Spoofing** | Forged request to approve/apply | Authenticated dashboard, signed approval tokens, CSRF protection |
| **Tampering** | Modify audit log / materials | Append-only hash-chained audit; integrity checks; DB least-priv |
| **Repudiation** | "I didn't approve that" | Every outward action bound to an approval id + audit entry |
| **Information disclosure** | Token/profile leak in logs | No secrets in logs (scrubber + test); encryption at rest; minimal LLM context |
| **Denial of service** | Source/LLM overload, cost bomb | Rate limits, budget cap, backoff, queue caps |
| **Elevation of privilege** | Agent calls outward tool unapproved | Deny-by-default capabilities; outward tools require approval token |

## 4. Abuse / misuse cases (domain-specific)
| Abuse case | Mitigation |
|-----------|------------|
| Mis-sent email (wrong recipient/thread) | Recipient+thread validation in `gmail.sendReply`; HITL |
| Double / spam applications | Idempotency (company,role); per-company throttle; HITL |
| Fabricated resume claims | Critic + claim→profileRef grounding; block on violation |
| ToS violation / scraping | APIs/feeds first; per-source toggles; LinkedIn off by default; conservative limits |
| Prompt injection via job desc / email | Treat external text as untrusted; never let it grant capabilities or change recipients; tool-call allow-list; the model cannot self-authorize outward actions |
| CAPTCHA auto-solve pressure | Explicitly disallowed → NEEDS_MANUAL hand-off |
| Budget exhaustion | Hard cap + alerts + pause |

## 5. Prompt-injection defenses (called out)
- External content (job descriptions, emails) is **data, not instructions**. System prompts
  state this; outputs are schema-constrained; tool use is allow-listed per agent.
- Outward actions require an **approval token issued by the human/control plane**, not by the
  model — so an injected "send money / email X" cannot execute.
- Recipients/links in sends are validated against the **source thread**, not model output.

## 6. Residual risks
- Browser-automation brittleness/detection (accepted; mitigated by manual fallback).
- LLM provider outage/policy change (accepted; degrade gracefully).
- Single-operator key compromise (mitigated by encryption + least privilege; rotate on suspicion).

See `risk-register` rows in `../project-overview.md` §10 and `security-checklist.md`.
