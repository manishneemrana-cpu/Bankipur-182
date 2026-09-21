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
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Enter a phone number in international format, e.g. +919876543210"),
  name: z.string().trim().max(200).optional(),
  tags: z.string().optional(), // comma-separated from the form
});

export async function createContact(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, phoneE164, name, tags } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_contacts")) {
    return { ok: false, error: "You don't have permission to manage contacts" };
  }

  const tagList = tags
    ? tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  try {
    await withOrgTransaction(organizationId, context.userId, (client) =>
      client.query(
        `INSERT INTO contacts (organization_id, phone_e164, name, tags, source, opt_in_status, opt_in_at, opt_in_source)
         VALUES ($1, $2, $3, $4, 'manual', 'OPTED_IN', now(), 'manual_entry')`,
        [organizationId, phoneE164, name || null, tagList]
      )
    );
  } catch (err) {
    if (err instanceof Error && /duplicate key/i.test(err.message)) {
      return { ok: false, error: "A contact with this phone number already exists" };
    }
    throw err;
  }

  revalidatePath("/dashboard/contacts");
  return { ok: true };
}

const contactIdSchema = z.object({ organizationId: z.string().uuid(), contactId: z.string().uuid() });

export async function toggleContactSuppressed(input: unknown): Promise<ActionResult> {
  const parsed = contactIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, contactId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_contacts")) {
    return { ok: false, error: "You don't have permission to manage contacts" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query(
      `UPDATE contacts SET suppressed = NOT suppressed, opted_out_at = CASE WHEN suppressed THEN NULL ELSE now() END
       WHERE organization_id = $1 AND id = $2`,
      [organizationId, contactId]
    )
  );

  revalidatePath("/dashboard/contacts");
  return { ok: true };
}

export async function deleteContact(input: unknown): Promise<ActionResult> {
  const parsed = contactIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, contactId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_contacts")) {
    return { ok: false, error: "You don't have permission to manage contacts" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("DELETE FROM contacts WHERE organization_id = $1 AND id = $2", [organizationId, contactId])
  );

  revalidatePath("/dashboard/contacts");
  return { ok: true };
}
