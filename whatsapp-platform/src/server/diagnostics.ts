import "server-only";
import { withSystemClient, withPlatformAdminTransaction } from "@/server/db";
import { getEnv } from "@/server/env";
import { getMetaConnectionStatus } from "@/server/meta/status";

export interface SystemDiagnostics {
  database: "ok" | "error";
  mockMeta: boolean;
  mockPayments: boolean;
  meta: { mockMode: boolean; configured: boolean; missingVars: string[] };
  migrations: { applied: string[]; count: number };
  counts: { organizations: number; users: number };
  webhookEvents: { last24h: number };
  outboundWebhookDeliveries: { last24hSucceeded: number; last24hFailed: number };
}

/** Platform-admin-only diagnostics for the admin System Health page. */
export async function getSystemDiagnostics(): Promise<SystemDiagnostics> {
  const env = getEnv();
  const meta = getMetaConnectionStatus();

  let database: "ok" | "error" = "error";
  try {
    await withSystemClient((client) => client.query("SELECT 1"));
    database = "ok";
  } catch {
    database = "error";
  }

  const { migrations, counts, webhookEvents, deliveries } = await withPlatformAdminTransaction(async (client) => {
    const migrationsRes = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename"
    );
    const orgCountRes = await client.query<{ count: string }>("SELECT count(*) FROM organizations");
    const userCountRes = await client.query<{ count: string }>("SELECT count(*) FROM users");
    const webhookEventsRes = await client.query<{ count: string }>(
      "SELECT count(*) FROM webhook_events WHERE created_at > now() - interval '24 hours'"
    );
    const deliveriesRes = await client.query<{ succeeded: string; failed: string }>(
      `SELECT
         count(*) FILTER (WHERE status_code IS NOT NULL AND status_code < 400) AS succeeded,
         count(*) FILTER (WHERE status_code IS NULL OR status_code >= 400) AS failed
       FROM outbound_webhook_deliveries WHERE created_at > now() - interval '24 hours'`
    );
    return {
      migrations: { applied: migrationsRes.rows.map((r) => r.filename), count: migrationsRes.rows.length },
      counts: { organizations: Number(orgCountRes.rows[0]!.count), users: Number(userCountRes.rows[0]!.count) },
      webhookEvents: { last24h: Number(webhookEventsRes.rows[0]!.count) },
      deliveries: {
        last24hSucceeded: Number(deliveriesRes.rows[0]!.succeeded),
        last24hFailed: Number(deliveriesRes.rows[0]!.failed),
      },
    };
  });

  return {
    database,
    mockMeta: env.MOCK_META,
    mockPayments: env.MOCK_PAYMENTS,
    meta: { mockMode: meta.mockMode, configured: meta.configured, missingVars: meta.missingVars },
    migrations,
    counts,
    webhookEvents,
    outboundWebhookDeliveries: deliveries,
  };
}
