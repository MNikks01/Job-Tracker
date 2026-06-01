# MCP Server — Calendar

> Phase 5 · Status: Draft v0.1 · 2026-05-30

## Purpose
Read availability and create interview events (gated by approval).

## Tools
| Tool | Type | Description |
|------|------|-------------|
| `calendar.getAvailability` | read | Free/busy within a window |
| `calendar.proposeSlots` | read(compute) | Deterministic candidate slots honoring constraints |
| `calendar.createEvent` | mutate(outward) | Create event (**approval required**) |
| `calendar.updateEvent` | mutate(outward) | Reschedule (**approval required**) |

## Schemas
```ts
getAvailability.input  = { fromISO: string; toISO: string; tz: string }
getAvailability.output = { busy: {startISO,endISO}[] }

proposeSlots.input  = { fromISO,toISO,tz, durationMin: number,
                        workingHours: {start:string,end:string}, bufferMin: number, count: number }
proposeSlots.output = { slots: {startISO,endISO}[] }

createEvent.input   = { title,startISO,endISO,tz, attendees: string[],
                        description?: string, conferencing?: boolean, approvalToken: string }
createEvent.output  = { eventId: string; htmlLink: string }
```

## Permissions
- Scope: `calendar.events` (read/write own calendar) + `calendar.readonly` for freebusy.
- `createEvent`/`updateEvent` require ApprovalToken (`action="schedule"`).

## Rate limits
- Token bucket per Google quota; backoff on 429. Slot computation is local (no quota).

## Constraints enforced (deterministic, in code)
- Working hours, buffers between meetings, time zone correctness, no double-booking,
  minimum lead time. LLM only phrases the proposal text.

## Errors
- `RetryableError` (429/5xx), `GuardrailError` (missing approval), `ManualInterventionError`
  (no mutual availability).

## Audit
`createEvent`/`updateEvent` audited (event id, slot, attendees-hash).
