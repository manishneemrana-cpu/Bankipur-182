"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { createApiKey } from "@/server/api-keys";
import { withOrgTransaction } from "@/server/db";

export interface ActionResult {
  ok: boolean;
  error?: string;
  rawKey?: string;
}

const ALL_SCOPES = ["contacts.read", "contacts.write", "leads.read", "leads.write", "whatsapp.messages.send"] as const;

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  scopes: z.array(z.enum(ALL_SCOPES)).min(1),
});

export async function createApiKeyAction(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, name, scopes } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_whatsapp")) {
    return { ok: false, error: "You don't have permission to manage API keys" };
  }

  const created = await createApiKey(organizationId, context.userId, name, scopes);
  revalidatePath("/dashboard/api");
  return { ok: true, rawKey: created.rawKey };
}

const revokeSchema = z.object({ organizationId: z.string().uuid(), apiKeyId: z.string().uuid() });

export async function revokeApiKeyAction(input: unknown): Promise<ActionResult> {
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, apiKeyId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_whatsapp")) {
    return { ok: false, error: "You don't have permission to manage API keys" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("UPDATE api_keys SET revoked_at = now() WHERE organization_id = $1 AND id = $2", [
      organizationId,
      apiKeyId,
    ])
  );

  revalidatePath("/dashboard/api");
  return { ok: true };
}
