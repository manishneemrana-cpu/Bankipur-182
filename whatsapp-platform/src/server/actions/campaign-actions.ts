"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { withOrgTransaction } from "@/server/db";
import { runCampaignPreflight } from "@/server/compliance";
import { sendTemplateToContact, MessagingError } from "@/server/messaging";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  templateId: z.string().uuid(),
  audienceTag: z.string().trim().max(100).optional(),
});

/** Creates a DRAFT campaign and populates its recipient list from the audience filter. */
export async function createCampaign(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { organizationId, name, templateId, audienceTag } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_campaigns")) {
    return { ok: false, error: "You don't have permission to manage campaigns" };
  }

  await withOrgTransaction(organizationId, context.userId, async (client) => {
    const campaign = await client.query<{ id: string }>(
      `INSERT INTO campaigns (organization_id, name, template_id, audience_filter, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [organizationId, name, templateId, JSON.stringify({ tag: audienceTag ?? null }), context.userId]
    );
    const campaignId = campaign.rows[0]!.id;

    if (audienceTag) {
      await client.query(
        `INSERT INTO campaign_recipients (organization_id, campaign_id, contact_id)
         SELECT $1, $2, id FROM contacts WHERE organization_id = $1 AND $3 = ANY(tags)
         ON CONFLICT (campaign_id, contact_id) DO NOTHING`,
        [organizationId, campaignId, audienceTag]
      );
    } else {
      await client.query(
        `INSERT INTO campaign_recipients (organization_id, campaign_id, contact_id)
         SELECT $1, $2, id FROM contacts WHERE organization_id = $1
         ON CONFLICT (campaign_id, contact_id) DO NOTHING`,
        [organizationId, campaignId]
      );
    }
  });

  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}

const campaignIdSchema = z.object({ organizationId: z.string().uuid(), campaignId: z.string().uuid() });

/**
 * Runs the Compliance Guardian pre-flight, then — if it passes — sends to
 * every eligible recipient inline (no job queue yet, same "don't add
 * infrastructure before it's needed" call as webhook processing). Each
 * recipient's outcome (sent/failed/skipped) is recorded individually so a
 * partial failure doesn't lose track of what happened to whom.
 */
export async function launchCampaign(input: unknown): Promise<ActionResult> {
  const parsed = campaignIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, campaignId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_campaigns")) {
    return { ok: false, error: "You don't have permission to manage campaigns" };
  }

  const preflight = await runCampaignPreflight(organizationId, context.userId, campaignId);
  if (!preflight.canLaunch) {
    return { ok: false, error: preflight.reasons.join(" ") || "This campaign cannot be launched yet." };
  }

  const { templateId, recipients } = await withOrgTransaction(organizationId, context.userId, async (client) => {
    const campaign = await client.query<{ template_id: string }>(
      "SELECT template_id FROM campaigns WHERE organization_id = $1 AND id = $2",
      [organizationId, campaignId]
    );
    await client.query("UPDATE campaigns SET status = 'RUNNING', compliance_preflight_passed = true WHERE organization_id = $1 AND id = $2", [
      organizationId,
      campaignId,
    ]);
    const recipientsResult = await client.query<{ id: string; contact_id: string; suppressed: boolean; opt_in_status: string }>(
      `SELECT cr.id, cr.contact_id, ct.suppressed, ct.opt_in_status
       FROM campaign_recipients cr JOIN contacts ct ON ct.id = cr.contact_id
       WHERE cr.organization_id = $1 AND cr.campaign_id = $2 AND cr.status = 'QUEUED'`,
      [organizationId, campaignId]
    );
    return { templateId: campaign.rows[0]!.template_id, recipients: recipientsResult.rows };
  });

  for (const recipient of recipients) {
    if (recipient.suppressed) {
      await withOrgTransaction(organizationId, context.userId, (client) =>
        client.query("UPDATE campaign_recipients SET status = 'SKIPPED', skip_reason = 'suppressed' WHERE id = $1", [
          recipient.id,
        ])
      );
      continue;
    }
    if (preflight.templateCategory === "MARKETING" && recipient.opt_in_status !== "OPTED_IN") {
      await withOrgTransaction(organizationId, context.userId, (client) =>
        client.query("UPDATE campaign_recipients SET status = 'SKIPPED', skip_reason = 'no_marketing_opt_in' WHERE id = $1", [
          recipient.id,
        ])
      );
      continue;
    }

    try {
      const result = await sendTemplateToContact({
        organizationId,
        userId: context.userId,
        contactId: recipient.contact_id,
        templateId,
        campaignId,
        idempotencyKey: randomUUID(),
      });
      await withOrgTransaction(organizationId, context.userId, (client) =>
        client.query("UPDATE campaign_recipients SET status = 'SENT', message_id = $1 WHERE id = $2", [
          result.messageId,
          recipient.id,
        ])
      );
    } catch (err) {
      const reason = err instanceof MessagingError ? err.code : "send_failed";
      await withOrgTransaction(organizationId, context.userId, (client) =>
        client.query("UPDATE campaign_recipients SET status = 'FAILED', skip_reason = $1 WHERE id = $2", [reason, recipient.id])
      );
    }
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("UPDATE campaigns SET status = 'COMPLETED' WHERE organization_id = $1 AND id = $2", [
      organizationId,
      campaignId,
    ])
  );

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}

export async function deleteCampaign(input: unknown): Promise<ActionResult> {
  const parsed = campaignIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { organizationId, campaignId } = parsed.data;

  const context = await requireOrgContext(organizationId);
  if (!hasPermission(context.role, context.permissionOverrides, "manage_campaigns")) {
    return { ok: false, error: "You don't have permission to manage campaigns" };
  }

  await withOrgTransaction(organizationId, context.userId, (client) =>
    client.query("DELETE FROM campaigns WHERE organization_id = $1 AND id = $2", [organizationId, campaignId])
  );

  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}
