import { google, type Auth } from "googleapis";


export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  body: string;
}

/** Thin Gmail client (FR-601/604/605). Read recruiter-relevant mail + send approved replies. */
export class GmailClient {
  constructor(private readonly auth: Auth.OAuth2Client) {}

  private api() {
    return google.gmail({ version: "v1", auth: this.auth });
  }

  /** List recent messages matching a Gmail search query (default: last 14 days, in inbox). */
  async listRecent(query = "in:inbox newer_than:14d", max = 20): Promise<GmailMessage[]> {
    const list = await this.api().users.messages.list({ userId: "me", q: query, maxResults: max });
    const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
    const out: GmailMessage[] = [];
    for (const id of ids) out.push(await this.getMessage(id));
    return out;
  }

  async getMessage(id: string): Promise<GmailMessage> {
    const res = await this.api().users.messages.get({ userId: "me", id, format: "full" });
    const m = res.data;
    const headers = m.payload?.headers ?? [];
    const h = (name: string) =>
      headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
    return {
      id: m.id!,
      threadId: m.threadId!,
      from: h("From"),
      to: h("To"),
      subject: h("Subject"),
      snippet: m.snippet ?? "",
      date: h("Date"),
      body: extractBody(m.payload),
    };
  }

  /** Send a reply in-thread. The caller MUST have validated the reply target (FR-605). */
  async sendReply(args: {
    threadId: string;
    to: string;
    subject: string;
    bodyText: string;
    inReplyToMessageId: string;
  }): Promise<{ id: string }> {
    const subject = args.subject.startsWith("Re:") ? args.subject : `Re: ${args.subject}`;
    const raw = Buffer.from(
      [
        `To: ${args.to}`,
        `Subject: ${subject}`,
        `In-Reply-To: ${args.inReplyToMessageId}`,
        `References: ${args.inReplyToMessageId}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        args.bodyText,
      ].join("\r\n"),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await this.api().users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: args.threadId },
    });
    return { id: res.data.id! };
  }
}

function extractBody(payload: unknown): string {
  const p = payload as
    | { mimeType?: string; body?: { data?: string }; parts?: unknown[] }
    | undefined;
  if (!p) return "";
  if (p.body?.data) return decode(p.body.data);
  for (const part of p.parts ?? []) {
    const text = extractBody(part);
    if (text) return text;
  }
  return "";
}

function decode(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
