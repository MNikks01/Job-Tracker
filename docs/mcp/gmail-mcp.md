# MCP Server — Gmail

> Phase 5 · Status: Draft v0.1 · 2026-05-30

## Purpose
Read recruiter-relevant mail, create drafts, and send replies (gated by approval).

## Tools
| Tool | Type | Description |
|------|------|-------------|
| `gmail.listMessages` | read | List messages by query/labels since a cursor |
| `gmail.getMessage` | read | Fetch a message (headers + body) |
| `gmail.getThread` | read | Fetch a full thread |
| `gmail.createDraft` | mutate(internal) | Create a draft reply (no send) |
| `gmail.sendReply` | mutate(outward) | Send a reply in-thread (**approval required**) |
| `gmail.modifyLabels` | mutate(internal) | Add/remove labels (e.g., "tracked") |

## Schemas (zod-style)
```ts
listMessages.input  = { query?: string; labelIds?: string[]; sinceCursor?: string; max?: number }
listMessages.output = { messages: {id,threadId,snippet,from,subject,date}[]; nextCursor?: string }

getMessage.input    = { id: string }
getMessage.output   = { id,threadId,from,to,subject,date,bodyText,bodyHtml?,headers }

sendReply.input     = { threadId: string; to: string; subject: string; bodyText: string;
                        inReplyToMessageId: string; approvalToken: string }
sendReply.output    = { sentMessageId: string }
```

## Permissions
- Scopes (Google): `gmail.readonly` (or `gmail.metadata` + selective body), `gmail.send`,
  `gmail.modify` (labels only). No delete scope.
- Capability: `gmail` (read tools); `sendReply` requires read capability **+** ApprovalToken
  whose `action="reply"` and `opportunityId` matches.
- `sendReply` runs a **recipient + thread validation** (must equal source message) before send.

## Rate limits
- Respect Gmail API quota (per-user rate). Token bucket: e.g., 20 req/s soft, backoff on 429.
- Polling interval configurable (`inboxPollSec`, default 120s).

## Errors
- `RetryableError`: 429/5xx/network.
- `GuardrailError`: recipient/thread mismatch, missing/expired approval token.
- `ManualInterventionError`: ambiguous thread linkage.

## Audit
`sendReply`, `createDraft`, `modifyLabels` emit audit events. Bodies hashed (not stored in
plaintext audit). Tokens never logged.
