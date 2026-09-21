import "server-only";
import { withOrgTransaction } from "@/server/db";

export interface PreflightResult {
  canLaunch: boolean;
  templateApproved: boolean;
  templateCategory: string | null;
  totalRecipients: number;
  eligibleCount: number;
  suppressedCount: number;
  notOptedInCount: number;
  reasons: string[];
}

/**
 * The Compliance Guardian pre-flight check (per the project brief): before a
 * campaign can launch, is the template approved? is consent valid for
 * marketing recipients? are suppressed/opted-out contacts excluded? This
 * never blocks on suppressed/not-opted-in contacts existing in the
 * audience — those are simply skipped at send time — it only hard-blocks on
 * an unapproved template or an empty audience, and reports the rest as a
 * plain-language risk summary so the sender can decide before hitting send.
 */
export async function runCampaignPreflight(
  organizationId: string,
  userId: string,
  campaignId: string
): Promise<PreflightResult> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const campaignResult = await client.query<{ template_status: string; template_category: string }>(
      `SELECT t.status AS template_status, t.category AS template_category
       FROM campaigns c JOIN message_templates t ON t.id = c.template_id
       WHERE c.organization_id = $1 AND c.id = $2`,
      [organizationId, campaignId]
    );
    const campaign = campaignResult.rows[0];
    const templateApproved = campaign?.template_status === "APPROVED";
    const templateCategory = campaign?.template_category ?? null;

    const recipientStats = await client.query<{
      total: string;
      suppressed: string;
      not_opted_in: string;
    }>(
      `SELECT
         count(*) AS total,
         count(*) FILTER (WHERE ct.suppressed) AS suppressed,
         count(*) FILTER (WHERE NOT ct.suppressed AND ct.opt_in_status != 'OPTED_IN') AS not_opted_in
       FROM campaign_recipients cr
       JOIN contacts ct ON ct.id = cr.contact_id
       WHERE cr.organization_id = $1 AND cr.campaign_id = $2`,
      [organizationId, campaignId]
    );
    const stats = recipientStats.rows[0]!;
    const totalRecipients = Number(stats.total);
    const suppressedCount = Number(stats.suppressed);
    // Opt-in is only required for MARKETING sends, per the brief ("Marketing
    // campaigns can only target contacts with valid opt-in") — utility and
    // authentication templates don't carry the same requirement.
    const notOptedInCount = templateCategory === "MARKETING" ? Number(stats.not_opted_in) : 0;
    const eligibleCount = totalRecipients - suppressedCount - notOptedInCount;

    const reasons: string[] = [];
    if (!campaign) reasons.push("This campaign has no template selected.");
    else if (!templateApproved) {
      reasons.push(`The template is ${campaign.template_status}, not APPROVED — Meta has not approved it for sending.`);
    }
    if (totalRecipients === 0) reasons.push("No recipients match this campaign's audience.");
    if (suppressedCount > 0) {
      reasons.push(`${suppressedCount} recipient(s) are suppressed/opted out and will be skipped, not sent to.`);
    }
    if (notOptedInCount > 0) {
      reasons.push(`${notOptedInCount} recipient(s) don't have a recorded opt-in for marketing messages and will be skipped.`);
    }

    const canLaunch = templateApproved && totalRecipients > 0 && eligibleCount > 0;

    return {
      canLaunch,
      templateApproved,
      templateCategory,
      totalRecipients,
      eligibleCount,
      suppressedCount,
      notOptedInCount,
      reasons,
    };
  });
}
