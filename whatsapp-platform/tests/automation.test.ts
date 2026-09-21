import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { runIncomingMessageAutomations } from "@/server/automation";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let whatsappAccountId: string;
let whatsappPhoneNumberId: string;
const phoneNumberId = "automation-test-phone-" + Date.now();

async function seedConversation(): Promise<{ conversationId: string; contactId: string; contactPhone: string }> {
  const contactPhone = `+91${Math.floor(Math.random() * 1e10)}`;
  const contact = await adminPool.query<{ id: string }>(
    "INSERT INTO contacts (organization_id, phone_e164) VALUES ($1, $2) RETURNING id",
    [organizationId, contactPhone]
  );
  const conversation = await adminPool.query<{ id: string }>(
    "INSERT INTO conversations (organization_id, contact_id, whatsapp_phone_number_id, status) VALUES ($1, $2, $3, 'OPEN') RETURNING id",
    [organizationId, contact.rows[0]!.id, whatsappPhoneNumberId]
  );
  return { conversationId: conversation.rows[0]!.id, contactId: contact.rows[0]!.id, contactPhone };
}

beforeAll(async () => {
  const org = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Automation Test Org') RETURNING id");
  organizationId = org.rows[0]!.id;

  const account = await adminPool.query<{ id: string }>(
    `INSERT INTO whatsapp_accounts (organization_id, waba_id, onboarding_type, connection_status)
     VALUES ($1, 'automation-test-waba', 'NEW', 'CONNECTED') RETURNING id`,
    [organizationId]
  );
  whatsappAccountId = account.rows[0]!.id;
  const phone = await adminPool.query<{ id: string }>(
    `INSERT INTO whatsapp_phone_numbers (organization_id, whatsapp_account_id, phone_number_id, display_phone_number)
     VALUES ($1, $2, $3, '+911234500002') RETURNING id`,
    [organizationId, whatsappAccountId, phoneNumberId]
  );
  whatsappPhoneNumberId = phone.rows[0]!.id;
});

afterAll(async () => {
  await adminPool.query("DELETE FROM organizations WHERE id = $1", [organizationId]);
  await adminPool.end();
});

describe("runIncomingMessageAutomations", () => {
  it("fires a keyword_auto_reply automation when the message contains the keyword", async () => {
    await adminPool.query(
      `INSERT INTO automations (organization_id, name, trigger_type, trigger_config, actions, enabled)
       VALUES ($1, 'Price inquiry', 'keyword_auto_reply', $2, $3, true)`,
      [organizationId, JSON.stringify({ keywords: ["price", "cost"] }), JSON.stringify([{ type: "send_message", body: "Our price list is attached." }])]
    );

    const { conversationId, contactId, contactPhone } = await seedConversation();
    await runIncomingMessageAutomations({
      organizationId,
      conversationId,
      contactId,
      contactPhone,
      contactSuppressed: false,
      whatsappPhoneNumberId,
      phoneNumberId,
      messageBody: "What is the price for a 3BHK?",
      isNewContact: false,
    });

    const messages = await adminPool.query<{ content: { automated?: boolean; body?: string } }>(
      "SELECT content FROM messages WHERE conversation_id = $1 AND direction = 'OUTBOUND'",
      [conversationId]
    );
    expect(messages.rows).toHaveLength(1);
    expect(messages.rows[0]!.content.automated).toBe(true);

    const run = await adminPool.query<{ status: string }>(
      "SELECT status FROM automation_runs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1",
      [organizationId]
    );
    expect(run.rows[0]!.status).toBe("DONE");
  });

  it("does not fire when the message doesn't contain the keyword", async () => {
    const { conversationId, contactId, contactPhone } = await seedConversation();
    await runIncomingMessageAutomations({
      organizationId,
      conversationId,
      contactId,
      contactPhone,
      contactSuppressed: false,
      whatsappPhoneNumberId,
      phoneNumberId,
      messageBody: "Hello, just saying hi!",
      isNewContact: false,
    });

    const messages = await adminPool.query("SELECT id FROM messages WHERE conversation_id = $1 AND direction = 'OUTBOUND'", [
      conversationId,
    ]);
    expect(messages.rows).toHaveLength(0);
  });

  it("never fires for a suppressed contact, even if the trigger would otherwise match", async () => {
    const { conversationId, contactId, contactPhone } = await seedConversation();
    await runIncomingMessageAutomations({
      organizationId,
      conversationId,
      contactId,
      contactPhone,
      contactSuppressed: true,
      whatsappPhoneNumberId,
      phoneNumberId,
      messageBody: "What is the price?",
      isNewContact: false,
    });

    const messages = await adminPool.query("SELECT id FROM messages WHERE conversation_id = $1 AND direction = 'OUTBOUND'", [
      conversationId,
    ]);
    expect(messages.rows).toHaveLength(0);
  });

  it("does not fire a disabled automation", async () => {
    await adminPool.query(
      `INSERT INTO automations (organization_id, name, trigger_type, trigger_config, actions, enabled)
       VALUES ($1, 'Disabled welcome', 'welcome_message', '{}', $2, false)`,
      [organizationId, JSON.stringify([{ type: "send_message", body: "Welcome!" }])]
    );
    const { conversationId, contactId, contactPhone } = await seedConversation();
    await runIncomingMessageAutomations({
      organizationId,
      conversationId,
      contactId,
      contactPhone,
      contactSuppressed: false,
      whatsappPhoneNumberId,
      phoneNumberId,
      messageBody: "Hi",
      isNewContact: true,
    });

    const messages = await adminPool.query(
      "SELECT content FROM messages WHERE conversation_id = $1 AND direction = 'OUTBOUND'",
      [conversationId]
    );
    // Neither of the two org-level automations (the enabled keyword one from
    // an earlier test, nor this disabled welcome one) should fire here: the
    // message doesn't contain the keyword, and this automation is disabled.
    expect(messages.rows).toHaveLength(0);
  });
});
