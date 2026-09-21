import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getWebhookHealth } from "@/server/webhook-health";
import { withPlatformAdminTransaction, withOrgTransaction } from "@/server/db";
import { createOutboundWebhook, deliverOutboundEvent } from "@/server/outbound-webhooks";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let userId: string;

beforeAll(async () => {
  const org = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Webhook Health Test Org') RETURNING id");
  organizationId = org.rows[0]!.id;
  const user = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('webhook-health-test@example.com', 'x', 'Tester') RETURNING id"
  );
  userId = user.rows[0]!.id;
  await adminPool.query(
    "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
    [organizationId, userId]
  );
});

afterAll(async () => {
  await withPlatformAdminTransaction((client) => client.query("DELETE FROM organizations WHERE id = $1", [organizationId]));
  await adminPool.query("DELETE FROM users WHERE id = $1", [userId]);
  await adminPool.end();
});

describe("webhook health (admin cross-org view)", () => {
  it("includes a recorded inbound webhook_events row with its organization name", async () => {
    await withPlatformAdminTransaction((client) =>
      client.query(
        "INSERT INTO webhook_events (event_hash, organization_id, event_type, payload, processed) VALUES ($1, $2, 'test.inbound', '{}', true)",
        [`health-test-${Date.now()}`, organizationId]
      )
    );

    const health = await getWebhookHealth();
    expect(health.inbound.recent.some((e) => e.organizationName === "Webhook Health Test Org" && e.eventType === "test.inbound")).toBe(
      true
    );
  });

  it("reports a failed inbound event distinctly from a processed one", async () => {
    await withPlatformAdminTransaction((client) =>
      client.query(
        "INSERT INTO webhook_events (event_hash, organization_id, event_type, payload, processed, processing_error) VALUES ($1, $2, 'test.failed', '{}', false, 'boom')",
        [`health-test-fail-${Date.now()}`, organizationId]
      )
    );

    const health = await getWebhookHealth();
    const failedEvent = health.inbound.recent.find((e) => e.eventType === "test.failed");
    expect(failedEvent?.processingError).toBe("boom");
  });

  it("includes an outbound delivery with its organization name and URL", async () => {
    const webhook = await createOutboundWebhook(organizationId, userId, "https://example.com/health-test-hook", ["lead.created"]);
    await withOrgTransaction(organizationId, userId, (client) =>
      client.query(
        "INSERT INTO outbound_webhook_deliveries (organization_id, outbound_webhook_id, event_type, payload, status_code, attempts) VALUES ($1, $2, 'lead.created', '{}', 200, 1)",
        [organizationId, webhook.id]
      )
    );

    const health = await getWebhookHealth();
    const delivery = health.outbound.recent.find((d) => d.url === "https://example.com/health-test-hook");
    expect(delivery?.organizationName).toBe("Webhook Health Test Org");
    expect(delivery?.statusCode).toBe(200);
  });

  it("counts an unreachable delivery (null status_code) as failed", async () => {
    // Reuses deliverOutboundEvent with an unmocked global fetch pointed at a URL that will fail
    // to connect, exercising the real failure path end-to-end rather than inserting a row directly.
    await createOutboundWebhook(organizationId, userId, "http://127.0.0.1:1/unreachable", ["contact.created"]);
    await deliverOutboundEvent(organizationId, "contact.created", { test: true });

    const health = await getWebhookHealth();
    const delivery = health.outbound.recent.find((d) => d.url === "http://127.0.0.1:1/unreachable");
    expect(delivery?.statusCode).toBeNull();
  });
});
