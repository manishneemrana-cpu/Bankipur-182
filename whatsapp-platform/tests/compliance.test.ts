import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { runCampaignPreflight } from "@/server/compliance";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let userId: string;

async function makeTemplate(status: string, category = "UTILITY"): Promise<string> {
  const result = await adminPool.query<{ id: string }>(
    `INSERT INTO message_templates (organization_id, name, language, category, status)
     VALUES ($1, $2, 'en', $3, $4) RETURNING id`,
    [organizationId, `preflight_${Date.now()}_${Math.random().toString(36).slice(2)}`, category, status]
  );
  return result.rows[0]!.id;
}

async function makeCampaign(templateId: string): Promise<string> {
  const result = await adminPool.query<{ id: string }>(
    "INSERT INTO campaigns (organization_id, name, template_id) VALUES ($1, 'Preflight Test Campaign', $2) RETURNING id",
    [organizationId, templateId]
  );
  return result.rows[0]!.id;
}

async function addRecipient(campaignId: string, opts: { suppressed?: boolean; optInStatus?: string } = {}) {
  const contact = await adminPool.query<{ id: string }>(
    `INSERT INTO contacts (organization_id, phone_e164, suppressed, opt_in_status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [organizationId, `+91${Math.floor(Math.random() * 1e10)}`, opts.suppressed ?? false, opts.optInStatus ?? "OPTED_IN"]
  );
  await adminPool.query("INSERT INTO campaign_recipients (organization_id, campaign_id, contact_id) VALUES ($1, $2, $3)", [
    organizationId,
    campaignId,
    contact.rows[0]!.id,
  ]);
}

beforeAll(async () => {
  const org = await adminPool.query<{ id: string }>("INSERT INTO organizations (name) VALUES ('Compliance Test Org') RETURNING id");
  organizationId = org.rows[0]!.id;
  const user = await adminPool.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, full_name) VALUES ('compliance-test@example.com', 'x', 'Tester') RETURNING id"
  );
  userId = user.rows[0]!.id;
});

afterAll(async () => {
  await adminPool.query("DELETE FROM organizations WHERE id = $1", [organizationId]);
  await adminPool.query("DELETE FROM users WHERE id = $1", [userId]);
  await adminPool.end();
});

describe("runCampaignPreflight", () => {
  it("blocks launch when the template isn't approved", async () => {
    const templateId = await makeTemplate("PENDING");
    const campaignId = await makeCampaign(templateId);
    await addRecipient(campaignId);

    const result = await runCampaignPreflight(organizationId, userId, campaignId);
    expect(result.canLaunch).toBe(false);
    expect(result.reasons.some((r) => r.includes("PENDING"))).toBe(true);
  });

  it("blocks launch when there are no recipients", async () => {
    const templateId = await makeTemplate("APPROVED");
    const campaignId = await makeCampaign(templateId);

    const result = await runCampaignPreflight(organizationId, userId, campaignId);
    expect(result.canLaunch).toBe(false);
    expect(result.totalRecipients).toBe(0);
  });

  it("allows launch and reports skip counts for suppressed contacts, without blocking", async () => {
    const templateId = await makeTemplate("APPROVED", "UTILITY");
    const campaignId = await makeCampaign(templateId);
    await addRecipient(campaignId, { suppressed: false });
    await addRecipient(campaignId, { suppressed: true });

    const result = await runCampaignPreflight(organizationId, userId, campaignId);
    expect(result.canLaunch).toBe(true);
    expect(result.totalRecipients).toBe(2);
    expect(result.suppressedCount).toBe(1);
    expect(result.eligibleCount).toBe(1);
  });

  it("requires marketing opt-in only for MARKETING category templates", async () => {
    const utilityTemplate = await makeTemplate("APPROVED", "UTILITY");
    const utilityCampaign = await makeCampaign(utilityTemplate);
    await addRecipient(utilityCampaign, { optInStatus: "UNKNOWN" });
    const utilityResult = await runCampaignPreflight(organizationId, userId, utilityCampaign);
    expect(utilityResult.notOptedInCount).toBe(0);
    expect(utilityResult.eligibleCount).toBe(1);

    const marketingTemplate = await makeTemplate("APPROVED", "MARKETING");
    const marketingCampaign = await makeCampaign(marketingTemplate);
    await addRecipient(marketingCampaign, { optInStatus: "UNKNOWN" });
    const marketingResult = await runCampaignPreflight(organizationId, userId, marketingCampaign);
    expect(marketingResult.notOptedInCount).toBe(1);
    expect(marketingResult.eligibleCount).toBe(0);
    expect(marketingResult.canLaunch).toBe(false);
  });
});
