import { childLogger } from "@jobagent/shared";
import { localParts, proposeSlots } from "@jobagent/scheduler";

/**
 * Offline demo of the deterministic slot proposer (FR-702). Uses a sample busy calendar — no
 * Google needed. In production the Calendar MCP supplies `busy`; the LLM only phrases the reply.
 *   pnpm --filter @jobagent/worker schedule:demo
 */
const log = childLogger({ component: "schedule-demo" });
const TZ = process.env.TZ_HINT ?? "Asia/Kolkata";

function main(): void {
  // A couple of existing meetings this week (UTC instants).
  const busy = [
    { start: "2026-06-01T05:00:00Z", end: "2026-06-01T06:00:00Z" }, // Mon 10:30–11:30 IST
    { start: "2026-06-02T08:30:00Z", end: "2026-06-02T09:30:00Z" }, // Tue 14:00–15:00 IST
  ];

  const slots = proposeSlots({
    fromISO: "2026-06-01T00:00:00Z",
    toISO: "2026-06-06T00:00:00Z",
    durationMin: 45,
    tz: TZ,
    busy,
    workingHours: { start: "10:00", end: "18:00" },
    bufferMin: 15,
    minLeadMin: 120,
    count: 3,
    maxPerDay: 1,
    now: "2026-06-01T00:00:00Z",
  });

  log.info({ tz: TZ, proposed: slots.length }, "proposed interview slots");
  console.log(`\nProposed interview slots (${TZ}), 45 min, avoiding 2 busy meetings:`);
  for (const s of slots) {
    const p = localParts(new Date(s.startISO).getTime(), TZ);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(s.startISO));
    console.log(`  • ${fmt} (${TZ})   [${s.startISO} → ${s.endISO}]  day#${p.weekday}`);
  }
}

main();
