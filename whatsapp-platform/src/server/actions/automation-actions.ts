"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { withOrgTransaction } from "@/server/db";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  triggerType: z.enum(["welcome_message", "keyword_auto_reply", "business_hours_away"]),
  // .nullish() (not .optional()): a conditionally-rendered field the form
  // omits comes back from FormData.get() as `null`, not `undefined` — a real
  // bug caught via an end-to-end browser test, not by typecheck, since
  // `unknown` input to safeParse hides the mismatch until runtime.
  keywords: z.string().nullish(),
  hoursStart: z.string().nullish(),
  hoursEnd: z.string().nullish(),
  replyBody: z.string().trim().min(1).max(1000),
});

export async function createAutomation(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, name, triggerType, keywords, hoursStart, hoursEnd, replyBody } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_automations")) {
    return { ok: false, error: "You don't have permission to manage automations" };
  }

  const triggerConfig: Record<string, unknown> = {};
  if (triggerType === "keyword_auto_reply") {
    const keywordList = (keywords ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywordList.length === 0) {
      return { ok: false, error: "Enter at least one keyword" };
    }
    triggerConfig.keywords = keywordList;
  }
  if (triggerType === "business_hours_away") {
    if (!hoursStart || !hoursEnd) return { ok: false, error: "Enter business hours (start and end, UTC)" };
    triggerConfig.businessHours = { start: hoursStart, end: hoursEnd };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query(
      `INSERT INTO automations (organization_id, name, trigger_type, trigger_config, actions)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        organizationId,
        name,
        triggerType,
        JSON.stringify(triggerConfig),
        JSON.stringify([{ type: "send_message", body: replyBody }]),
      ]
    )
  );

  revalidatePath("/dashboard/automation");
  return { ok: true };
}

const automationIdSchema = z.object({ organizationId: z.string().uuid(), automationId: z.string().uuid() });

export async function toggleAutomation(input: unknown): Promise<ActionResult> {
  const parsed = automationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, automationId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_automations")) {
    return { ok: false, error: "You don't have permission to manage automations" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("UPDATE automations SET enabled = NOT enabled WHERE organization_id = $1 AND id = $2", [
      organizationId,
      automationId,
    ])
  );

  revalidatePath("/dashboard/automation");
  return { ok: true };
}

export async function deleteAutomation(input: unknown): Promise<ActionResult> {
  const parsed = automationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, automationId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_automations")) {
    return { ok: false, error: "You don't have permission to manage automations" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("DELETE FROM automations WHERE organization_id = $1 AND id = $2", [organizationId, automationId])
  );

  revalidatePath("/dashboard/automation");
  return { ok: true };
}
