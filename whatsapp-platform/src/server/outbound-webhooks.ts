import "server-only";
import { randomBytes, createHmac } from "node:crypto";
import { withOrgTransaction } from "@/server/db";
import { OUTBOUND_EVENT_TYPES, type OutboundEventType } from "@/shared/outbound-webhook-events";

export { OUTBOUND_EVENT_TYPES, type OutboundEventType };

export interface OutboundWebhook {
  id: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  createdAt: string;
}

export async function createOutboundWebhook(
  organizationId: string,
  userId: string,
  url: string,
  eventTypes: OutboundEventType[]
): Promise<{ id: string; secret: string }> {
  const secret = randomBytes(24).toString("hex");
  const result = await withOrgTransaction(organizationId, userId, (client) =>
    client.query<{ id: string }>(
      "INSERT INTO outbound_webhooks (organization_id, url, secret, event_types) VALUES ($1, $2, $3, $4) RETURNING id",
      [organizationId, url, secret, eventTypes]
    )
  );
  return { id: result.rows[0]!.id, secret };
}

export async function listOutboundWebhooks(organizationId: string): Promise<OutboundWebhook[]> {
  return withOrgTransaction(organizationId, async (client) => {
    const result = await client.query<{
      id: string;
      url: string;
      event_types: string[];
      enabled: boolean;
      created_at: string;
    }>("SELECT id, url, event_types, enabled, created_at FROM outbound_webhooks ORDER BY created_at DESC");
    return result.rows.map((r) => ({
      id: r.id,
      url: r.url,
      eventTypes: r.event_types,
      enabled: r.enabled,
      createdAt: r.created_at,
    }));
  });
}

export async function toggleOutboundWebhook(organizationId: string, userId: string, webhookId: string): Promise<void> {
  await withOrgTransaction(organizationId, userId, (client) =>
    client.query("UPDATE outbound_webhooks SET enabled = NOT enabled WHERE organization_id = $1 AND id = $2", [
      organizationId,
      webhookId,
    ])
  );
}

export async function deleteOutboundWebhook(organizationId: string, userId: string, webhookId: string): Promise<void> {
  await withOrgTransaction(organizationId, userId, (client) =>
    client.query("DELETE FROM outbound_webhooks WHERE organization_id = $1 AND id = $2", [organizationId, webhookId])
  );
}

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * Delivers `eventType` to every enabled outbound_webhooks row subscribed to
 * it, HMAC-signing the body (X-Webhook-Signature header, same sha256-hex
 * scheme documented for consumers to verify) and recording one delivery row
 * per attempt. This is a single synchronous attempt, not a retrying job
 * queue — a slow or unreachable customer endpoint delays whatever request
 * triggered the event. A retry worker is future work (see docs/webhooks.md);
 * failures here are recorded (status_code null, attempts 1) but never
 * thrown, so a broken customer webhook can't break the triggering action.
 */
export async function deliverOutboundEvent(
  organizationId: string,
  eventType: OutboundEventType,
  payload: Record<string, unknown>
): Promise<void> {
  await withOrgTransaction(organizationId, async (client) => {
    const webhooksRes = await client.query<{ id: string; url: string; secret: string }>(
      "SELECT id, url, secret FROM outbound_webhooks WHERE enabled = true AND $1 = ANY(event_types)",
      [eventType]
    );

    for (const webhook of webhooksRes.rows) {
      const body = JSON.stringify({ eventType, organizationId, payload, sentAt: new Date().toISOString() });
      const signature = signPayload(webhook.secret, body);

      let statusCode: number | null = null;
      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
          body,
          signal: AbortSignal.timeout(5000),
        });
        statusCode = response.status;
      } catch {
        statusCode = null; // unreachable / timed out — recorded below, never thrown
      }

      await client.query(
        `INSERT INTO outbound_webhook_deliveries (organization_id, outbound_webhook_id, event_type, payload, status_code, attempts, delivered_at)
         VALUES ($1, $2, $3, $4, $5::integer, 1, CASE WHEN $5::integer IS NOT NULL THEN now() ELSE NULL END)`,
        [organizationId, webhook.id, eventType, JSON.stringify(payload), statusCode]
      );
    }
  });
}
