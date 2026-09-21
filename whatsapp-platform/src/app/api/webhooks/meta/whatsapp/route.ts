import { NextRequest, NextResponse } from "next/server";
import { withSystemClient } from "@/server/db";
import { verifyMetaSignature } from "@/server/webhooks/verify-signature";
import { computeEventHash } from "@/server/webhooks/event-hash";
import { processWhatsAppWebhook } from "@/server/webhooks/process";
import type { WhatsAppWebhookPayload } from "@/server/webhooks/types";

/**
 * Meta's verification handshake, sent once when this URL is registered as a
 * webhook endpoint. Must echo back hub.challenge as plain text if
 * hub.verify_token matches our configured secret.
 */
export async function GET(request: NextRequest) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Receives actual webhook deliveries. Always: verify signature against the
 * raw body -> store the raw event (deduped by content hash) -> respond ->
 * process. Per the project's security checklist, signature verification is
 * never skipped "for convenience", even in mock mode — if no app secret is
 * configured, incoming deliveries are rejected with 503, not accepted
 * unverified.
 */
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_WEBHOOK_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventHash = computeEventHash(rawBody);
  const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
  const wabaId = payload.entry?.[0]?.id ?? null;

  const insertResult = await withSystemClient((client) =>
    client.query<{ id: string }>(
      `INSERT INTO webhook_events (event_hash, waba_id, phone_number_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_hash) DO NOTHING
       RETURNING id`,
      [eventHash, wabaId, phoneNumberId, payload.object ?? "unknown", JSON.stringify(payload)]
    )
  );

  const isDuplicate = insertResult.rows.length === 0;
  const eventId = insertResult.rows[0]?.id;

  // Meta expects a fast 200. There is no job queue yet (deferred to a later
  // phase per the project's "don't add infrastructure before it's needed"
  // principle), so processing runs inline here — it's cheap (DB writes only,
  // no outbound calls) and errors are caught and recorded rather than left to
  // crash the response, so a bad payload doesn't turn into a 500 that makes
  // Meta retry aggressively.
  if (!isDuplicate && eventId) {
    try {
      await processWhatsAppWebhook(payload);
      await withSystemClient((client) =>
        client.query("UPDATE webhook_events SET processed = true, processed_at = now() WHERE id = $1", [eventId])
      );
    } catch (err) {
      await withSystemClient((client) =>
        client.query("UPDATE webhook_events SET processing_error = $1 WHERE id = $2", [
          err instanceof Error ? err.message : String(err),
          eventId,
        ])
      );
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
