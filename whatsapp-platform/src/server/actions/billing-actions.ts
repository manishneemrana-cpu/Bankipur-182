"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { generateInvoiceForOrganization } from "@/server/billing";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const generateSchema = z.object({
  organizationId: z.string().uuid(),
  periodStart: z.string(), // YYYY-MM-DD
  periodEnd: z.string(),
});

export async function generateInvoiceAction(input: unknown): Promise<ActionResult> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, periodStart, periodEnd } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_billing")) {
    return { ok: false, error: "You don't have permission to manage billing" };
  }

  try {
    await generateInvoiceForOrganization(organizationId, periodStart, periodEnd);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to generate invoice" };
  }

  revalidatePath("/dashboard/billing");
  return { ok: true };
}
