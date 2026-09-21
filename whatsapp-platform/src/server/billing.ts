import "server-only";
import { withOrgTransaction, withSystemClient } from "@/server/db";

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  currency: string;
  limits: Record<string, unknown>;
  isActive: boolean;
}

function mapPlanRow(r: {
  id: string;
  name: string;
  price_monthly: string;
  currency: string;
  limits: Record<string, unknown>;
  is_active: boolean;
}): Plan {
  return {
    id: r.id,
    name: r.name,
    priceMonthly: Number(r.price_monthly),
    currency: r.currency,
    limits: r.limits,
    isActive: r.is_active,
  };
}

// `plans` has no RLS — it's a global platform table (see docs/decisions.md),
// gated by the app's own requirePlatformAdminUserId() check at the call site.
export async function listPlans(): Promise<Plan[]> {
  return withSystemClient(async (client) => {
    const result = await client.query("SELECT * FROM plans ORDER BY price_monthly ASC");
    return result.rows.map(mapPlanRow);
  });
}

export async function createPlan(input: {
  name: string;
  priceMonthly: number;
  currency: string;
  limits: Record<string, unknown>;
}): Promise<Plan> {
  return withSystemClient(async (client) => {
    const result = await client.query(
      "INSERT INTO plans (name, price_monthly, currency, limits) VALUES ($1, $2, $3, $4) RETURNING *",
      [input.name, input.priceMonthly, input.currency, JSON.stringify(input.limits)]
    );
    return mapPlanRow(result.rows[0]);
  });
}

export async function updatePlan(
  planId: string,
  input: { priceMonthly: number; currency: string; limits: Record<string, unknown> }
): Promise<void> {
  await withSystemClient((client) =>
    client.query("UPDATE plans SET price_monthly = $1, currency = $2, limits = $3 WHERE id = $4", [
      input.priceMonthly,
      input.currency,
      JSON.stringify(input.limits),
      planId,
    ])
  );
}

export async function togglePlanActive(planId: string): Promise<void> {
  await withSystemClient((client) => client.query("UPDATE plans SET is_active = NOT is_active WHERE id = $1", [planId]));
}

export interface CurrentSubscription {
  planName: string;
  priceMonthly: number;
  currency: string;
  status: string;
  currentPeriodEnd: string | null;
}

export async function getCurrentSubscription(organizationId: string): Promise<CurrentSubscription | null> {
  return withOrgTransaction(organizationId, async (client) => {
    const result = await client.query<{
      plan_name: string;
      price_monthly: string;
      currency: string;
      status: string;
      current_period_end: string | null;
    }>(
      `SELECT p.name AS plan_name, p.price_monthly, p.currency, s.status, s.current_period_end
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.organization_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [organizationId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      planName: row.plan_name,
      priceMonthly: Number(row.price_monthly),
      currency: row.currency,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
    };
  });
}

export interface Invoice {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  issuedAt: string | null;
  lineItems: Array<{ kind: string; description: string; amount: number; quantity: number }>;
}

/**
 * Generates one invoice for an organization covering [periodStart, periodEnd):
 * one SUBSCRIPTION line item from its current plan's price, plus one line
 * item per usage_records kind recorded in that window, priced from
 * pricing_config (never a hard-coded number). A usage kind with no matching
 * pricing_config row is skipped rather than guessed at.
 */
export async function generateInvoiceForOrganization(
  organizationId: string,
  periodStart: string,
  periodEnd: string
): Promise<Invoice> {
  return withOrgTransaction(organizationId, async (client) => {
    const subRes = await client.query<{ plan_id: string; plan_name: string; price_monthly: string; currency: string }>(
      `SELECT s.plan_id, p.name AS plan_name, p.price_monthly, p.currency
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.organization_id = $1 AND s.status = 'ACTIVE'
       ORDER BY s.created_at DESC LIMIT 1`,
      [organizationId]
    );
    const subscription = subRes.rows[0];
    if (!subscription) {
      throw new Error("Organization has no active subscription to invoice");
    }

    const usageRes = await client.query<{ kind: string; quantity: string }>(
      `SELECT kind, sum(quantity) AS quantity FROM usage_records
       WHERE organization_id = $1 AND billing_period >= $2 AND billing_period < $3
       GROUP BY kind`,
      [organizationId, periodStart, periodEnd]
    );

    const lineItems: Array<{ kind: string; description: string; amount: number; quantity: number }> = [
      {
        kind: "SUBSCRIPTION",
        description: `${subscription.plan_name} plan`,
        amount: Number(subscription.price_monthly),
        quantity: 1,
      },
    ];

    for (const usage of usageRes.rows) {
      const priceRes = await client.query<{ price: string }>(
        `SELECT price FROM pricing_config WHERE category = $1 AND effective_from <= $2
         ORDER BY effective_from DESC LIMIT 1`,
        [usage.kind, periodEnd]
      );
      const unitPrice = priceRes.rows[0]?.price;
      if (!unitPrice) continue; // no admin-configured price for this usage kind yet — never guess one
      const quantity = Number(usage.quantity);
      lineItems.push({
        kind: usage.kind === "AI_USAGE" || usage.kind === "CALLING_USAGE" ? usage.kind : "OTHER",
        description: `${usage.kind} usage`,
        amount: Number(unitPrice) * quantity,
        quantity,
      });
    }

    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    const invoiceRes = await client.query<{ id: string; status: string; issued_at: string | null }>(
      `INSERT INTO invoices (organization_id, subscription_id, status, total_amount, currency, issued_at, due_at)
       VALUES ($1, (SELECT id FROM subscriptions WHERE organization_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1),
               'ISSUED', $2, $3, now(), now() + interval '7 days')
       RETURNING id, status, issued_at`,
      [organizationId, totalAmount, subscription.currency]
    );
    const invoice = invoiceRes.rows[0]!;

    for (const item of lineItems) {
      await client.query(
        "INSERT INTO invoice_line_items (organization_id, invoice_id, kind, description, amount, quantity) VALUES ($1, $2, $3, $4, $5, $6)",
        [organizationId, invoice.id, item.kind, item.description, item.amount, item.quantity]
      );
    }

    return {
      id: invoice.id,
      status: invoice.status,
      totalAmount,
      currency: subscription.currency,
      issuedAt: invoice.issued_at,
      lineItems,
    };
  });
}

export async function listInvoicesForOrganization(organizationId: string): Promise<Invoice[]> {
  return withOrgTransaction(organizationId, async (client) => {
    const invoicesRes = await client.query<{
      id: string;
      status: string;
      total_amount: string;
      currency: string;
      issued_at: string | null;
    }>("SELECT id, status, total_amount, currency, issued_at FROM invoices WHERE organization_id = $1 ORDER BY created_at DESC", [
      organizationId,
    ]);

    const invoices: Invoice[] = [];
    for (const row of invoicesRes.rows) {
      const itemsRes = await client.query<{ kind: string; description: string; amount: string; quantity: string }>(
        "SELECT kind, description, amount, quantity FROM invoice_line_items WHERE invoice_id = $1",
        [row.id]
      );
      invoices.push({
        id: row.id,
        status: row.status,
        totalAmount: Number(row.total_amount),
        currency: row.currency,
        issuedAt: row.issued_at,
        lineItems: itemsRes.rows.map((i) => ({
          kind: i.kind,
          description: i.description,
          amount: Number(i.amount),
          quantity: Number(i.quantity),
        })),
      });
    }
    return invoices;
  });
}
