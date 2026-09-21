"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { requestOrganizationDeletion } from "@/server/data-lifecycle";
import { recordAuditLog } from "@/server/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const orgIdSchema = z.object({ organizationId: z.string().uuid() });

export async function requestOrganizationDeletionAction(input: unknown): Promise<ActionResult> {
  const parsed = orgIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (context.role !== "OWNER") {
    return { ok: false, error: "Only an Owner can request organization deletion" };
  }

  await requestOrganizationDeletion(organizationId, context.userId);
  await recordAuditLog(organizationId, context.userId, "organization.deletion_requested", {
    targetType: "organization",
    targetId: organizationId,
  });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
