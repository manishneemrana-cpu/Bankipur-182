// No "server-only": imported from both server code (src/server/outbound-webhooks.ts)
// and client components (the webhook creation form), so it must not pull in
// anything server-only (like pg via src/server/db.ts) transitively.
export const OUTBOUND_EVENT_TYPES = ["lead.created", "message.received", "contact.created"] as const;
export type OutboundEventType = (typeof OUTBOUND_EVENT_TYPES)[number];
