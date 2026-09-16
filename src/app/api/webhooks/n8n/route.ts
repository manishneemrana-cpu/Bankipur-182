import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Best-effort, single-instance in-memory rate limit. Good enough for this
// build (no live n8n instance exists yet to actually call this endpoint at
// volume); a real production deployment behind multiple instances should
// move this to a durable/distributed store (e.g. Redis).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET;

  // Fail closed: no secret configured means no webhook can be accepted,
  // full stop. This is the expected state until n8n is actually wired up.
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-webhook-secret");
  if (!providedSecret || !timingSafeStringEqual(providedSecret, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = providedSecret;
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const timestampHeader = request.headers.get("x-webhook-timestamp");
  const timestamp = timestampHeader ? Number(timestampHeader) : NaN;
  if (!Number.isFinite(timestamp)) {
    return NextResponse.json({ error: "Missing or invalid timestamp" }, { status: 400 });
  }
  const skewMs = Math.abs(Date.now() - timestamp * 1000);
  if (skewMs > 5 * 60_000) {
    return NextResponse.json({ error: "Timestamp outside allowed window" }, { status: 400 });
  }

  const rawBody = await request.text();

  const providedSignature = request.headers.get("x-webhook-signature");
  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex");
  if (!providedSignature || !timingSafeStringEqual(providedSignature, expectedSignature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { source?: string; eventType?: string; idempotencyKey?: string; payload?: unknown };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { source, eventType, idempotencyKey, payload } = body;
  if (!source || !eventType || !idempotencyKey) {
    return NextResponse.json(
      { error: "source, eventType, and idempotencyKey are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server not configured to persist webhook events" },
      { status: 503 },
    );
  }

  const { error, data } = await admin
    .from("webhook_events")
    .insert({ source, event_type: eventType, idempotency_key: idempotencyKey, payload: payload ?? {} })
    .select("id")
    .single();

  if (error) {
    // Unique violation on (source, idempotency_key) means we already
    // processed this exact event - idempotent success, not an error.
    if (error.code === "23505") {
      return NextResponse.json({ status: "duplicate_ignored" }, { status: 200 });
    }
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }

  return NextResponse.json({ status: "accepted", id: data.id }, { status: 202 });
}
