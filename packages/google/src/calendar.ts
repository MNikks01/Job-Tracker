import { google, type Auth } from "googleapis";


export interface BusyInterval {
  start: string;
  end: string;
}

/** Thin Google Calendar client (FR-701/703). Read availability + create interview events. */
export class CalendarClient {
  constructor(private readonly auth: Auth.OAuth2Client) {}

  private api() {
    return google.calendar({ version: "v3", auth: this.auth });
  }

  /** Busy intervals on the primary calendar within a window (feeds the slot proposer). */
  async freeBusy(fromISO: string, toISO: string): Promise<BusyInterval[]> {
    const res = await this.api().freebusy.query({
      requestBody: { timeMin: fromISO, timeMax: toISO, items: [{ id: "primary" }] },
    });
    const busy = res.data.calendars?.primary?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: b.start!, end: b.end! }));
  }

  /** Create an interview event (OUTWARD — caller must hold a valid approval token). */
  async createEvent(args: {
    summary: string;
    startISO: string;
    endISO: string;
    tz: string;
    attendees?: string[];
    description?: string;
  }): Promise<{ id: string; htmlLink: string }> {
    const res = await this.api().events.insert({
      calendarId: "primary",
      requestBody: {
        summary: args.summary,
        description: args.description,
        start: { dateTime: args.startISO, timeZone: args.tz },
        end: { dateTime: args.endISO, timeZone: args.tz },
        attendees: (args.attendees ?? []).map((email) => ({ email })),
      },
    });
    return { id: res.data.id!, htmlLink: res.data.htmlLink ?? "" };
  }
}
