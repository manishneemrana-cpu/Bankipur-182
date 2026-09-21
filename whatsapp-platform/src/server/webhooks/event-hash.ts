import "server-only";
import { createHash } from "node:crypto";

/** Dedup key for webhook_events.event_hash — a plain content hash of the raw delivery body. */
export function computeEventHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
