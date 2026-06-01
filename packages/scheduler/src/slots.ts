/**
 * Deterministic interview slot proposal (FR-701/702). PURE — no Google Calendar dependency
 * (the Calendar MCP supplies `busy`; the LLM only phrases the proposal). Honors working
 * hours/days in the recruiter's IANA timezone, a buffer around existing meetings, a minimum
 * lead time, no double-booking, and a per-day cap.
 */
export interface Interval {
  start: string; // ISO
  end: string; // ISO
}
export interface Slot {
  startISO: string;
  endISO: string;
}

export interface ProposeParams {
  fromISO: string;
  toISO: string;
  durationMin: number;
  tz: string; // IANA, e.g. "Asia/Kolkata"
  busy?: Interval[];
  workingHours?: { start: string; end: string }; // "HH:MM", default 09:00–18:00
  workingDays?: number[]; // 0=Sun..6=Sat, default Mon–Fri
  bufferMin?: number; // gap around existing meetings, default 15
  minLeadMin?: number; // earliest from now, default 120
  slotStepMin?: number; // granularity, default 30
  count?: number; // how many to return, default 3
  maxPerDay?: number; // spread across days, default 2
  now?: string; // injectable for tests
}

const WD_MON_TO_FRI = [1, 2, 3, 4, 5];

export function proposeSlots(p: ProposeParams): Slot[] {
  const durationMs = p.durationMin * 60_000;
  const stepMs = (p.slotStepMin ?? 30) * 60_000;
  const bufferMs = (p.bufferMin ?? 15) * 60_000;
  const minLeadMs = (p.minLeadMin ?? 120) * 60_000;
  const count = p.count ?? 3;
  const maxPerDay = p.maxPerDay ?? 2;
  const workStart = parseHM(p.workingHours?.start ?? "09:00");
  const workEnd = parseHM(p.workingHours?.end ?? "18:00");
  const workingDays = p.workingDays ?? WD_MON_TO_FRI;

  const nowMs = new Date(p.now ?? new Date().toISOString()).getTime();
  const fromMs = new Date(p.fromISO).getTime();
  const toMs = new Date(p.toISO).getTime();

  const busy = (p.busy ?? []).map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  // Earliest acceptable start, aligned up to the slot grid.
  let t = Math.max(fromMs, nowMs + minLeadMs);
  t = Math.ceil(t / stepMs) * stepMs;

  const slots: Slot[] = [];
  const perDay = new Map<string, number>();

  for (; t + durationMs <= toMs; t += stepMs) {
    const startLocal = localParts(t, p.tz);
    const endLocal = localParts(t + durationMs, p.tz);

    // Within a single working day + within working hours.
    if (!workingDays.includes(startLocal.weekday)) continue;
    if (startLocal.dateKey !== endLocal.dateKey) continue;
    if (startLocal.minOfDay < workStart) continue;
    if (endLocal.minOfDay > workEnd) continue;

    // Per-day cap (spread proposals across days).
    if ((perDay.get(startLocal.dateKey) ?? 0) >= maxPerDay) continue;

    // No overlap with busy (expanded by buffer on both sides).
    if (overlapsBusy(t, t + durationMs, busy, bufferMs)) continue;

    slots.push({ startISO: new Date(t).toISOString(), endISO: new Date(t + durationMs).toISOString() });
    perDay.set(startLocal.dateKey, (perDay.get(startLocal.dateKey) ?? 0) + 1);
    if (slots.length >= count) break;
  }

  return slots;
}

function overlapsBusy(
  start: number,
  end: number,
  busy: { start: number; end: number }[],
  bufferMs: number,
): boolean {
  return busy.some((b) => start < b.end + bufferMs && end > b.start - bufferMs);
}

export function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local wall-clock parts for a UTC instant in an IANA timezone (DST-correct via Intl). */
export function localParts(ms: number, tz: string): { weekday: number; minOfDay: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    weekday: WD[get("weekday")] ?? 0,
    minOfDay: hour * 60 + minute,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}
