"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { withOrgTransaction } from "@/server/db";
import { deliverOutboundEvent } from "@/server/outbound-webhooks";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "FOLLOW_UP",
  "SITE_VISIT",
  "NEGOTIATION",
  "BOOKED",
  "WON",
  "LOST",
] as const;

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(20).optional(),
  property: z.string().trim().max(200).optional(),
  budget: z.coerce.number().nonnegative().optional(),
});

export async function createLead(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, name, phone, property, budget } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_contacts")) {
    return { ok: false, error: "You don't have permission to manage leads" };
  }

  const created = await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query<{ id: string }>(
      `INSERT INTO leads (organization_id, name, phone, property, budget, source)
       VALUES ($1, $2, $3, $4, $5, 'manual') RETURNING id`,
      [organizationId, name, phone || null, property || null, budget ?? null]
    )
  );

  await deliverOutboundEvent(organizationId, "lead.created", {
    leadId: created.rows[0]!.id,
    name,
    phone: phone || null,
    source: "manual",
  });

  revalidatePath("/dashboard/leads");
  return { ok: true };
}

const updateStatusSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
});

export async function updateLeadStatus(input: unknown): Promise<ActionResult> {
  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, leadId, status } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_contacts")) {
    return { ok: false, error: "You don't have permission to manage leads" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query(
      "UPDATE leads SET lead_status = $1, last_contacted_at = CASE WHEN $1 != 'NEW' THEN now() ELSE last_contacted_at END WHERE organization_id = $2 AND id = $3",
      [status, organizationId, leadId]
    )
  );

  revalidatePath("/dashboard/leads");
  return { ok: true };
}

const leadIdSchema = z.object({ organizationId: z.string().uuid(), leadId: z.string().uuid() });

export async function deleteLead(input: unknown): Promise<ActionResult> {
  const parsed = leadIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, leadId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_contacts")) {
    return { ok: false, error: "You don't have permission to manage leads" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("DELETE FROM leads WHERE organization_id = $1 AND id = $2", [organizationId, leadId])
  );

  revalidatePath("/dashboard/leads");
  return { ok: true };
}
