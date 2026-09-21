import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { sendTemplateToContact, MessagingError } from "@/server/messaging";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let userId: string;
let whatsappAccountId: string;

beforeAll(async () => {
  const org = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Campaign Send Test Org') RETURNING id");
  organizationId = org.rows[0]!.id;

  const user = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('campaign-send-test@example.com', 'x', 'Tester') RETURNING id"
  );
  userId = user.rows[0]!.id;
  await adminPool.query(
    "INSERT INTO organization_members (organization_id, user_id, role, joined_at) VALUES ($1, $2, 'OWNER', now())",
    [organizationId, userId]
  );

  const account = await adminPool.query<{ id: string }>(
    `INSERT INTO whatsapp_accounts (organization_id, waba_id, onboarding_type, connection_status)
     VALUES ($1, 'campaign-send-waba', 'NEW', 'CONNECTED') RETURNING id`,
    [organizationId]
  );
  whatsappAccountId = account.rows[0]!.id;
  await adminPool.query(
    `INSERT INTO whatsapp_phone_numbers (organization_id, whatsapp_account_id, phone_number_id, display_phone_number)
     VALUES ($1, $2, 'campaign-send-phone-id', '+911234500001')`,
    [organizationId, whatsappAccountId]
  );
});

afterAll(async () => {
  await adminPool.query("DELETE FROM organizations WHERE id = $1", [organizationId]);
  await adminPool.query("DELETE FROM users WHERE id = $1", [userId]);
  await adminPool.end();
});

describe("sendTemplateToContact (the per-recipient send launchCampaign uses)", () => {
  it("creates a new conversation for a contact with no prior conversation and sends", async () => {
    const contact = await adminPool.query<{ id: string }>(
      "INSERT INTO contacts (organization_id, phone_e164, name) VALUES ($1, '+919000000001', 'Campaign Target') RETURNING id",
      [organizationId]
    );
    const template = await adminPool.query<{ id: string }>(
      "INSERT INTO message_templates (organization_id, name, language, category, status) VALUES ($1, 'campaign_tpl_a', 'en', 'UTILITY', 'APPROVED') RETURNING id",
      [organizationId]
    );

    const result = await sendTemplateToContact({
      organizationId,
      userId,
      contactId: contact.rows[0]!.id,
      templateId: template.rows[0]!.id,
      idempotencyKey: "campaign-test-1",
    });
    expect(result.messageId).toBeTruthy();

    const conversation = await adminPool.query(
      "SELECT id FROM conversations WHERE organization_id = $1 AND contact_id = $2",
      [organizationId, contact.rows[0]!.id]
    );
    expect(conversation.rows).toHaveLength(1);

    const message = await adminPool.query<{ campaign_id: string | null; template_id: string }>(
      "SELECT campaign_id, template_id FROM messages WHERE id = $1",
      [result.messageId]
    );
    expect(message.rows[0]!.template_id).toBe(template.rows[0]!.id);
  });

  it("refuses to send to a suppressed contact even via a direct campaign send", async () => {
    const contact = await adminPool.query<{ id: string }>(
      "INSERT INTO contacts (organization_id, phone_e164, suppressed) VALUES ($1, '+919000000002', true) RETURNING id",
      [organizationId]
    );
    const template = await adminPool.query<{ id: string }>(
      "INSERT INTO message_templates (organization_id, name, language, category, status) VALUES ($1, 'campaign_tpl_b', 'en', 'UTILITY', 'APPROVED') RETURNING id",
      [organizationId]
    );

    await expect(
      sendTemplateToContact({
        organizationId,
        userId,
        contactId: contact.rows[0]!.id,
        templateId: template.rows[0]!.id,
        idempotencyKey: "campaign-test-2",
      })
    ).rejects.toMatchObject({ code: "CONTACT_SUPPRESSED" });
  });

  it("refuses to send an unapproved template", async () => {
    const contact = await adminPool.query<{ id: string }>(
      "INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, '+919000000003') RETURNING id",
      [organizationId]
    );
    const template = await adminPool.query<{ id: string }>(
      "INSERT INTO message_templates (organization_id, name, language, category, status) VALUES ($1, 'campaign_tpl_c', 'en', 'UTILITY', 'DRAFT') RETURNING id",
      [organizationId]
    );

    await expect(
      sendTemplateToContact({
        organizationId,
        userId,
        contactId: contact.rows[0]!.id,
        templateId: template.rows[0]!.id,
        idempotencyKey: "campaign-test-3",
      })
    ).rejects.toBeInstanceOf(MessagingError);
  });

  it("reuses an existing conversation instead of creating a duplicate one", async () => {
    const contact = await adminPool.query<{ id: string }>(
      "INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, '+919000000004') RETURNING id",
      [organizationId]
    );
    const template = await adminPool.query<{ id: string }>(
      "INSERT INTO message_templates (organization_id, name, language, category, status) VALUES ($1, 'campaign_tpl_d', 'en', 'UTILITY', 'APPROVED') RETURNING id",
      [organizationId]
    );

    await sendTemplateToContact({
      organizationId,
      userId,
      contactId: contact.rows[0]!.id,
      templateId: template.rows[0]!.id,
      idempotencyKey: "campaign-test-4a",
    });
    await sendTemplateToContact({
      organizationId,
      userId,
      contactId: contact.rows[0]!.id,
      templateId: template.rows[0]!.id,
      idempotencyKey: "campaign-test-4b",
    });

    const conversations = await adminPool.query(
      "SELECT id FROM conversations WHERE organization_id = $1 AND contact_id = $2",
      [organizationId, contact.rows[0]!.id]
    );
    expect(conversations.rows).toHaveLength(1);
  });
});
