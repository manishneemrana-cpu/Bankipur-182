"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { sendConversationTemplateMessage, sendConversationTextMessage, MessagingError } from "@/server/messaging";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const sendTextSchema = z.object({
  organizationId: z.string().uuid(),
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4096),
});

export async function sendTextReply(input: unknown): Promise<ActionResult> {
  const parsed = sendTextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, conversationId, body } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "send_messages")) {
    return { ok: false, error: "You don't have permission to send messages" };
  }

  try {
    await sendConversationTextMessage({
      organizationId,
      userId: context.userId,
      conversationId,
      body,
      idempotencyKey: randomUUID(),
    });
  } catch (err) {
    if (err instanceof MessagingError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/dashboard/inbox/${conversationId}`);
  return { ok: true };
}

const sendTemplateSchema = z.object({
  organizationId: z.string().uuid(),
  conversationId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export async function sendTemplateReply(input: unknown): Promise<ActionResult> {
  const parsed = sendTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, conversationId, templateId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "send_messages")) {
    return { ok: false, error: "You don't have permission to send messages" };
  }

  try {
    await sendConversationTemplateMessage({
      organizationId,
      userId: context.userId,
      conversationId,
      templateId,
      idempotencyKey: randomUUID(),
    });
  } catch (err) {
    if (err instanceof MessagingError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/dashboard/inbox/${conversationId}`);
  return { ok: true };
}
