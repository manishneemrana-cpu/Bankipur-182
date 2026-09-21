import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { MessagingError, sendConversationTemplateMessage, sendConversationTextMessage } from "@/server/messaging";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let userId: string;
let whatsappPhoneNumberId: string;

async function seedConversation(opts: {
  suppressed?: boolean;
  lastInboundAt?: Date | null;
}): Promise<string> {
  const client = await adminPool.connect();
  try {
    const contact = await client.query<{ id: string }>(
      `INSERT INTO contacts (organization_id, phone_e164, name, suppressed)
       VALUES ($1, $2, 'Test Contact', $3) RETURNING id`,
      [organizationId, `+91${Math.floor(Math.random() * 1e10)}`, opts.suppressed ?? false]
    );
    const conversation = await client.query<{ id: string }>(
      `INSERT INTO conversations (organization_id, contact_id, whatsapp_phone_number_id, status, last_inbound_at)
       VALUES ($1, $2, $3, 'OPEN', $4) RETURNING id`,
      [organizationId, contact.rows[0]!.id, whatsappPhoneNumberId, opts.lastInboundAt ?? null]
    );
    return conversation.rows[0]!.id;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  const client = await adminPool.connect();
  try {
    const org = await client.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Messaging Test Org') RETURNING id");
    organizationId = org.rows[0]!.id;

    const user = await client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, full_name) VALUES ('messaging-test@example.com', 'x', 'Tester') RETURNING id"
    );
    userId = user.rows[0]!.id;
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
      [organizationId, userId]
    );

    const account = await client.query<{ id: string }>(
      `INSERT INTO whatsapp_accounts (organization_id, waba_id, onboarding_type, connection_status)
       VALUES ($1, 'messaging-test-waba', 'NEW', 'CONNECTED') RETURNING id`,
      [organizationId]
    );
    const phone = await client.query<{ id: string }>(
      `INSERT INTO whatsapp_phone_numbers (organization_id, whatsapp_account_id, phone_number_id, display_phone_number)
       VALUES ($1, $2, 'messaging-test-phone-id', '+911234599999') RETURNING id`,
      [organizationId, account.rows[0]!.id]
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
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
  } finally {
    client.release();
  }
  await adminPool.end();
});

describe("sendConversationTextMessage", () => {
  it("sends (in mock mode) when the contact messaged within the last 24 hours", async () => {
    const conversationId = await seedConversation({ lastInboundAt: new Date() });
    const result = await sendConversationTextMessage({
      organizationId,
      userId,
      conversationId,
      body: "Hello!",
      idempotencyKey: "test-key-window-open",
    });
    expect(result.messageId).toBeTruthy();
  });

  it("refuses a free-form send once the 24-hour window has closed", async () => {
    const conversationId = await seedConversation({
      lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    await expect(
      sendConversationTextMessage({
        organizationId,
        userId,
        conversationId,
        body: "Hello!",
        idempotencyKey: "test-key-window-closed",
      })
    ).rejects.toMatchObject({ code: "WINDOW_CLOSED" });
  });

  it("refuses to send to a suppressed contact even within the window", async () => {
    const conversationId = await seedConversation({ suppressed: true, lastInboundAt: new Date() });
    await expect(
      sendConversationTextMessage({
        organizationId,
        userId,
        conversationId,
        body: "Hello!",
        idempotencyKey: "test-key-suppressed",
      })
    ).rejects.toMatchObject({ code: "CONTACT_SUPPRESSED" });
  });

  it("throws CONVERSATION_NOT_FOUND for a conversation in a different organization", async () => {
    const otherOrg = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Other Org') RETURNING id");
    try {
      await expect(
        sendConversationTextMessage({
          organizationId: otherOrg.rows[0]!.id,
          userId,
          conversationId: await seedConversation({ lastInboundAt: new Date() }),
          body: "Hello!",
          idempotencyKey: "test-key-cross-org",
        })
      ).rejects.toBeInstanceOf(MessagingError);
    } finally {
      await adminPool.query("DELETE FROM organizations WHERE id = $1", [otherOrg.rows[0]!.id]);
    }
  });
});

describe("sendConversationTemplateMessage", () => {
  async function createTemplate(status: "DRAFT" | "PENDING" | "APPROVED"): Promise<string> {
    const result = await adminPool.query<{ id: string }>(
      `INSERT INTO message_templates (organization_id, name, language, category, status)
       VALUES ($1, $2, 'en', 'UTILITY', $3) RETURNING id`,
      [organizationId, `template_${Date.now()}_${Math.floor(Math.random() * 1000)}`, status]
    );
    return result.rows[0]!.id;
  }

  it("sends an APPROVED template outside the 24-hour window", async () => {
    const conversationId = await seedConversation({ lastInboundAt: null });
    const templateId = await createTemplate("APPROVED");
    const result = await sendConversationTemplateMessage({
      organizationId,
      userId,
      conversationId,
      templateId,
      idempotencyKey: "test-key-template-approved",
    });
    expect(result.messageId).toBeTruthy();
  });

  it("refuses to send a template that isn't APPROVED", async () => {
    const conversationId = await seedConversation({ lastInboundAt: null });
    const templateId = await createTemplate("PENDING");
    await expect(
      sendConversationTemplateMessage({
        organizationId,
        userId,
        conversationId,
        templateId,
        idempotencyKey: "test-key-template-pending",
      })
    ).rejects.toMatchObject({ code: "TEMPLATE_NOT_APPROVED" });
  });
});
