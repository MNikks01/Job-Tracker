# ADR-003 — Playwright for browser automation (conservative, optional)

- **Status:** Accepted (design) · **Deferred — not implemented** · 2026-05-30
- ⚠️ **Reconciliation:** no Playwright code has been built. The apply path (`jobboards.apply`)
  is **API + dry-run only**; on a form-only source it returns `needs_manual` (hand-off). This ADR
  stands as the plan for if/when a per-source browser adapter is enabled — it remains OFF by
  default and is not part of the current implementation.

## Context
Some job sources lack APIs/feeds and require submitting web forms. We may need browser
automation for discovery or applying on those sources — but automation carries ToS and
anti-bot risk. Nikhil has production Puppeteer experience (resume).

## Decision
Use **Playwright** for the optional browser-automation adapter, **disabled per-source by
default**, isolated in its own container, and never used to evade anti-bot controls.

## Rationale
- Playwright > Puppeteer for cross-browser, auto-waiting, robust selectors, and test
  ergonomics; still familiar given Puppeteer background.
- Isolation (own container, ephemeral profiles) limits blast radius.
- Per-source toggle + NEEDS_MANUAL fallback keeps us compliant and safe.

## Consequences
- (+) Can reach form-only sources when explicitly enabled.
- (−) Brittle (DOM changes, CAPTCHAs); requires maintenance + manual fallback.
- **Hard rule:** never auto-solve CAPTCHAs or evade bot detection → on block, hand off to
  human (NEEDS_MANUAL).

## Alternatives
- API/feed-only: safest, but smaller source coverage. We prefer this *first*; Playwright is
  the gated escape hatch.
