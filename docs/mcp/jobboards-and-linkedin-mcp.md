# MCP Servers — Job Boards & LinkedIn

> Phase 5 · Status: Draft v0.1 · 2026-05-30
> **Compliance first.** Discovery and applying prefer official APIs/feeds. Browser
> automation is optional, per-source, conservative, and never evades anti-bot controls.

## A. `jobboards-mcp`
### Adapter model
A pluggable `SourceAdapter` interface; each source implements discovery and (optionally)
apply. Built-in adapters favor ToS-friendly sources:
- **Greenhouse public job board API**, **Lever postings API**, **Ashby**, **RSS/Atom feeds**,
  generic **career-page** adapters, and aggregator APIs where licensed.
- A **Playwright adapter** exists for sources that require form submission, gated behind a
  per-source `automationEnabled` flag.

```ts
interface SourceAdapter {
  id: string;
  discover(params): Promise<RawPosting[]>;
  supportsApply: boolean;
  apply?(application, approvalToken): Promise<ApplyResult>;  // outward
  rateLimit: { rps: number; burst: number };
}
```

### Tools
| Tool | Type | Description |
|------|------|-------------|
| `jobboards.listSources` | read | Enabled sources + capabilities |
| `jobboards.discover` | read | Fetch postings for a source (rate-limited) |
| `jobboards.getPosting` | read | Fetch one posting detail |
| `jobboards.apply` | mutate(outward) | Submit application (**approval required**) |
| `jobboards.applyStatus` | read | Poll submission status if supported |

### Schemas
```ts
discover.input  = { sourceId: string; query?: string; location?: string; sinceCursor?: string }
discover.output = { postings: RawPosting[]; nextCursor?: string }
apply.input     = { sourceId: string; postingId: string; profileVariantId: string;
                    resumeFileId: string; coverLetterId?: string; answers?: Record<string,string>;
                    approvalToken: string; idempotencyKey: string }
apply.output    = { status: 'submitted'|'needs_manual'|'failed'; ref?: string; reason?: string }
```

### Permissions & limits
- Read tools need `jobboards.read` capability. `apply` needs ApprovalToken (`action="apply"`)
  + idempotency key (unique per company+role).
- Token-bucket rate limits per source; respect `robots`/ToS; sources individually toggleable.
- Playwright adapter runs in isolated container; on CAPTCHA/unknown form → `needs_manual`.

### Errors
`RetryableError` (429/5xx), `GuardrailError` (missing approval / duplicate apply),
`ManualInterventionError` (CAPTCHA, unmapped form fields).

## B. `linkedin-mcp` (feature-flagged, OFF by default)
- **Status:** disabled unless explicitly enabled by the operator with acknowledgment of
  LinkedIn's ToS. Prefer LinkedIn's official/partner APIs or RSS where available.
- **Scope when enabled:** read job postings only by default; applying via LinkedIn is
  **not** enabled by default due to ToS/anti-automation risk.
- **Tools (when enabled):** `linkedin.searchJobs` (read), `linkedin.getJob` (read).
- **Guardrails:** strict rate limits, human-paced, no scraping of member data, no
  connection/messaging automation. This server exists to be *correct and conservative*,
  not to maximize extraction.

### Compliance statement
This is a personal-use tool for one job seeker. It must not be used to mass-scrape,
evade bot detection, or violate any platform's terms. Where a platform disallows
automation, the corresponding adapter stays disabled and the operator applies manually
via a NEEDS_MANUAL hand-off.
