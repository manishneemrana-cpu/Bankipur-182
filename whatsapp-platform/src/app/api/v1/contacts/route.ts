import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiScope } from "@/server/api/authenticate";
import { withOrgTransaction } from "@/server/db";
import { deliverOutboundEvent } from "@/server/outbound-webhooks";

const upsertSchema = z.object({
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  name: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiScope(request, "contacts.read");
  if (!auth.ok) return auth.response;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const contacts = await withOrgTransaction(auth.auth.organizationId, async (client) => {
    const result = await client.query(
      "SELECT id, phone_e164, name, tags, suppressed, created_at FROM contacts ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return result.rows;
  });

  return NextResponse.json({ data: contacts });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiScope(request, "contacts.write");
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }
  const { phoneE164, name, tags } = parsed.data;
  const { organizationId } = auth.auth;

  const result = await withOrgTransaction(organizationId, async (client) =>
    client.query<{ id: string; xmax: string }>(
      `INSERT INTO contacts (organization_id, phone_e164, name, tags, source)
       VALUES ($1, $2, $3, $4, 'api')
       ON CONFLICT (organization_id, phone_e164)
       DO UPDATE SET name = COALESCE(EXCLUDED.name, contacts.name), tags = COALESCE(EXCLUDED.tags, contacts.tags)
       RETURNING id, xmax`,
      [organizationId, phoneE164, name ?? null, tags ?? []]
    )
  );
  const row = result.rows[0]!;
  const isNew = row.xmax === "0";

  if (isNew) {
    await deliverOutboundEvent(organizationId, "contact.created", { contactId: row.id, phoneE164, name: name ?? null });
  }

  return NextResponse.json({ data: { id: row.id } }, { status: isNew ? 201 : 200 });
}
