import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { withPlatformAdminTransaction } from "@/server/db";

// Regression test for migration 0007: registerOrganization() creates the
// founding `subscriptions` row inside the same platform-admin transaction as
// the org/user/membership inserts (no organization_id exists yet, so no
// app.org_id can be set) — the same "pre-tenant" RLS gap as migrations
// 0002-0005. `subscriptions` only had the generic tenant_isolation policy
// until 0007 added an admin bypass.

const adminPool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });
const appPool = new Pool({ connectionString: process.env.DATABASE_URL });

let organizationId: string;
let planId: string;

afterAll(async () => {
  if (organizationId) {
    await withPlatformAdminTransaction((client) =>
      client.query("DELETE FROM organizations WHERE id = $1", [organizationId])
    );
  }
  await adminPool.end();
  await appPool.end();
});

describe("subscriptions insert during signup (no tenant context yet)", () => {
  it("fails with a plain (non-admin) connection, documenting why registerOrganization needs the admin bypass", async () => {
    const org = await adminPool.query<{ id: string }>(
      "INSERT INTO organizations (name) VALUES ('Signup RLS Test Org') RETURNING id"
    );
    organizationId = org.rows[0]!.id;
    const plan = await adminPool.query<{ id: string }>("SELECT id FROM plans WHERE name = 'Starter'");
    planId = plan.rows[0]!.id;

    const client = await appPool.connect();
    try {
      await expect(
        client.query(
          "INSERT INTO subscriptions (organization_id, plan_id, status, current_period_start, current_period_end) VALUES ($1, $2, 'ACTIVE', now(), now() + interval '30 days')",
          [organizationId, planId]
        )
      ).rejects.toThrow(/row-level security/);
    } finally {
      client.release();
    }
  });

  it("succeeds when run as a platform-admin transaction, matching registerOrganization", async () => {
    const result = await withPlatformAdminTransaction((client) =>
      client.query<{ id: string }>(
        "INSERT INTO subscriptions (organization_id, plan_id, status, current_period_start, current_period_end) VALUES ($1, $2, 'ACTIVE', now(), now() + interval '30 days') RETURNING id",
        [organizationId, planId]
      )
    );
    expect(result.rows).toHaveLength(1);
  });
});
