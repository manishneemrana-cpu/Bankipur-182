import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireApiScope } from "@/server/api/authenticate";
import { withOrgTransaction } from "@/server/db";
import { sendTemplateToContact, MessagingError } from "@/server/messaging";

const sendSchema = z.object({
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  templateId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiScope(request, "whatsapp.messages.send");
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }
  const { phoneE164, templateId } = parsed.data;
  const { organizationId, apiKeyId } = auth.auth;

  const contact = await withOrgTransaction(organizationId, async (client) =>
    client.query<{ id: string }>(
      `INSERT INTO contacts (organization_id, phone_e164, source)
       VALUES ($1, $2, 'api')
       ON CONFLICT (organization_id, phone_e164) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164
       RETURNING id`,
      [organizationId, phoneE164]
    )
  );

  try {
    const result = await sendTemplateToContact({
      organizationId,
      userId: apiKeyId, // no human user in this request; recorded for traceability only
      contactId: contact.rows[0]!.id,
      templateId,
      idempotencyKey: randomUUID(),
    });
    return NextResponse.json({ data: { messageId: result.messageId } }, { status: 201 });
  } catch (err) {
    if (err instanceof MessagingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    throw err;
  }
}
