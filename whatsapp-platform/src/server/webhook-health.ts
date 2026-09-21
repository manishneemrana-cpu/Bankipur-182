import "server-only";
import { withPlatformAdminTransaction } from "@/server/db";

export interface InboundWebhookEvent {
  id: string;
  organizationName: string | null;
  eventType: string;
  processed: boolean;
  processingError: string | null;
  createdAt: string;
}

export interface OutboundWebhookDelivery {
  id: string;
  organizationName: string | null;
  url: string;
  eventType: string;
  statusCode: number | null;
  createdAt: string;
}

export interface WebhookHealth {
  inbound: { recent: InboundWebhookEvent[]; failedLast24h: number; processedLast24h: number };
  outbound: { recent: OutboundWebhookDelivery[]; failedLast24h: number; succeededLast24h: number };
}

/** Platform-admin-only cross-organization webhook health for /admin/webhooks. */
export async function getWebhookHealth(): Promise<WebhookHealth> {
  return withPlatformAdminTransaction(async (client) => {
    const inboundRecentRes = await client.query<{
      id: string;
      organization_name: string | null;
      event_type: string;
      processed: boolean;
      processing_error: string | null;
      created_at: string;
    }>(
      `SELECT e.id, o.name AS organization_name, e.event_type, e.processed, e.processing_error, e.created_at
       FROM webhook_events e LEFT JOIN organizations o ON o.id = e.organization_id
       ORDER BY e.created_at DESC LIMIT 50`
    );
    const inboundCountsRes = await client.query<{ processed: string; failed: string }>(
      `SELECT
         count(*) FILTER (WHERE processed = true AND processing_error IS NULL) AS processed,
         count(*) FILTER (WHERE processing_error IS NOT NULL) AS failed
       FROM webhook_events WHERE created_at > now() - interval '24 hours'`
    );

    const outboundRecentRes = await client.query<{
      id: string;
      organization_name: string | null;
      url: string;
      event_type: string;
      status_code: number | null;
      created_at: string;
    }>(
      `SELECT d.id, o.name AS organization_name, w.url, d.event_type, d.status_code, d.created_at
       FROM outbound_webhook_deliveries d
       LEFT JOIN organizations o ON o.id = d.organization_id
       LEFT JOIN outbound_webhooks w ON w.id = d.outbound_webhook_id
       ORDER BY d.created_at DESC LIMIT 50`
    );
    const outboundCountsRes = await client.query<{ succeeded: string; failed: string }>(
      `SELECT
         count(*) FILTER (WHERE status_code IS NOT NULL AND status_code < 400) AS succeeded,
         count(*) FILTER (WHERE status_code IS NULL OR status_code >= 400) AS failed
       FROM outbound_webhook_deliveries WHERE created_at > now() - interval '24 hours'`
    );

    return {
      inbound: {
        recent: inboundRecentRes.rows.map((r) => ({
          id: r.id,
          organizationName: r.organization_name,
          eventType: r.event_type,
          processed: r.processed,
          processingError: r.processing_error,
          createdAt: r.created_at,
        })),
        processedLast24h: Number(inboundCountsRes.rows[0]!.processed),
        failedLast24h: Number(inboundCountsRes.rows[0]!.failed),
      },
      outbound: {
        recent: outboundRecentRes.rows.map((r) => ({
          id: r.id,
          organizationName: r.organization_name,
          url: r.url,
          eventType: r.event_type,
          statusCode: r.status_code,
          createdAt: r.created_at,
        })),
        succeededLast24h: Number(outboundCountsRes.rows[0]!.succeeded),
        failedLast24h: Number(outboundCountsRes.rows[0]!.failed),
      },
    };
  });
}
