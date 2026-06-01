/**
 * Reply-target validation (FR-605, AC-E2). Before any send, the drafted reply must match the
 * source message: same thread, replying to the sender, in-reply-to the source message. A
 * mismatch blocks the send — this is the guardrail that makes "0 mis-sent messages" enforceable.
 */
export interface SourceMessage {
  threadId: string;
  messageId: string;
  fromAddr: string;
}

export interface DraftReply {
  threadId: string;
  to: string;
  inReplyToMessageId: string;
}

export type ReplyValidation = { ok: true } | { ok: false; reason: string };

export function validateReplyTarget(source: SourceMessage, draft: DraftReply): ReplyValidation {
  if (normalizeEmail(draft.to) !== normalizeEmail(source.fromAddr)) {
    return { ok: false, reason: `recipient ${draft.to} != source sender ${source.fromAddr}` };
  }
  if (draft.threadId !== source.threadId) {
    return { ok: false, reason: `thread ${draft.threadId} != source thread ${source.threadId}` };
  }
  if (draft.inReplyToMessageId !== source.messageId) {
    return { ok: false, reason: `in-reply-to ${draft.inReplyToMessageId} != source message ${source.messageId}` };
  }
  return { ok: true };
}

/** Extract a bare address from a possibly display-name-wrapped header value. */
export function normalizeEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1]! : addr).trim().toLowerCase();
}
