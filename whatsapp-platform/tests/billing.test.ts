import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  listPlans,
  createPlan,
  updatePlan,
  togglePlanActive,
  generateInvoiceForOrganization,
  listInvoicesForOrganization,
  getCurrentSubscription,
} from "@/server/billing";
import { withPlatformAdminTransaction } from "@/server/db";

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });

let organizationId: string;
let otherOrgId: string;
let starterPlanId: string;
let testPlanId: string;

beforeAll(async () => {
  const starter = await adminPool.query<{ id: string }>("SELECT id FROM plans WHERE name = 'Starter'");
  starterPlanId = starter.rows[0]!.id;

  const org = await adminPool.query<{ id: string }>(
    "INSERT INTO organizations (name, plan_id) VALUES ('Billing Test Org', $1) RETURNING id",
    [starterPlanId]
  );
  organizationId = org.rows[0]!.id;
  const other = await adminPool.query<{ id: string }>(
    "INSERT INTO organizations (name, plan_id) VALUES ('Billing Test Other Org', $1) RETURNING id",
    [starterPlanId]
  );
  otherOrgId = other.rows[0]!.id;

  await adminPool.query(
    "INSERT INTO subscriptions (organization_id, plan_id, status, current_period_start, current_period_end) VALUES ($1, $2, 'ACTIVE', now(), now() + interval '30 days')",
    [organizationId, starterPlanId]
  );
  await adminPool.query(
    "INSERT INTO subscriptions (organization_id, plan_id, status, current_period_start, current_period_end) VALUES ($1, $2, 'ACTIVE', now(), now() + interval '30 days')",
    [otherOrgId, starterPlanId]
  );
});

afterAll(async () => {
  await withPlatformAdminTransaction((client) =>
    client.query("DELETE FROM organizations WHERE id IN ($1, $2)", [organizationId, otherOrgId])
  );
  if (testPlanId) {
    await adminPool.query("DELETE FROM plans WHERE id = $1", [testPlanId]);
  }
  await adminPool.end();
});

describe("plans CRUD (platform-wide, no RLS)", () => {
  it("creates, lists, updates, and toggles a plan", async () => {
    const created = await createPlan({
      name: `Test Plan ${Date.now()}`,
      priceMonthly: 4999,
      currency: "INR",
      limits: { seats: 3 },
    });
    testPlanId = created.id;
    expect(created.isActive).toBe(true);

    const plans = await listPlans();
    expect(plans.some((p) => p.id === testPlanId)).toBe(true);

    await updatePlan(testPlanId, { priceMonthly: 5999, currency: "INR", limits: { seats: 4 } });
    let plan = (await listPlans()).find((p) => p.id === testPlanId)!;
    expect(plan.priceMonthly).toBe(5999);
    expect(plan.limits).toEqual({ seats: 4 });

    await togglePlanActive(testPlanId);
    plan = (await listPlans()).find((p) => p.id === testPlanId)!;
    expect(plan.isActive).toBe(false);
  });
});

describe("subscriptions", () => {
  it("reads the current active subscription for an organization", async () => {
    const subscription = await getCurrentSubscription(organizationId);
    expect(subscription).not.toBeNull();
    expect(subscription!.planName).toBe("Starter");
    expect(subscription!.status).toBe("ACTIVE");
  });
});

describe("invoice generation", () => {
  it("generates an invoice with a SUBSCRIPTION line item priced from the plan", async () => {
    const invoice = await generateInvoiceForOrganization(organizationId, "2020-01-01", "2020-02-01");
    expect(invoice.status).toBe("ISSUED");
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0]!.kind).toBe("SUBSCRIPTION");
    expect(invoice.totalAmount).toBeGreaterThan(0);
  });

  it("throws rather than fabricating an invoice for an organization with no active subscription", async () => {
    const org = await adminPool.query<{ id: string }>(
      "INSERT INTO organizations (name) VALUES ('No Subscription Org') RETURNING id"
    );
    await expect(generateInvoiceForOrganization(org.rows[0]!.id, "2020-01-01", "2020-02-01")).rejects.toThrow(
      /no active subscription/
    );
    await withPlatformAdminTransaction((client) =>
      client.query("DELETE FROM organizations WHERE id = $1", [org.rows[0]!.id])
    );
  });

  it("adds a priced usage line item when pricing_config has a matching category, and skips unpriced usage kinds", async () => {
    await adminPool.query(
      "INSERT INTO pricing_config (category, price, currency, effective_from) VALUES ('AI_USAGE', 2.5, 'INR', '2020-01-01')"
    );
    await adminPool.query(
      "INSERT INTO usage_records (organization_id, kind, quantity, billing_period) VALUES ($1, 'AI_USAGE', 10, '2020-01-15')",
      [organizationId]
    );
    await adminPool.query(
      "INSERT INTO usage_records (organization_id, kind, quantity, billing_period) VALUES ($1, 'UNPRICED_KIND', 5, '2020-01-15')",
      [organizationId]
    );

    const invoice = await generateInvoiceForOrganization(organizationId, "2020-01-01", "2020-02-01");
    const aiLine = invoice.lineItems.find((i) => i.kind === "AI_USAGE");
    expect(aiLine).toBeDefined();
    expect(aiLine!.amount).toBe(25); // 10 units * 2.5
    expect(invoice.lineItems.some((i) => i.description.includes("UNPRICED_KIND"))).toBe(false);

    await adminPool.query("DELETE FROM pricing_config WHERE category = 'AI_USAGE'");
  });

  it("only returns the requesting organization's invoices, not another tenant's", async () => {
    await generateInvoiceForOrganization(otherOrgId, "2020-01-01", "2020-02-01");

    const orgInvoices = await listInvoicesForOrganization(organizationId);
    const otherInvoices = await listInvoicesForOrganization(otherOrgId);

    expect(orgInvoices.length).toBeGreaterThan(0);
    expect(otherInvoices.length).toBeGreaterThan(0);
    // Cross-check: organizationId's invoice list must not include otherOrgId's invoice ids.
    const otherIds = new Set(otherInvoices.map((i) => i.id));
    expect(orgInvoices.every((i) => !otherIds.has(i.id))).toBe(true);
  });
});
