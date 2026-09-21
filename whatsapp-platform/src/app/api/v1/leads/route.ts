import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiScope } from "@/server/api/authenticate";
import { withOrgTransaction } from "@/server/db";
import { deliverOutboundEvent } from "@/server/outbound-webhooks";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  property: z.string().max(200).optional(),
  budget: z.coerce.number().nonnegative().optional(),
  source: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiScope(request, "leads.read");
  if (!auth.ok) return auth.response;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const leads = await withOrgTransaction(auth.auth.organizationId, async (client) => {
    const result = await client.query(
      "SELECT id, name, phone, property, budget, lead_status, source, created_at FROM leads ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return result.rows;
  });

  return NextResponse.json({ data: leads });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiScope(request, "leads.write");
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }
  const { name, phone, property, budget, source } = parsed.data;
  const { organizationId } = auth.auth;

  const result = await withOrgTransaction(organizationId, async (client) =>
    client.query<{ id: string }>(
      `INSERT INTO leads (organization_id, name, phone, property, budget, source)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [organizationId, name, phone ?? null, property ?? null, budget ?? null, source ?? "api"]
    )
  );
  const leadId = result.rows[0]!.id;

  await deliverOutboundEvent(organizationId, "lead.created", { leadId, name, phone: phone ?? null, source: source ?? "api" });

  return NextResponse.json({ data: { id: leadId } }, { status: 201 });
}
