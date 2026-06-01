import { z } from "zod";
import { proposeSlots, type ProposeParams } from "@jobagent/scheduler";
import { authedClientFromEnv, CalendarClient } from "@jobagent/google";
import { serve, text } from "../lib/serve";

// calendar-mcp — slot proposal works offline; with Google connected it pulls REAL busy times
// and can create events. createEvent is OUTWARD (needs an approval token).
const cclient = authedClientFromEnv();
const cal = cclient ? new CalendarClient(cclient) : null;

await serve("calendar", (s) => {
  s.registerTool(
    "calendar.proposeSlots",
    {
      title: "Propose interview slots",
      description: "Deterministic slot proposal honoring working hours/tz/buffer/lead time. Merges real calendar busy times when Google is connected.",
      inputSchema: {
        fromISO: z.string(),
        toISO: z.string(),
        durationMin: z.number().int().positive(),
        tz: z.string(),
        busy: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
        bufferMin: z.number().optional(),
        minLeadMin: z.number().optional(),
        count: z.number().optional(),
      },
    },
    async (args) => {
      const a = args as ProposeParams;
      let busy = a.busy ?? [];
      if (cal) busy = [...busy, ...(await cal.freeBusy(a.fromISO, a.toISO))];
      return text(proposeSlots({ ...a, busy }));
    },
  );
  s.registerTool(
    "calendar.createEvent",
    {
      title: "Create interview event",
      description: "Books an interview (OUTWARD — requires an approval token + Google sign-in).",
      inputSchema: {
        title: z.string(),
        startISO: z.string(),
        endISO: z.string(),
        tz: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        description: z.string().optional(),
        approvalToken: z.string(),
      },
    },
    async (a) => {
      if (!cal) return text({ status: "needs_setup", reason: "Calendar not connected — run oauth:google" });
      if (!a.approvalToken) return text({ status: "blocked", reason: "approval token required (HITL)" });
      const r = await cal.createEvent({
        summary: a.title,
        startISO: a.startISO,
        endISO: a.endISO,
        tz: a.tz ?? "Asia/Kolkata",
        attendees: a.attendees,
        description: a.description,
      });
      return text(r);
    },
  );
});
