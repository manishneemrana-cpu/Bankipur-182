import "server-only";
import type { PoolClient } from "pg";
import { withOrgTransaction, withPlatformAdminTransaction } from "@/server/db";
import { runIncomingMessageAutomations } from "@/server/automation";
import { deliverOutboundEvent } from "@/server/outbound-webhooks";
import type { WhatsAppInboundMessage, WhatsAppStatusUpdate, WhatsAppWebhookPayload } from "./types";

/**
 * Resolves which organization owns a phone_number_id. This runs as a
 * platform-admin transaction (not a user session) because webhook processing
 * has no organization_id yet to scope by — Meta is calling our server
 * directly, there is no authenticated user in this request at all. This
 * mirrors how organization signup (Phase 1) also had to use a platform-admin
 * transaction for the same "no tenant context exists yet" reason.
 */
async function resolveOrgForPhoneNumber(
  phoneNumberId: string
): Promise<{ organizationId: string; whatsappPhoneNumberId: string } | null> {
  return withPlatformAdminTransaction(async (client) => {
    const result = await client.query<{ organization_id: string; id: string }>(
      "SELECT organization_id, id FROM whatsapp_phone_numbers WHERE phone_number_id = $1",
      [phoneNumberId]
    );
    const row = result.rows[0];
    return row ? { organizationId: row.organization_id, whatsappPhoneNumberId: row.id } : null;
  });
}

async function upsertContact(
  organizationId: string,
  phoneE164: string,
  name: string | undefined,
  client: PoolClient
): Promise<{ contactId: string; isNew: boolean; suppressed: boolean }> {
  const result = await client.query<{ id: string; suppressed: boolean; xmax: string }>(
    `INSERT INTO contacts (organization_id, phone_e164, name, source)
     VALUES ($1, $2, $3, 'whatsapp_inbound')
     ON CONFLICT (organization_id, phone_e164)
     DO UPDATE SET name = COALESCE(contacts.name, EXCLUDED.name)
     RETURNING id, suppressed, xmax`,
    [organizationId, phoneE164, name ?? null]
  );
  const row = result.rows[0]!;
  // xmax = '0' only for a freshly inserted row (Postgres sets it on update via the DO UPDATE path).
  return { contactId: row.id, isNew: row.xmax === "0", suppressed: row.suppressed };
}

async function findOrCreateOpenConversation(
  organizationId: string,
  contactId: string,
  whatsappPhoneNumberId: string,
  client: PoolClient
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM conversations
     WHERE organization_id = $1 AND contact_id = $2 AND whatsapp_phone_number_id = $3
       AND status IN ('OPEN', 'PENDING', 'FOLLOW_UP')
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, contactId, whatsappPhoneNumberId]
  );
  if (existing.rows[0]) {
    await client.query("UPDATE conversations SET last_inbound_at = now() WHERE id = $1", [existing.rows[0].id]);
    return existing.rows[0].id;
  }

  const created = await client.query<{ id: string }>(
    `INSERT INTO conversations (organization_id, contact_id, whatsapp_phone_number_id, status, last_inbound_at)
     VALUES ($1, $2, $3, 'OPEN', now())
     RETURNING id`,
    [organizationId, contactId, whatsappPhoneNumberId]
  );
  return created.rows[0]!.id;
}

async function processInboundMessage(
  organizationId: string,
  whatsappPhoneNumberId: string,
  phoneNumberId: string,
  message: WhatsAppInboundMessage,
  contactName: string | undefined
): Promise<void> {
  if (!message.from) return;

  const automationContext = await withOrgTransaction(organizationId, async (client) => {
    const contact = await upsertContact(organizationId, message.from!, contactName, client);
    const conversationId = await findOrCreateOpenConversation(
      organizationId,
      contact.contactId,
      whatsappPhoneNumberId,
      client
    );

    await client.query(
      `INSERT INTO messages (organization_id, conversation_id, direction, type, content, meta_message_id, status, created_at)
       VALUES ($1, $2, 'INBOUND', $3, $4, $5, 'delivered', $6)`,
      [
        organizationId,
        conversationId,
        message.type ?? "text",
        JSON.stringify(message.type === "text" ? { body: message.text?.body } : { raw: message }),
        message.id ?? null,
        message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
      ]
    );

    return { conversationId, contact };
  });

  // Runs in its own transaction, after the inbound message is safely
  // recorded — an automation failure must never roll back the message itself.
  await runIncomingMessageAutomations({
    organizationId,
    conversationId: automationContext.conversationId,
    contactId: automationContext.contact.contactId,
    contactPhone: message.from,
    contactSuppressed: automationContext.contact.suppressed,
    whatsappPhoneNumberId,
    phoneNumberId,
    messageBody: message.type === "text" ? (message.text?.body ?? "") : "",
    isNewContact: automationContext.contact.isNew,
  });

  // Same reasoning: an unreachable customer webhook must never affect the
  // inbound message that was already safely recorded above.
  await deliverOutboundEvent(organizationId, "message.received", {
    conversationId: automationContext.conversationId,
    contactId: automationContext.contact.contactId,
    from: message.from,
    type: message.type ?? "text",
    body: message.type === "text" ? (message.text?.body ?? null) : null,
  });
}

async function processStatusUpdate(organizationId: string, status: WhatsAppStatusUpdate): Promise<void> {
  if (!status.id || !status.status) return;

  await withOrgTransaction(organizationId, async (client) => {
    const messageRow = await client.query<{ id: string }>(
      "SELECT id FROM messages WHERE organization_id = $1 AND meta_message_id = $2 LIMIT 1",
      [organizationId, status.id]
    );
    const messageId = messageRow.rows[0]?.id;

    if (messageId) {
      await client.query("UPDATE messages SET status = $1, updated_at = now() WHERE id = $2", [
        status.status,
        messageId,
      ]);
      await client.query(
        "INSERT INTO message_statuses (organization_id, message_id, status, raw_payload) VALUES ($1, $2, $3, $4)",
        [organizationId, messageId, status.status, JSON.stringify(status)]
      );
    }
    // If the message row isn't found (e.g. sent before this table existed, or a
    // race with the send-path insert), there's nothing to update — this is not
    // treated as an error; the raw webhook_events row still keeps the payload.
  });
}

export interface ProcessWebhookResult {
  organizationsTouched: string[];
  skippedReason?: string;
}

/** Processes one already-verified, already-deduped webhook payload. */
export async function processWhatsAppWebhook(payload: WhatsAppWebhookPayload): Promise<ProcessWebhookResult> {
  const organizationsTouched = new Set<string>();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const resolved = await resolveOrgForPhoneNumber(phoneNumberId);
      if (!resolved) continue; // Unknown phone number — nothing in our system to update yet.
      const { organizationId, whatsappPhoneNumberId } = resolved;
      organizationsTouched.add(organizationId);

      const contactName = change.value?.contacts?.[0]?.profile?.name;
      for (const message of change.value?.messages ?? []) {
        await processInboundMessage(organizationId, whatsappPhoneNumberId, phoneNumberId, message, contactName);
      }
      for (const status of change.value?.statuses ?? []) {
        await processStatusUpdate(organizationId, status);
      }
    }
  }

  return { organizationsTouched: [...organizationsTouched] };
}
