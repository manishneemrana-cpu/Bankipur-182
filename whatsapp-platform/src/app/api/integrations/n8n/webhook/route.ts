import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey, hasScope } from "@/server/api-keys";
import { withOrgTransaction } from "@/server/db";
import { sendTemplateToContact, MessagingError } from "@/server/messaging";
import { randomUUID } from "node:crypto";

/**
 * A single endpoint dispatching by `action`, scoped API keys per action —
 * matches the brief's n8n integration section. Deliberately small: three
 * actions (contacts.upsert, leads.create, messages.sendTemplate) rather than
 * the full public API (that's Phase 10's REST surface under /api/v1/).
 */

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}
function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

const contactsUpsertSchema = z.object({
  action: z.literal("contacts.upsert"),
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  name: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
});

const leadsCreateSchema = z.object({
  action: z.literal("leads.create"),
  name: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  source: z.string().max(100).optional(),
});

const sendTemplateSchema = z.object({
  action: z.literal("messages.sendTemplate"),
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  templateId: z.string().uuid(),
});

const bodySchema = z.discriminatedUnion("action", [contactsUpsertSchema, leadsCreateSchema, sendTemplateSchema]);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!rawKey) return unauthorized("Missing Authorization: Bearer <api key> header");

  const authenticated = await authenticateApiKey(rawKey);
  if (!authenticated) return unauthorized("Invalid or revoked API key");

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const { organizationId } = authenticated;

  if (input.action === "contacts.upsert") {
    if (!hasScope(authenticated, "contacts.write")) return forbidden("API key lacks contacts.write scope");
    const result = await withOrgTransaction(organizationId, async (client) =>
      client.query<{ id: string }>(
        `INSERT INTO contacts (organization_id, phone_e164, name, tags, source)
         VALUES ($1, $2, $3, $4, 'n8n')
         ON CONFLICT (organization_id, phone_e164)
         DO UPDATE SET name = COALESCE(EXCLUDED.name, contacts.name), tags = COALESCE(EXCLUDED.tags, contacts.tags)
         RETURNING id`,
        [organizationId, input.phoneE164, input.name ?? null, input.tags ?? []]
      )
    );
    return NextResponse.json({ ok: true, contactId: result.rows[0]!.id });
  }

  if (input.action === "leads.create") {
    if (!hasScope(authenticated, "leads.write")) return forbidden("API key lacks leads.write scope");
    const result = await withOrgTransaction(organizationId, async (client) =>
      client.query<{ id: string }>(
        "INSERT INTO leads (organization_id, name, phone, source) VALUES ($1, $2, $3, $4) RETURNING id",
        [organizationId, input.name, input.phone ?? null, input.source ?? "n8n"]
      )
    );
    return NextResponse.json({ ok: true, leadId: result.rows[0]!.id });
  }

  // messages.sendTemplate
  if (!hasScope(authenticated, "whatsapp.messages.send")) return forbidden("API key lacks whatsapp.messages.send scope");
  const contact = await withOrgTransaction(organizationId, async (client) =>
    client.query<{ id: string }>(
      `INSERT INTO contacts (organization_id, phone_e164, source)
       VALUES ($1, $2, 'n8n')
       ON CONFLICT (organization_id, phone_e164) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164
       RETURNING id`,
      [organizationId, input.phoneE164]
    )
  );

  try {
    const result = await sendTemplateToContact({
      organizationId,
      userId: authenticated.apiKeyId, // no human user in this request; recorded for traceability only
      contactId: contact.rows[0]!.id,
      templateId: input.templateId,
      idempotencyKey: randomUUID(),
    });
    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    if (err instanceof MessagingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    throw err;
  }
}
