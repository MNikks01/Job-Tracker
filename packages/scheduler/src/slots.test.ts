import { describe, it, expect } from "vitest";
import { localParts, parseHM, proposeSlots } from "./slots";

const TZ = "Asia/Kolkata"; // UTC+5:30, no DST → deterministic

const base = {
  durationMin: 60,
  tz: TZ,
  workingHours: { start: "09:00", end: "18:00" },
  now: "2026-06-01T00:00:00Z", // Mon 05:30 IST
  fromISO: "2026-06-01T00:00:00Z",
  toISO: "2026-06-06T00:00:00Z", // through Fri/Sat IST
};

describe("proposeSlots (FR-702)", () => {
  it("returns slots inside working hours on working days", () => {
    const slots = proposeSlots({ ...base, count: 3 });
    expect(slots.length).toBe(3);
    for (const s of slots) {
      const start = localParts(new Date(s.startISO).getTime(), TZ);
      const end = localParts(new Date(s.endISO).getTime(), TZ);
      expect([1, 2, 3, 4, 5]).toContain(start.weekday); // Mon–Fri
      expect(start.minOfDay).toBeGreaterThanOrEqual(parseHM("09:00"));
      expect(end.minOfDay).toBeLessThanOrEqual(parseHM("18:00"));
      expect(start.dateKey).toBe(end.dateKey);
    }
  });

  it("honors minimum lead time", () => {
    const slots = proposeSlots({ ...base, minLeadMin: 600, count: 1 }); // 10h lead → past 09:00 IST window? 05:30+10h=15:30 IST
    const earliest = new Date(slots[0]!.startISO).getTime();
    expect(earliest).toBeGreaterThanOrEqual(new Date(base.now).getTime() + 600 * 60_000);
  });

  it("never overlaps a busy interval (incl. buffer)", () => {
    // Busy 10:00–11:00 IST Mon = 04:30–05:30 UTC... compute: 10:00 IST = 04:30 UTC.
    const busy = [{ start: "2026-06-01T04:30:00Z", end: "2026-06-01T05:30:00Z" }];
    const slots = proposeSlots({ ...base, busy, bufferMin: 15, count: 5 });
    for (const s of slots) {
      const start = new Date(s.startISO).getTime();
      const end = new Date(s.endISO).getTime();
      const bStart = new Date(busy[0]!.start).getTime() - 15 * 60_000;
      const bEnd = new Date(busy[0]!.end).getTime() + 15 * 60_000;
      expect(start < bEnd && end > bStart).toBe(false);
    }
  });

  it("spreads across days with maxPerDay", () => {
    const slots = proposeSlots({ ...base, count: 4, maxPerDay: 1 });
    const days = slots.map((s) => localParts(new Date(s.startISO).getTime(), TZ).dateKey);
    expect(new Set(days).size).toBe(days.length); // all distinct days
  });

  it("excludes weekends", () => {
    const slots = proposeSlots({
      ...base,
      now: "2026-06-05T00:00:00Z",
      fromISO: "2026-06-05T00:00:00Z", // Fri
      toISO: "2026-06-09T00:00:00Z", // through Mon (covers Sat/Sun)
      count: 10,
    });
    for (const s of slots) {
      const wd = localParts(new Date(s.startISO).getTime(), TZ).weekday;
      expect(wd).not.toBe(0); // Sun
      expect(wd).not.toBe(6); // Sat
    }
  });

  it("returns slots in chronological order within the window", () => {
    const slots = proposeSlots({ ...base, count: 3 });
    for (let i = 1; i < slots.length; i++) {
      expect(new Date(slots[i]!.startISO).getTime()).toBeGreaterThan(
        new Date(slots[i - 1]!.startISO).getTime(),
      );
    }
  });
});
