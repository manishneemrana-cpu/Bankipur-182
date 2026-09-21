"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { createOutboundWebhook, toggleOutboundWebhook, deleteOutboundWebhook, OUTBOUND_EVENT_TYPES } from "@/server/outbound-webhooks";
import { recordAuditLog } from "@/server/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
  secret?: string;
}

const createSchema = z.object({
  organizationId: z.string().uuid(),
  url: z.string().url(),
  eventTypes: z.array(z.enum(OUTBOUND_EVENT_TYPES)).min(1),
});

export async function createOutboundWebhookAction(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, url, eventTypes } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_whatsapp")) {
    return { ok: false, error: "You don't have permission to manage webhooks" };
  }

  const created = await createOutboundWebhook(organizationId, context.userId, url, eventTypes);
  await recordAuditLog(organizationId, context.userId, "outbound_webhook.created", {
    targetType: "outbound_webhook",
    targetId: created.id,
    metadata: { url, eventTypes },
  });
  revalidatePath("/dashboard/integrations");
  return { ok: true, secret: created.secret };
}

const webhookIdSchema = z.object({ organizationId: z.string().uuid(), webhookId: z.string().uuid() });

export async function toggleOutboundWebhookAction(input: unknown): Promise<ActionResult> {
  const parsed = webhookIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, webhookId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_whatsapp")) {
    return { ok: false, error: "You don't have permission to manage webhooks" };
  }

  await toggleOutboundWebhook(organizationId, context.userId, webhookId);
  revalidatePath("/dashboard/integrations");
  return { ok: true };
}

export async function deleteOutboundWebhookAction(input: unknown): Promise<ActionResult> {
  const parsed = webhookIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, webhookId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_whatsapp")) {
    return { ok: false, error: "You don't have permission to manage webhooks" };
  }

  await deleteOutboundWebhook(organizationId, context.userId, webhookId);
  await recordAuditLog(organizationId, context.userId, "outbound_webhook.deleted", {
    targetType: "outbound_webhook",
    targetId: webhookId,
  });
  revalidatePath("/dashboard/integrations");
  return { ok: true };
}
