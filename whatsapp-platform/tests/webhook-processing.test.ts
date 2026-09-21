import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { processWhatsAppWebhook } from "@/server/webhooks/process";
import type { WhatsAppWebhookPayload } from "@/server/webhooks/types";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let whatsappAccountId: string;
let whatsappPhoneNumberId: string;
const phoneNumberId = "test-phone-number-id-" + Date.now();

beforeAll(async () => {
  const client = await adminPool.connect();
  try {
    const org = await client.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Webhook Test Org') RETURNING id");
    organizationId = org.rows[0]!.id;

    const account = await client.query<{ id: string }>(
      `INSERT INTO whatsapp_accounts (organization_id, waba_id, onboarding_type, connection_status)
       VALUES ($1, 'test-waba-id', 'NEW', 'CONNECTED') RETURNING id`,
      [organizationId]
    );
    whatsappAccountId = account.rows[0]!.id;

    const phone = await client.query<{ id: string }>(
      `INSERT INTO whatsapp_phone_numbers (organization_id, whatsapp_account_id, phone_number_id, display_phone_number)
       VALUES ($1, $2, $3, '+911234500000') RETURNING id`,
      [organizationId, whatsappAccountId, phoneNumberId]
    );
    whatsappPhoneNumberId = phone.rows[0]!.id;
  } finally {
    client.release();
  }
});

afterAll(async () => {
  const client = await adminPool.connect();
  try {
    await client.query("DELETE FROM organizations WHERE id = $1", [organizationId]);
  } finally {
    client.release();
  }
  await adminPool.end();
});

function inboundMessagePayload(overrides: Partial<{ from: string; body: string; metaMessageId: string }> = {}): WhatsAppWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test-waba-id",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: phoneNumberId, display_phone_number: "+911234500000" },
              contacts: [{ profile: { name: "Alice" }, wa_id: overrides.from ?? "+919876500000" }],
              messages: [
                {
                  id: overrides.metaMessageId ?? "wamid.test1",
                  from: overrides.from ?? "+919876500000",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: overrides.body ?? "Hi, is this available?" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("processWhatsAppWebhook — inbound messages", () => {
  it("creates a contact, an open conversation, and a message for a new inbound message", async () => {
    const result = await processWhatsAppWebhook(inboundMessagePayload({ from: "+919876500001", metaMessageId: "wamid.a" }));
    expect(result.organizationsTouched).toContain(organizationId);

    const client = await adminPool.connect();
    try {
      const contact = await client.query(
        "SELECT id, name FROM contacts WHERE organization_id = $1 AND phone_e164 = '+919876500001'",
        [organizationId]
      );
      expect(contact.rows).toHaveLength(1);
      expect(contact.rows[0].name).toBe("Alice");

      const message = await client.query(
        "SELECT direction, meta_message_id FROM messages WHERE organization_id = $1 AND meta_message_id = 'wamid.a'",
        [organizationId]
      );
      expect(message.rows).toHaveLength(1);
      expect(message.rows[0].direction).toBe("INBOUND");
    } finally {
      client.release();
    }
  });

  it("reuses the same open conversation for a second inbound message from the same contact", async () => {
    await processWhatsAppWebhook(inboundMessagePayload({ from: "+919876500002", metaMessageId: "wamid.b1" }));
    await processWhatsAppWebhook(inboundMessagePayload({ from: "+919876500002", metaMessageId: "wamid.b2" }));

    const client = await adminPool.connect();
    try {
      const conversations = await client.query(
        `SELECT c.id FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.organization_id = $1 AND ct.phone_e164 = '+919876500002'`,
        [organizationId]
      );
      expect(conversations.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it("silently ignores a webhook for an unknown phone_number_id", async () => {
    const payload = inboundMessagePayload({ from: "+919999999999" });
    payload.entry![0]!.changes![0]!.value!.metadata!.phone_number_id = "unknown-phone-number-id";
    const result = await processWhatsAppWebhook(payload);
    expect(result.organizationsTouched).toHaveLength(0);
  });
});

describe("processWhatsAppWebhook — status updates", () => {
  it("updates an existing message's status and records a message_statuses row", async () => {
    // Seed an outbound message the way the messaging service would.
    const client = await adminPool.connect();
    let conversationId: string;
    try {
      const contact = await client.query<{ id: string }>(
        `INSERT INTO contacts (organization_id, phone_e164, name) VALUES ($1, '+919876500003', 'Bob') RETURNING id`,
        [organizationId]
      );
      const conversation = await client.query<{ id: string }>(
        `INSERT INTO conversations (organization_id, contact_id, whatsapp_phone_number_id, status)
         VALUES ($1, $2, $3, 'OPEN') RETURNING id`,
        [organizationId, contact.rows[0]!.id, whatsappPhoneNumberId]
      );
      conversationId = conversation.rows[0]!.id;
      await client.query(
        `INSERT INTO messages (organization_id, conversation_id, direction, type, content, meta_message_id, status)
         VALUES ($1, $2, 'OUTBOUND', 'text', '{}', 'wamid.status-test', 'sent')`,
        [organizationId, conversationId]
      );
    } finally {
      client.release();
    }

    const statusPayload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "test-waba-id",
          changes: [
            {
              value: {
                metadata: { phone_number_id: phoneNumberId },
                statuses: [{ id: "wamid.status-test", status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)) }],
              },
            },
          ],
        },
      ],
    };

    await processWhatsAppWebhook(statusPayload);

    const verifyClient = await adminPool.connect();
    try {
      const message = await verifyClient.query(
        "SELECT status FROM messages WHERE organization_id = $1 AND meta_message_id = 'wamid.status-test'",
        [organizationId]
      );
      expect(message.rows[0].status).toBe("delivered");

      const statuses = await verifyClient.query(
        "SELECT status FROM message_statuses WHERE organization_id = $1 AND message_id = (SELECT id FROM messages WHERE meta_message_id = 'wamid.status-test')",
        [organizationId]
      );
      expect(statuses.rows).toHaveLength(1);
    } finally {
      verifyClient.release();
    }
  });
});
