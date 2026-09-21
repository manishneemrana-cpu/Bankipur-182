"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { startOnboardingSession, completeMockOnboarding, type ConnectionPath } from "@/server/onboarding";
import { isMockModeEnabled } from "@/server/mock/meta";

const connectionPathSchema = z.enum(["EXISTING_APP_NUMBER", "NEW_NUMBER", "MIGRATED"]);

const startSchema = z.object({
  organizationId: z.string().uuid(),
  connectionPath: connectionPathSchema,
});

export interface ActionResult {
  ok: boolean;
  error?: string;
  sessionId?: string;
}

export async function startConnectWhatsapp(input: unknown): Promise<ActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, connectionPath } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_whatsapp")) {
    return { ok: false, error: "You don't have permission to connect WhatsApp" };
  }

  const session = await startOnboardingSession(organizationId, context.userId, connectionPath as ConnectionPath);
  return { ok: true, sessionId: session.id };
}

const completeSchema = z.object({
  organizationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  connectionPath: connectionPathSchema,
});

export async function completeMockConnectWhatsapp(input: unknown): Promise<ActionResult> {
  if (!isMockModeEnabled()) return { ok: false, error: "Not available outside mock mode" };

  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, sessionId, connectionPath } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_whatsapp")) {
    return { ok: false, error: "You don't have permission to connect WhatsApp" };
  }

  await completeMockOnboarding(organizationId, context.userId, sessionId, connectionPath as ConnectionPath);
  redirect("/dashboard/whatsapp");
}
