import "server-only";
import type { PoolClient } from "pg";
import { withOrgTransaction } from "@/server/db";
import { sendTemplateMessage, sendTextMessage as sendTextViaMeta } from "@/server/meta/client";
import { isMockModeEnabled } from "@/server/mock/meta";

export type MessagingErrorCode =
  | "CONVERSATION_NOT_FOUND"
  | "CONTACT_NOT_FOUND"
  | "CONTACT_SUPPRESSED"
  | "WINDOW_CLOSED"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_NOT_APPROVED"
  | "CREDENTIALS_NOT_CONFIGURED";

export class MessagingError extends Error {
  readonly code: MessagingErrorCode;
  constructor(code: MessagingErrorCode, message: string) {
    super(message);
    this.name = "MessagingError";
    this.code = code;
  }
}

interface ConversationContext {
  contactId: string;
  contactSuppressed: boolean;
  lastInboundAt: Date | null;
  whatsappPhoneNumberId: string;
  phoneNumberId: string;
}

async function loadConversationContext(
  organizationId: string,
  conversationId: string,
  client: PoolClient
): Promise<ConversationContext> {
  const result = await client.query<{
    contact_id: string;
    suppressed: boolean;
    last_inbound_at: Date | null;
    whatsapp_phone_number_id: string;
    phone_number_id: string;
  }>(
    `SELECT c.contact_id, ct.suppressed, c.last_inbound_at, c.whatsapp_phone_number_id, p.phone_number_id
     FROM conversations c
     JOIN contacts ct ON ct.id = c.contact_id
     JOIN whatsapp_phone_numbers p ON p.id = c.whatsapp_phone_number_id
     WHERE c.organization_id = $1 AND c.id = $2`,
    [organizationId, conversationId]
  );
  const row = result.rows[0];
  if (!row) throw new MessagingError("CONVERSATION_NOT_FOUND", "Conversation not found");

  return {
    contactId: row.contact_id,
    contactSuppressed: row.suppressed,
    lastInboundAt: row.last_inbound_at,
    whatsappPhoneNumberId: row.whatsapp_phone_number_id,
    phoneNumberId: row.phone_number_id,
  };
}

/**
 * Real token decryption is not implemented yet — no organization has a real
 * whatsapp_credentials row until Phase 5 (Embedded Signup) exists to create
 * one. In mock mode this never matters since the Meta client short-circuits
 * before using the token at all.
 */
function getAccessToken(): string {
  if (isMockModeEnabled()) return "mock-token";
  throw new MessagingError(
    "CREDENTIALS_NOT_CONFIGURED",
    "Live token decryption is not implemented yet (Phase 5 deliverable)"
  );
}

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SendTextInput {
  organizationId: string;
  userId: string;
  conversationId: string;
  body: string;
  idempotencyKey: string;
}

/** Enforces contact suppression + the 24-hour free-form window, then sends and records the message. */
export async function sendConversationTextMessage(input: SendTextInput): Promise<{ messageId: string }> {
  return withOrgTransaction(input.organizationId, input.userId, async (client) => {
    const ctx = await loadConversationContext(input.organizationId, input.conversationId, client);

    if (ctx.contactSuppressed) {
      throw new MessagingError("CONTACT_SUPPRESSED", "This contact has opted out or is suppressed");
    }
    const withinWindow =
      ctx.lastInboundAt !== null && Date.now() - ctx.lastInboundAt.getTime() <= CUSTOMER_SERVICE_WINDOW_MS;
    if (!withinWindow) {
      throw new MessagingError(
        "WINDOW_CLOSED",
        "The 24-hour customer service window is closed — send an approved template instead"
      );
    }

    const contactPhone = await client.query<{ phone_e164: string }>("SELECT phone_e164 FROM contacts WHERE id = $1", [
      ctx.contactId,
    ]);

    const result = await sendTextViaMeta({
      phoneNumberId: ctx.phoneNumberId,
      accessToken: getAccessToken(),
      to: contactPhone.rows[0]!.phone_e164,
      body: input.body,
      idempotencyKey: input.idempotencyKey,
    });

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO messages (organization_id, conversation_id, direction, type, content, meta_message_id, status)
       VALUES ($1, $2, 'OUTBOUND', 'text', $3, $4, 'sent')
       RETURNING id`,
      [input.organizationId, input.conversationId, JSON.stringify({ body: input.body }), result.metaMessageId]
    );
    return { messageId: inserted.rows[0]!.id };
  });
}

export interface SendTemplateInput {
  organizationId: string;
  userId: string;
  conversationId: string;
  templateId: string;
  idempotencyKey: string;
}

/** Enforces contact suppression + template approval status, then sends and records the message. */
export async function sendConversationTemplateMessage(input: SendTemplateInput): Promise<{ messageId: string }> {
  return withOrgTransaction(input.organizationId, input.userId, async (client) => {
    const ctx = await loadConversationContext(input.organizationId, input.conversationId, client);
    if (ctx.contactSuppressed) {
      throw new MessagingError("CONTACT_SUPPRESSED", "This contact has opted out or is suppressed");
    }

    const templateResult = await client.query<{ name: string; language: string; status: string }>(
      "SELECT name, language, status FROM message_templates WHERE organization_id = $1 AND id = $2",
      [input.organizationId, input.templateId]
    );
    const template = templateResult.rows[0];
    if (!template) throw new MessagingError("TEMPLATE_NOT_FOUND", "Template not found");
    if (template.status !== "APPROVED") {
      throw new MessagingError(
        "TEMPLATE_NOT_APPROVED",
        `Template status is ${template.status}, not APPROVED — Meta has not approved this template for sending`
      );
    }

    const contactPhone = await client.query<{ phone_e164: string }>("SELECT phone_e164 FROM contacts WHERE id = $1", [
      ctx.contactId,
    ]);

    const result = await sendTemplateMessage({
      phoneNumberId: ctx.phoneNumberId,
      accessToken: getAccessToken(),
      to: contactPhone.rows[0]!.phone_e164,
      templateName: template.name,
      languageCode: template.language,
      idempotencyKey: input.idempotencyKey,
    });

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO messages (organization_id, conversation_id, direction, type, content, meta_message_id, status, template_id)
       VALUES ($1, $2, 'OUTBOUND', 'template', $3, $4, 'sent', $5)
       RETURNING id`,
      [
        input.organizationId,
        input.conversationId,
        JSON.stringify({ templateName: template.name }),
        result.metaMessageId,
        input.templateId,
      ]
    );
    return { messageId: inserted.rows[0]!.id };
  });
}

async function findOrgConnectedPhoneNumber(
  organizationId: string,
  client: PoolClient
): Promise<{ whatsappPhoneNumberId: string; phoneNumberId: string } | null> {
  const result = await client.query<{ id: string; phone_number_id: string }>(
    "SELECT id, phone_number_id FROM whatsapp_phone_numbers WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1",
    [organizationId]
  );
  const row = result.rows[0];
  return row ? { whatsappPhoneNumberId: row.id, phoneNumberId: row.phone_number_id } : null;
}

async function findOrCreateConversationForContact(
  organizationId: string,
  contactId: string,
  whatsappPhoneNumberId: string,
  client: PoolClient
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM conversations
     WHERE organization_id = $1 AND contact_id = $2 AND whatsapp_phone_number_id = $3
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, contactId, whatsappPhoneNumberId]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await client.query<{ id: string }>(
    `INSERT INTO conversations (organization_id, contact_id, whatsapp_phone_number_id, status)
     VALUES ($1, $2, $3, 'OPEN') RETURNING id`,
    [organizationId, contactId, whatsappPhoneNumberId]
  );
  return created.rows[0]!.id;
}

export interface SendTemplateToContactInput {
  organizationId: string;
  userId: string;
  contactId: string;
  templateId: string;
  campaignId?: string;
  idempotencyKey: string;
}

/**
 * Sends an approved template directly to a contact, creating a conversation
 * if one doesn't exist yet. Used by campaigns, where there may be no prior
 * inbound message and thus no existing conversation — unlike
 * sendConversationTemplateMessage, which requires one.
 */
export async function sendTemplateToContact(input: SendTemplateToContactInput): Promise<{ messageId: string }> {
  return withOrgTransaction(input.organizationId, input.userId, async (client) => {
    const contactResult = await client.query<{ phone_e164: string; suppressed: boolean }>(
      "SELECT phone_e164, suppressed FROM contacts WHERE organization_id = $1 AND id = $2",
      [input.organizationId, input.contactId]
    );
    const contact = contactResult.rows[0];
    if (!contact) throw new MessagingError("CONTACT_NOT_FOUND", "Contact not found");
    if (contact.suppressed) {
      throw new MessagingError("CONTACT_SUPPRESSED", "This contact has opted out or is suppressed");
    }

    const templateResult = await client.query<{ name: string; language: string; status: string }>(
      "SELECT name, language, status FROM message_templates WHERE organization_id = $1 AND id = $2",
      [input.organizationId, input.templateId]
    );
    const template = templateResult.rows[0];
    if (!template) throw new MessagingError("TEMPLATE_NOT_FOUND", "Template not found");
    if (template.status !== "APPROVED") {
      throw new MessagingError(
        "TEMPLATE_NOT_APPROVED",
        `Template status is ${template.status}, not APPROVED — Meta has not approved this template for sending`
      );
    }

    const phoneNumber = await findOrgConnectedPhoneNumber(input.organizationId, client);
    if (!phoneNumber) {
      throw new MessagingError("CREDENTIALS_NOT_CONFIGURED", "No WhatsApp number connected for this organization");
    }
    const conversationId = await findOrCreateConversationForContact(
      input.organizationId,
      input.contactId,
      phoneNumber.whatsappPhoneNumberId,
      client
    );

    const result = await sendTemplateMessage({
      phoneNumberId: phoneNumber.phoneNumberId,
      accessToken: getAccessToken(),
      to: contact.phone_e164,
      templateName: template.name,
      languageCode: template.language,
      idempotencyKey: input.idempotencyKey,
    });

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO messages (organization_id, conversation_id, direction, type, content, meta_message_id, status, template_id, campaign_id)
       VALUES ($1, $2, 'OUTBOUND', 'template', $3, $4, 'sent', $5, $6)
       RETURNING id`,
      [
        input.organizationId,
        conversationId,
        JSON.stringify({ templateName: template.name }),
        result.metaMessageId,
        input.templateId,
        input.campaignId ?? null,
      ]
    );
    return { messageId: inserted.rows[0]!.id };
  });
}
