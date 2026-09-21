import "server-only";
import { withOrgTransaction } from "@/server/db";

export interface ConnectionSummary {
  connectionStatus: string;
  qualityRating: string | null;
  messagingLimitTier: string | null;
}

/** The organization's real, persisted WhatsApp connection — null if none exists yet. */
export async function getRealConnectionSummary(organizationId: string, userId: string): Promise<ConnectionSummary | null> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<{ status: string; quality_rating: string | null; messaging_limit_tier: string | null }>(
      `SELECT status, quality_rating, messaging_limit_tier
       FROM whatsapp_phone_numbers WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [organizationId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { connectionStatus: row.status, qualityRating: row.quality_rating, messagingLimitTier: row.messaging_limit_tier };
  });
}
