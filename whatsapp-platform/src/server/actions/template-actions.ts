"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { withOrgTransaction } from "@/server/db";
import { isMockModeEnabled } from "@/server/mock/meta";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * organizationId comes from client input, but is never trusted on its own —
 * requireOrgContext() re-verifies the signed-in user actually belongs to it
 * before anything runs. userId, by contrast, is NEVER read from client
 * input anywhere in this file; it always comes from context.userId, which
 * requireOrgContext() resolves from the session cookie server-side.
 */
const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z
    .string()
    .min(2)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only (Meta's naming rule)"),
  language: z.string().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
});

/** Creates a new template as DRAFT. Never pre-marked approved — see project rules. */
export async function createTemplate(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, name, language, category } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_templates")) {
    return { ok: false, error: "You don't have permission to manage templates" };
  }

  try {
    await withOrgTransaction(organizationId, context.userId, (client) =>
      client.query(
        `INSERT INTO message_templates (organization_id, name, language, category, status)
         VALUES ($1, $2, $3, $4, 'DRAFT')`,
        [organizationId, name, language, category]
      )
    );
  } catch (err) {
    if (err instanceof Error && /duplicate key/i.test(err.message)) {
      return { ok: false, error: "A template with this name and language already exists" };
    }
    throw err;
  }

  revalidatePath("/dashboard/templates");
  return { ok: true };
}

const templateIdSchema = z.object({ organizationId: z.string().uuid(), templateId: z.string().uuid() });

/**
 * Submits a DRAFT template for review. This is where a real call to Meta's
 * template-creation API belongs (POST /{waba_id}/message_templates) — not
 * implemented yet, since no organization has a real WABA to submit to until
 * Phase 5. In mock mode this only updates our own status field so the UI's
 * approval workflow can be exercised end-to-end without a live Meta call.
 */
export async function submitTemplateForReview(input: unknown): Promise<ActionResult> {
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, templateId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_templates")) {
    return { ok: false, error: "You don't have permission to manage templates" };
  }

  const result = await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query(
      "UPDATE message_templates SET status = 'PENDING' WHERE organization_id = $1 AND id = $2 AND status = 'DRAFT'",
      [organizationId, templateId]
    )
  );
  if (result.rowCount === 0) {
    return { ok: false, error: "Only a DRAFT template can be submitted for review" };
  }

  revalidatePath("/dashboard/templates");
  return { ok: true };
}

export async function deleteTemplate(input: unknown): Promise<ActionResult> {
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, templateId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_templates")) {
    return { ok: false, error: "You don't have permission to manage templates" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("DELETE FROM message_templates WHERE organization_id = $1 AND id = $2", [organizationId, templateId])
  );

  revalidatePath("/dashboard/templates");
  return { ok: true };
}

/**
 * Mock-mode-only convenience so the approval workflow is demoable without a
 * real Meta review. Hard-gated on isMockModeEnabled() — this must never be
 * reachable once MOCK_META=false, per the project rule that a template's
 * status must always reflect what Meta actually reported.
 */
export async function mockApproveTemplate(input: unknown): Promise<ActionResult> {
  if (!isMockModeEnabled()) {
    return { ok: false, error: "Not available outside mock mode" };
  }
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, templateId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_templates")) {
    return { ok: false, error: "You don't have permission to manage templates" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query(
      "UPDATE message_templates SET status = 'APPROVED', meta_template_id = 'mock-' || id WHERE organization_id = $1 AND id = $2 AND status = 'PENDING'",
      [organizationId, templateId]
    )
  );

  revalidatePath("/dashboard/templates");
  return { ok: true };
}
