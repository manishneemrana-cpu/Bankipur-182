import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { createHmac } from "node:crypto";
import {
  createOutboundWebhook,
  listOutboundWebhooks,
  toggleOutboundWebhook,
  deleteOutboundWebhook,
  deliverOutboundEvent,
} from "@/server/outbound-webhooks";
import { withPlatformAdminTransaction } from "@/server/db";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let userId: string;

beforeAll(async () => {
  const org = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Outbound Webhook Test Org') RETURNING id");
  organizationId = org.rows[0]!.id;
  const user = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('outbound-webhook-test@example.com', 'x', 'Tester') RETURNING id"
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("outbound webhooks CRUD", () => {
  it("creates, lists, toggles, and deletes a webhook", async () => {
    const created = await createOutboundWebhook(organizationId, userId, "https://example.com/hook", ["lead.created"]);
    expect(created.secret).toHaveLength(48);

    let webhooks = await listOutboundWebhooks(organizationId);
    expect(webhooks.find((w) => w.id === created.id)?.enabled).toBe(true);

    await toggleOutboundWebhook(organizationId, userId, created.id);
    webhooks = await listOutboundWebhooks(organizationId);
    expect(webhooks.find((w) => w.id === created.id)?.enabled).toBe(false);

    await deleteOutboundWebhook(organizationId, userId, created.id);
    webhooks = await listOutboundWebhooks(organizationId);
    expect(webhooks.find((w) => w.id === created.id)).toBeUndefined();
  });
});

describe("outbound event delivery", () => {
  it("signs the payload with the webhook's secret and records a successful delivery", async () => {
    const created = await createOutboundWebhook(organizationId, userId, "https://example.com/hook-success", ["lead.created"]);

    let capturedBody = "";
    let capturedSignature = "";
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      capturedSignature = (init.headers as Record<string, string>)["X-Webhook-Signature"] ?? "";
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await deliverOutboundEvent(organizationId, "lead.created", { leadId: "lead-1", name: "Test Lead" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const expectedSignature = createHmac("sha256", created.secret).update(capturedBody, "utf8").digest("hex");
    expect(capturedSignature).toBe(expectedSignature);
    expect(JSON.parse(capturedBody).payload).toEqual({ leadId: "lead-1", name: "Test Lead" });

    const deliveries = await adminPool.query<{ status_code: number; attempts: number }>(
      "SELECT status_code, attempts FROM outbound_webhook_deliveries WHERE outbound_webhook_id = $1",
      [created.id]
    );
    expect(deliveries.rows).toHaveLength(1);
    expect(deliveries.rows[0]!.status_code).toBe(200);
    expect(deliveries.rows[0]!.attempts).toBe(1);
  });

  it("records a failed delivery (status_code null) without throwing when the endpoint is unreachable", async () => {
    const created = await createOutboundWebhook(organizationId, userId, "https://example.com/hook-fail", ["lead.created"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error");
      })
    );

    await expect(deliverOutboundEvent(organizationId, "lead.created", { leadId: "lead-2" })).resolves.toBeUndefined();

    const deliveries = await adminPool.query<{ status_code: number | null }>(
      "SELECT status_code FROM outbound_webhook_deliveries WHERE outbound_webhook_id = $1",
      [created.id]
    );
    expect(deliveries.rows).toHaveLength(1);
    expect(deliveries.rows[0]!.status_code).toBeNull();
  });

  it("does not deliver to a webhook not subscribed to the event type, or a disabled one", async () => {
    const notSubscribed = await createOutboundWebhook(organizationId, userId, "https://example.com/hook-other-event", [
      "contact.created",
    ]);
    const disabled = await createOutboundWebhook(organizationId, userId, "https://example.com/hook-disabled", [
      "lead.created",
    ]);
    await toggleOutboundWebhook(organizationId, userId, disabled.id);

    const fetchMock = vi.fn(async (_url: string) => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await deliverOutboundEvent(organizationId, "lead.created", { leadId: "lead-3" });

    const calledUrls = fetchMock.mock.calls.map((call) => call[0]);
    expect(calledUrls).not.toContain("https://example.com/hook-other-event");
    expect(calledUrls).not.toContain("https://example.com/hook-disabled");
    const deliveries = await adminPool.query(
      "SELECT id FROM outbound_webhook_deliveries WHERE outbound_webhook_id IN ($1, $2)",
      [notSubscribed.id, disabled.id]
    );
    expect(deliveries.rows).toHaveLength(0);
  });
});
